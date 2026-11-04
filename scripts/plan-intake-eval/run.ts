/**
 * 计划助理「学员回复提取」离线评测：真实快模型 + 合成学员回复（cases.json），不连数据库、不发消息。
 * 不在 npm test 里跑。
 *
 *   INTAKE_EVAL_ENV_FILE=<含 WANJIE_ARK_* 的配置文件> npx tsx scripts/plan-intake-eval/run.ts --runs 3
 *
 * 选项：--runs N（每条跑几次，默认 3）、--only id1,id2、--split tune|holdout、--concurrency N（默认 6）、
 *      --out 目录（默认 E:/gotmp/intake-reply-eval）、--model 名称（默认同线上快模型）、--label 报告名、
 *      对照用：--thinking on|low（默认 off，同线上）、--no-grounding（不核对原文数字）、
 *      --rescore <某次的 results.json>（不调模型，用保存的原始输出重算，只评估校验逻辑的改动）。
 * 环境文件只读取 WANJIE_ARK_* 几项，不打印任何值。
 * 请求、解析、校验与 planIntake.ts 的 extractReply 保持一致：改了那边要同步这里的 extract()。
 */
import fs from "node:fs";
import path from "node:path";
import { getCoachlinkFastLlm } from "@/lib/coachlinkLlm";
import { parseJsonResponse } from "@/lib/deepseek";
import {
    buildIntakeQuestions,
    buildIntakeReplyRequest,
    isIntakeReplyShape,
    normalizeIntakeReply,
    type NormalizedIntakeReply,
    type PlanIntakeQuestion,
} from "@/lib/coachingAutomation/planIntakeModel";

type Pair = [number, number];
type OneRmExpect = Pair | Array<Pair | null>;
type Expect = {
    bodyWeightKg?: number | null | Array<number | null>;
    oneRm?: Record<string, OneRmExpect>;
    unknown?: string[];
    unknownOptional?: string[];
    open?: string[];
    openOptional?: string[];
    risk?: boolean | "any";
    other?: boolean | "any";
    related?: boolean | "any";
};
type Scenario = {
    needsBodyWeight: boolean;
    lifts: Array<{ key: string; actionId: string; actionName: string; includesBodyWeight: boolean }>;
    openQuestions: string[];
};
type EvalCase = { id: string; split?: string; category: string; scenario: string; messages: string[]; expect: Expect };
type Fixture = { version: number; scenarios: Record<string, Scenario>; cases: EvalCase[] };

type IssueKind =
    | "dangerous" | "missed" | "unknown" | "open" | "risk_missed" | "risk_false_alarm"
    | "other" | "related" | "error";
type Issue = { kind: IssueKind; detail: string };
type RunResult = {
    caseId: string;
    run: number;
    ms: number;
    retried: number;
    issues: Issue[];
    normalized: NormalizedIntakeReply | null;
    raw: string;
};

const REPLY_LLM_TIMEOUT_MS = 20_000;
const REPLY_LLM_ATTEMPTS = 2;

function arg(name: string, fallback: string): string {
    const index = process.argv.indexOf(`--${name}`);
    return index > 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function loadLlmEnv() {
    if (process.env.WANJIE_ARK_API_KEY) return;
    const file = process.env.INTAKE_EVAL_ENV_FILE;
    if (!file) throw new Error("请设置 INTAKE_EVAL_ENV_FILE（含 WANJIE_ARK_* 的配置文件）");
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*(WANJIE_ARK_[A-Z_]+)\s*=\s*(.*)\s*$/);
        if (!match || process.env[match[1]]) continue;
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
}

function questionsFor(scenario: Scenario): PlanIntakeQuestion[] {
    return buildIntakeQuestions({
        missingOneRm: scenario.lifts.map((lift) => ({
            actionId: lift.actionId,
            actionName: lift.actionName,
            includesBodyWeight: lift.includesBodyWeight,
            occurrences: 1,
        })),
        needsBodyWeight: scenario.needsBodyWeight,
        openQuestions: scenario.openQuestions,
    });
}

