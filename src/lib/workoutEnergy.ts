import type OpenAI from "openai";
import { getCoachlinkFastLlm } from "@/lib/coachlinkLlm";

export type WorkoutEnergyConfidence = "high" | "medium" | "low";

export interface WorkoutEnergyActionInput {
    actionId?: string | null;
    name: string;
    type?: string | null;
    attrs?: string[] | null;
    category?: string | null;
    itemSchema?: Record<string, unknown> | null;
    completedSets: number;
    actualDurationSeconds?: number | null;
    actualDistanceMeters?: number | null;
}

export interface WorkoutEnergyActionEstimate {
    actionId: string | null;
    name: string;
    type: "STRENGTH" | "CARDIO";
    met: number;
    minutes: number;
    calories: number;
    activeCalories: number;
    confidence: WorkoutEnergyConfidence;
    basis: string;
}

export interface WorkoutEnergyEstimate {
    calories: number;
    activeCalories: number;
    durationMinutes: number;
    averageMet: number;
    bodyWeightKg: number;
    confidence: WorkoutEnergyConfidence;
    method: "ai_assisted_2024_compendium" | "rules_2024_compendium";
    disclaimer: string;
    actions: WorkoutEnergyActionEstimate[];
}

interface ClassifiedAction {
    index: number;
    met: number;
    confidence?: WorkoutEnergyConfidence;
    reason?: string;
}