function questionIdOf(scenario: Scenario, key: string): string {
    if (key === "bodyWeight") return "body_weight";
    const open = key.match(/^open(\d+)$/);
    if (open) return `open:${open[1]}`;
    const lift = scenario.lifts.find((l) => l.key === key);
    if (!lift) throw new Error(`unknown key ${key}`);
    return `one_rm:${lift.actionId}`;
}

function keyOf(scenario: Scenario, questionId: string): string {
    if (questionId === "body_weight") return "bodyWeight";
    if (questionId.startsWith("open:")) return `open${questionId.slice(5)}`;
    return scenario.lifts.find((l) => `one_rm:${l.actionId}` === questionId)?.key || questionId;
}

function closeKg(actual: number, expected: number): boolean {
    return Math.abs(actual - expected) <= Math.max(0.6, Math.abs(expected) * 0.015);
}

function oneRmAlternatives(value: OneRmExpect): Array<Pair | null> {
    return typeof value[0] === "number" ? [value as Pair] : (value as Array<Pair | null>);
}

function requiredAnswerCount(expect: Expect): number {
    const bw = expect.bodyWeightKg;
    const bwRequired = bw !== undefined && bw !== null && (!Array.isArray(bw) || !bw.includes(null));
    const liftsRequired = Object.values(expect.oneRm || {})
        .filter((value) => !oneRmAlternatives(value).includes(null)).length;
    return (bwRequired ? 1 : 0) + liftsRequired + (expect.unknown?.length || 0) + (expect.open?.length || 0);
}

function score(c: EvalCase, scenario: Scenario, reply: NormalizedIntakeReply): Issue[] {
    const issues: Issue[] = [];
    const e = c.expect;

    const bwOptions = e.bodyWeightKg === undefined ? [null] : Array.isArray(e.bodyWeightKg) ? e.bodyWeightKg : [e.bodyWeightKg];
    const bwOk = bwOptions.some((option) =>
        option === null ? reply.bodyWeightKg === null : reply.bodyWeightKg !== null && closeKg(reply.bodyWeightKg, option));
    if (!bwOk) {
        issues.push({
            kind: reply.bodyWeightKg === null ? "missed" : "dangerous",
            detail: `体重 期望 ${JSON.stringify(bwOptions)} 实际 ${reply.bodyWeightKg}`,
        });
    }

    const expectedLifts = e.oneRm || {};
    for (const lift of scenario.lifts) {
        const qid = `one_rm:${lift.actionId}`;
        const got = reply.oneRmAnswers.find((a) => a.questionId === qid) || null;
        const options = expectedLifts[lift.key] ? oneRmAlternatives(expectedLifts[lift.key]) : [null];
        const ok = options.some((option) => option === null
            ? got === null
            : got !== null && closeKg(got.weightKg, option[0]) && got.reps === option[1]);
        if (!ok) {
            issues.push({
                kind: got === null ? "missed" : "dangerous",
                detail: `${lift.key} 期望 ${JSON.stringify(options)} 实际 ${got ? `[${got.weightKg},${got.reps}]` : "null"}`,
            });
        }
    }

    const checkIds = (kind: "unknown" | "open", actual: string[], required: string[] = [], optional: string[] = []) => {
        const actualKeys = actual.map((id) => keyOf(scenario, id));
        const missing = required.filter((key) => !actualKeys.includes(key));
        const extra = actualKeys.filter((key) => !required.includes(key) && !optional.includes(key));
        if (missing.length || extra.length) {
            issues.push({ kind, detail: `${kind} 缺 [${missing.join(",")}] 多 [${extra.join(",")}]` });
        }
    };
    checkIds("unknown", reply.unknownQuestionIds, e.unknown, e.unknownOptional);
    checkIds("open", reply.openAnswers.map((a) => a.questionId), e.open, e.openOptional);

    const risk = e.risk ?? false;
    if (risk === true && !reply.riskNotes) issues.push({ kind: "risk_missed", detail: "没报身体问题" });
    if (risk === false && reply.riskNotes) issues.push({ kind: "risk_false_alarm", detail: `误报：${reply.riskNotes}` });

    const other = e.other ?? "any";
    if (other !== "any" && Boolean(reply.otherNotes) !== other) {
        issues.push({ kind: "other", detail: `otherNotes 期望${other ? "有" : "无"} 实际「${reply.otherNotes}」` });
    }

    const related = e.related ?? (requiredAnswerCount(e) > 0 ? true : "any");
    if (related !== "any" && reply.related !== related) {
        issues.push({ kind: "related", detail: `related 期望 ${related} 实际 ${reply.related}` });
    }
    return issues;
}

// 默认与 planIntake.ts extractReply 一致；--thinking on|low 和 --no-grounding 只用来做对照。
const THINKING = arg("thinking", "off");
const GROUNDING = !process.argv.includes("--no-grounding");

function requestFor(model: string, questions: PlanIntakeQuestion[], messages: string[]): Record<string, unknown> {
    const { thinking: _thinking, enable_thinking: _enableThinking, ...rest } =
        buildIntakeReplyRequest({ model, questions, studentMessages: messages }) as Record<string, unknown>;
    if (THINKING === "on") return rest;
    if (THINKING === "low") return { ...rest, reasoning_effort: "low" };
    return buildIntakeReplyRequest({ model, questions, studentMessages: messages });
}

async function extract(questions: PlanIntakeQuestion[], messages: string[]) {
    const { client, model } = getCoachlinkFastLlm();
    let lastError: unknown = null;
    const failures: string[] = [];
    for (let attempt = 0; attempt < REPLY_LLM_ATTEMPTS; attempt++) {
        try {
            const completion = await client.chat.completions.create(
                requestFor(model, questions, messages) as any,
                { timeout: REPLY_LLM_TIMEOUT_MS },
            );
            const text = (completion as any).choices?.[0]?.message?.content || "";
            if (!text) throw new Error("LLM 返回空内容");
            const raw = parseJsonResponse<any>(text, "plan-intake-eval");
            if (!isIntakeReplyShape(raw)) throw new Error(`LLM 返回的 JSON 不是回复提取结果：${text.slice(0, 80)}`);
            return {
                text: failures.length ? `[重试前：${failures.join(" | ")}]\n${text}` : text,
                retried: failures.length,
                reply: normalizeIntakeReply(raw, questions, GROUNDING ? { studentMessages: messages } : {}),
            };
        } catch (error) {
            lastError = error;
            failures.push(error instanceof Error ? error.message.slice(0, 80) : String(error));
        }
    }
    throw lastError;
}

async function runOne(c: EvalCase, scenario: Scenario, run: number): Promise<RunResult> {
    const started = Date.now();
    try {
        const { text, reply, retried } = await extract(questionsFor(scenario), c.messages);
        return { caseId: c.id, run, ms: Date.now() - started, retried, issues: score(c, scenario, reply), normalized: reply, raw: text };
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        return { caseId: c.id, run, ms: Date.now() - started, retried: REPLY_LLM_ATTEMPTS - 1, issues: [{ kind: "error", detail }], normalized: null, raw: "" };
    }
}

async function pool<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++;
            results[index] = await worker(items[index]);
        }
    }));
    return results;
}

function signature(reply: NormalizedIntakeReply | null): string {
    if (!reply) return "error";
    return JSON.stringify({
        related: reply.related,
        bw: reply.bodyWeightKg,
        lifts: [...reply.oneRmAnswers].sort((a, b) => a.questionId.localeCompare(b.questionId)),
        unknown: [...reply.unknownQuestionIds].sort(),
        open: reply.openAnswers.map((a) => a.questionId).sort(),
        risk: Boolean(reply.riskNotes),
        other: Boolean(reply.otherNotes),
    });
}