const round = (value: number, digits = 1) => {
    const power = 10 ** digits;
    return Math.round(value * power) / power;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function actionText(action: WorkoutEnergyActionInput) {
    return [action.name, action.category, ...(action.attrs || [])].filter(Boolean).join(" ").toLowerCase();
}

function itemSchemaMet(action: WorkoutEnergyActionInput): number | null {
    const raw = action.itemSchema?.met ?? action.itemSchema?.met_value;
    const value = Number(raw);
    return Number.isFinite(value) && value >= 1.5 && value <= 20 ? value : null;
}

function deterministicMet(action: WorkoutEnergyActionInput) {
    const explicit = itemSchemaMet(action);
    if (explicit) return { met: explicit, confidence: "high" as const, basis: "动作库MET" };
    const text = actionText(action);
    const type = String(action.type || "STRENGTH").toUpperCase();

    if (type === "CARDIO") {
        const mappings: Array<[RegExp, number, string]> = [
            [/冲刺|sprint/, 12.3, "冲刺跑"],
            [/跳绳/, text.includes("间歇") ? 12.3 : 11, "跳绳"],
            [/配速跑|长距离慢跑/, 9.0, "跑步"],
            [/慢跑/, 7.5, "慢跑"],
            [/快走.*坡|坡度/, 7.0, "坡度快走"],
            [/快走/, 4.8, "快走"],
            [/单车.*冲刺|动感单车冲刺/, 9.0, "高强度单车"],
            [/单车|骑行/, 7.0, "单车"],
            [/划船.*间歇/, 7.5, "划船间歇"],
            [/划船/, 5.0, "划船稳态"],
            [/椭圆机/, 5.0, "椭圆机"],
            [/游泳/, 8.0, "游泳"],
            [/波比|登山跑|战绳|跳箱|hiit|间歇/, 7.5, "高强度间歇"],
            [/开合跳|台阶|踏步/, 7.3, "有氧操/踏步"],
        ];
        const matched = mappings.find(([pattern]) => pattern.test(text));
        return matched
            ? { met: matched[1], confidence: "medium" as const, basis: matched[2] }
            : { met: 7.3, confidence: "low" as const, basis: "一般有氧" };
    }

    const isStreet = text.includes("街头健身") || text.includes("俄挺") || text.includes("前水平") || text.includes("人旗");
    if (isStreet) {
        if (/难度s\+\+|难度s\+|难度s/.test(text)) return { met: 8.0, confidence: "medium" as const, basis: "高难度街健" };
        if (/难度a\+|难度a-|难度a/.test(text)) return { met: 7.5, confidence: "medium" as const, basis: "高强度街健" };
        if (/难度b/.test(text)) return { met: 6.0, confidence: "medium" as const, basis: "中高强度街健" };
        if (/难度d|难度c/.test(text)) return { met: 3.8, confidence: "medium" as const, basis: "轻中强度街健" };
        return { met: 6.0, confidence: "low" as const, basis: "街健综合" };
    }

    if (/爆发|大重量|力量举|深蹲|硬拉/.test(text)) return { met: 5.0, confidence: "medium" as const, basis: "高强度力量" };
    if (/循环|超级组|hiit/.test(text)) return { met: 5.8, confidence: "medium" as const, basis: "循环力量" };
    return { met: 3.5, confidence: "low" as const, basis: "多动作抗阻训练" };
}

function inferredDurationFromDistance(action: WorkoutEnergyActionInput): number | null {
    const distanceKm = Number(action.actualDistanceMeters || 0) / 1000;
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
    const text = actionText(action);
    const speedKmh = /快走/.test(text)
        ? 5.5
        : /单车|骑行/.test(text)
            ? 18
            : /游泳/.test(text)
                ? 2.2
                : /划船/.test(text)
                    ? 8
                    : /冲刺/.test(text)
                        ? 15
                        : 8;
    return clamp(distanceKm / speedKmh * 60, 1, 240);
}

function resolveDurations(actions: WorkoutEnergyActionInput[], elapsedMinutes: number) {
    const durations = actions.map((action) => {
        const seconds = Number(action.actualDurationSeconds || 0);
        if (Number.isFinite(seconds) && seconds > 0) return clamp(seconds / 60, 1 / 6, 240);
        if (String(action.type || "").toUpperCase() === "CARDIO") return inferredDurationFromDistance(action) || 0;
        return 0;
    });
    const exactMinutes = durations.reduce((sum, value) => sum + value, 0);
    const strengthSetTotal = actions.reduce((sum, action) => (
        String(action.type || "STRENGTH").toUpperCase() === "CARDIO"
            ? sum
            : sum + Math.max(0, action.completedSets)
    ), 0);
    const availableStrengthMinutes = Math.max(0, elapsedMinutes - exactMinutes);
    const strengthMinutes = strengthSetTotal > 0
        ? clamp(Math.min(availableStrengthMinutes || strengthSetTotal * 2.5, strengthSetTotal * 4), 1, 240)
        : 0;

    return durations.map((duration, index) => {
        if (duration > 0) return duration;
        const sets = Math.max(0, actions[index].completedSets);
        return strengthSetTotal > 0 ? strengthMinutes * sets / strengthSetTotal : 0;
    });
}

// 训练结束接口同步等这一步，所以中止时间要短。
const AI_ABORT_MS = 6_000;
const AI_REASON_MAX_CHARS = 40;
const CONFIDENCE_VALUES: ReadonlySet<string> = new Set(["high", "medium", "low"]);

interface AiCandidate {
    index: number;
    action: WorkoutEnergyActionInput;
    fallbackMet: number;
}

/**
 * 思考模式会把 6 秒中止时间全花在 reasoning 上：2026-11-05 实测 deepseek-v4.1-flash-1017 3/3 超时，
 * 关掉后约 3.3 秒返回。万界方舟上 deepseek 认 thinking.type，通义认 enable_thinking。
 */
function thinkingOffParams(model: string): Record<string, unknown> {
    const name = model.trim().toLowerCase();
    if (name.startsWith("deepseek")) return { thinking: { type: "disabled" } };
    if (name.startsWith("qwen")) return { enable_thinking: false };
    return {};
}

/** 去掉 markdown 代码块和前后说明文字，取第一个 { 到最后一个 } 之间的 JSON。 */
function parseJsonObject(raw: string): unknown {
    const cleaned = raw.replace(/```(?:json)?/gi, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("模型未返回 JSON 对象");
    return JSON.parse(cleaned.slice(start, end + 1));
}

/** 只保留 index 合法、不重复、MET 为正数的项；confidence 不认识时按 low，reason 只收短字符串。 */
function normalizeClassifications(payload: unknown, allowedIndexes: ReadonlySet<number>): ClassifiedAction[] {
    const list = Array.isArray(payload) ? payload : (payload as { actions?: unknown } | null)?.actions;
    if (!Array.isArray(list)) return [];
    const seen = new Set<number>();
    return list.flatMap((entry): ClassifiedAction[] => {
        if (!entry || typeof entry !== "object") return [];
        const item = entry as Record<string, unknown>;
        const index = Number(item.index);
        const met = Number(item.met ?? item.met_value ?? item.MET);
        if (!Number.isInteger(index) || !allowedIndexes.has(index) || seen.has(index)) return [];
        if (!Number.isFinite(met) || met <= 0) return [];
        seen.add(index);
        const confidence = typeof item.confidence === "string" && CONFIDENCE_VALUES.has(item.confidence)
            ? item.confidence as WorkoutEnergyConfidence
            : "low";
        const reason = typeof item.reason === "string" ? item.reason.trim().slice(0, AI_REASON_MAX_CHARS) : "";
        return [{ index, met, confidence, reason }];
    });
}

async function classifyWithAi(candidates: AiCandidate[]): Promise<ClassifiedAction[]> {
    if (candidates.length === 0) return [];
    const { client, model } = getCoachlinkFastLlm();
    const body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming = {
        model,
        temperature: 0,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: [
                    "你是运动代谢分类器，只负责依据2024 Adult Compendium给动作选择MET，不直接计算热量。",
                    "参考锚点：徒手中等3.8、徒手剧烈7.5、抗阻多动作3.5、深蹲硬拉5.0、抗阻剧烈6.0、一般有氧7.3、跳绳11.0。",
                    "不得因为动作难度高就无限提高MET；静态高难度动作也必须落在合理范围。",
                    '只输出 JSON 对象，不要 markdown。格式为 {"actions":[{"index":0,"met":5.0,"confidence":"medium","reason":"多关节下肢抗阻"}]}。',
                    "每个输入动作输出一项，index 与输入一致；met 取 1.5 到 16 之间的数值；confidence 只能是 high/medium/low；reason 不超过20个汉字。",
                ].join("\n"),
            },
            {
                role: "user",
                content: JSON.stringify(candidates.map(({ index, action, fallbackMet }) => ({
                    index,
                    name: action.name,
                    type: action.type,
                    attrs: action.attrs,
                    category: action.category,
                    fallbackMet,
                }))),
            },
        ],
    };
    const completion = await client.chat.completions.create(
        { ...body, ...thinkingOffParams(model) } as typeof body,
        { signal: AbortSignal.timeout(AI_ABORT_MS) },
    );
    const raw = completion.choices[0]?.message?.content?.trim() || "";
    if (!raw) throw new Error("模型返回空内容");
    return normalizeClassifications(parseJsonObject(raw), new Set(candidates.map((candidate) => candidate.index)));
}

export async function estimateWorkoutEnergy(input: {
    bodyWeightKg: number | null | undefined;
    elapsedMinutes: number;
    actions: WorkoutEnergyActionInput[];
}): Promise<WorkoutEnergyEstimate | null> {
    const bodyWeightKg = Number(input.bodyWeightKg);
    if (!Number.isFinite(bodyWeightKg) || bodyWeightKg < 25 || bodyWeightKg > 350) return null;
    const actions = input.actions.filter((action) => action.completedSets > 0 || Number(action.actualDurationSeconds || 0) > 0);
    if (actions.length === 0) return null;

    const elapsedMinutes = clamp(Number(input.elapsedMinutes) || 0, 1 / 6, 240);
    const durations = resolveDurations(actions, elapsedMinutes);
    const fallback = actions.map(deterministicMet);
    // 动作库里配了 MET 的动作直接用动作库，不问模型，模型结果也不能覆盖它。
    const candidates = actions.flatMap((action, index): AiCandidate[] => (
        itemSchemaMet(action) ? [] : [{ index, action, fallbackMet: fallback[index].met }]
    ));
    let classifications: ClassifiedAction[] = [];
    try {
        classifications = await classifyWithAi(candidates);
    } catch (error) {
        console.warn("[workout-energy] AI MET classification failed, deterministic fallback used:", error);
    }
    const aiAssisted = classifications.length > 0;

    const estimates = actions.map<WorkoutEnergyActionEstimate>((action, index) => {
        const ai = classifications.find((item) => item.index === index);
        const type = String(action.type || "STRENGTH").toUpperCase() === "CARDIO" ? "CARDIO" : "STRENGTH";
        const maxMet = type === "CARDIO" ? 16 : actionText(action).includes("街头健身") ? 9 : 7;
        const met = ai && Number.isFinite(Number(ai.met))
            ? clamp(Number(ai.met), 1.5, maxMet)
            : fallback[index].met;
        const minutes = durations[index];
        const calories = met * bodyWeightKg * minutes / 60;
        const activeCalories = Math.max(0, met - 1) * bodyWeightKg * minutes / 60;
        return {
            actionId: action.actionId || null,
            name: action.name,
            type,
            met: round(met),
            minutes: round(minutes),
            calories: round(calories),
            activeCalories: round(activeCalories),
            confidence: ai?.confidence || fallback[index].confidence,
            basis: ai?.reason || fallback[index].basis,
        };
    }).filter((item) => item.minutes > 0);

    if (estimates.length === 0) return null;
    const calories = estimates.reduce((sum, item) => sum + item.calories, 0);
    const activeCalories = estimates.reduce((sum, item) => sum + item.activeCalories, 0);
    const durationMinutes = estimates.reduce((sum, item) => sum + item.minutes, 0);
    const weightedMet = estimates.reduce((sum, item) => sum + item.met * item.minutes, 0) / durationMinutes;
    const confidenceOrder: Record<WorkoutEnergyConfidence, number> = { high: 2, medium: 1, low: 0 };
    const confidence = estimates.reduce<WorkoutEnergyConfidence>((current, item) => (
        confidenceOrder[item.confidence] < confidenceOrder[current] ? item.confidence : current
    ), "high");

    return {
        calories: round(clamp(calories, 0, 4000)),
        activeCalories: round(clamp(activeCalories, 0, 4000)),
        durationMinutes: round(durationMinutes),
        averageMet: round(weightedMet),
        bodyWeightKg: round(bodyWeightKg),
        confidence,
        method: aiAssisted ? "ai_assisted_2024_compendium" : "rules_2024_compendium",
        disclaimer: "基于体重、时长与2024 Adult Compendium MET的估算；未接入心率或呼吸代谢设备时不能视为实验室实测。",
        actions: estimates,
    };
}