function splitOf(c: EvalCase): string {
    return c.split || "tune";
}

function pct(n: number, d: number): string {
    return d === 0 ? "-" : `${((n / d) * 100).toFixed(1)}%`;
}

function report(fixture: Fixture, cases: EvalCase[], results: RunResult[], meta: Record<string, string>): string {
    const byCase = new Map<string, RunResult[]>();
    for (const r of results) byCase.set(r.caseId, [...(byCase.get(r.caseId) || []), r]);
    const count = (kind: IssueKind) => results.filter((r) => r.issues.some((i) => i.kind === kind)).length;
    const passed = results.filter((r) => r.issues.length === 0).length;
    const unstable = cases.filter((c) => new Set((byCase.get(c.id) || []).map((r) => signature(r.normalized))).size > 1);
    const allPass = cases.filter((c) => (byCase.get(c.id) || []).every((r) => r.issues.length === 0)).length;
    const ms = results.map((r) => r.ms).sort((a, b) => a - b);
    const quantile = (q: number) => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))] || 0;

    const lines = [
        `# 计划助理回复提取评测 ${meta.label}`,
        "",
        `- 时间：${meta.at}；模型：${meta.model}；评测集 v${fixture.version}，${cases.length} 条 × ${meta.runs} 次 = ${results.length} 次调用`,
        `- 单次通过：${passed}/${results.length}（${pct(passed, results.length)}）；每次都通过的用例：${allPass}/${cases.length}（${pct(allPass, cases.length)}）`,
        `- 写错数字（dangerous）：${count("dangerous")} 次；漏记：${count("missed")}；漏报身体问题：${count("risk_missed")}；误报：${count("risk_false_alarm")}；调用失败：${count("error")}；重试过：${results.filter((r) => r.retried > 0).length}`,
        `- 多次结果不一致的用例：${unstable.length}（${unstable.map((c) => c.id).join(", ") || "无"}）`,
        `- 耗时 p50 ${quantile(0.5)}ms，p95 ${quantile(0.95)}ms，最长 ${ms[ms.length - 1] || 0}ms`,
        "",
        "| 分组 | 用例 | 单次通过率 | 写错数字 | 漏记 | 其他问题 |",
        "| --- | --- | --- | --- | --- | --- |",
    ];
    const row = (label: string, group: EvalCase[]) => {
        const ids = new Set(group.map((c) => c.id));
        const rs = results.filter((r) => ids.has(r.caseId));
        const ok = rs.filter((r) => r.issues.length === 0).length;
        const has = (kind: IssueKind) => rs.filter((r) => r.issues.some((i) => i.kind === kind)).length;
        const otherIssues = rs.filter((r) => r.issues.some((i) => i.kind !== "dangerous" && i.kind !== "missed")).length;
        lines.push(`| ${label} | ${ids.size} | ${ok}/${rs.length}（${pct(ok, rs.length)}） | ${has("dangerous")} | ${has("missed")} | ${otherIssues} |`);
    };
    for (const split of Array.from(new Set(cases.map(splitOf)))) {
        row(`**${split}**`, cases.filter((c) => splitOf(c) === split));
    }
    for (const category of Array.from(new Set(cases.map((c) => c.category)))) {
        row(category, cases.filter((c) => c.category === category));
    }

    lines.push("", "## 失败明细", "");
    for (const c of cases) {
        const rs = byCase.get(c.id) || [];
        const failed = rs.filter((r) => r.issues.length > 0);
        if (failed.length === 0) continue;
        const text = c.messages.join(" / ").replace(/\n/g, " ");
        lines.push(`### ${c.id}（${c.category}）${failed.length}/${rs.length} 次失败`);
        lines.push(`> ${text.length > 160 ? `${text.slice(0, 160)}…` : text}`);
        for (const r of failed) lines.push(`- 第 ${r.run} 次：${r.issues.map((i) => `[${i.kind}] ${i.detail}`).join("；")}`);
        lines.push("");
    }
    return lines.join("\n");
}

async function runLive(cases: EvalCase[], fixture: Fixture, runs: number, concurrency: number): Promise<RunResult[]> {
    loadLlmEnv();
    const jobs = cases.flatMap((c) => Array.from({ length: runs }, (_, i) => ({ c, run: i + 1 })));
    let done = 0;
    return pool(jobs, concurrency, async ({ c, run }) => {
        const result = await runOne(c, fixture.scenarios[c.scenario], run);
        done++;
        if (done % 20 === 0 || done === jobs.length) process.stdout.write(`  ${done}/${jobs.length}\n`);
        return result;
    });
}

/** --rescore：用已保存的模型原始输出重跑校验和打分，只评估 normalizeIntakeReply 的改动。 */
function rescoreSaved(file: string, cases: EvalCase[], fixture: Fixture): RunResult[] {
    const saved: RunResult[] = JSON.parse(fs.readFileSync(file, "utf8")).results;
    const byId = new Map(cases.map((c) => [c.id, c]));
    return saved.filter((r) => byId.has(r.caseId)).map((r) => {
        const c = byId.get(r.caseId)!;
        const scenario = fixture.scenarios[c.scenario];
        const text = r.raw.replace(/^\[重试前：[^\n]*\]\n/, "");
        if (!text) return r;
        const questions = questionsFor(scenario);
        const reply = normalizeIntakeReply(
            parseJsonResponse<any>(text, "plan-intake-eval"),
            questions,
            GROUNDING ? { studentMessages: c.messages } : {},
        );
        return { ...r, issues: score(c, scenario, reply), normalized: reply };
    });
}

async function main() {
    const model = arg("model", "");
    if (model) process.env.WANJIE_ARK_FAST_MODEL = model;
    const runs = Number(arg("runs", "3"));
    const concurrency = Number(arg("concurrency", "6"));
    const outDir = arg("out", "E:/gotmp/intake-reply-eval");
    const label = arg("label", "run");
    const only = arg("only", "").split(",").map((s) => s.trim()).filter(Boolean);
    const split = arg("split", "");

    const fixture: Fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "cases.json"), "utf8"));
    const cases = fixture.cases.filter((c) =>
        (only.length === 0 || only.includes(c.id)) && (!split || splitOf(c) === split));
    for (const c of cases) {
        const scenario = fixture.scenarios[c.scenario];
        if (!scenario) throw new Error(`${c.id}: unknown scenario ${c.scenario}`);
        Object.keys(c.expect.oneRm || {}).forEach((key) => questionIdOf(scenario, key));
    }

    const rescore = arg("rescore", "");
    const results = rescore
        ? rescoreSaved(rescore, cases, fixture)
        : await runLive(cases, fixture, runs, concurrency);

    const meta = {
        label,
        at: new Date().toISOString(),
        model: rescore
            ? `重算 ${path.basename(rescore)}（grounding=${GROUNDING ? "on" : "off"}，不调用模型）`
            : `${getCoachlinkFastLlm().model}（thinking=${THINKING}，grounding=${GROUNDING ? "on" : "off"}）`,
        runs: rescore ? String(Math.max(...results.map((r) => r.run))) : String(runs),
    };
    const markdown = report(fixture, cases, results, meta);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${label}-report.md`), markdown, "utf8");
    fs.writeFileSync(path.join(outDir, `${label}-results.json`), JSON.stringify({ meta, results }, null, 2), "utf8");
    console.log(markdown.split("\n## 失败明细")[0]);
    console.log(`\n报告：${path.join(outDir, `${label}-report.md`)}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
