import type { CoachActionRow } from "@/types";
import type {
    CoachPlanAction,
    FormPlanTrainingDay,
} from "@/app/api/plan-lib/create-template/entity";
import { findBestExistingActionMatch } from "@/lib/planImportText";

export interface PlanScriptQuestionLite {
    question: string;
    options: string[];
}

export interface ParsePlanScriptParams {
    script: string;
    actions: Array<Pick<CoachActionRow, "id" | "name" | "type">>;
    questions?: PlanScriptQuestionLite[];
}

export interface ParsePlanScriptResult {
    description: string | null;
    days: FormPlanTrainingDay[];
}

function toDayIndex(weekIndex: number, dayOfWeek: number): number {
    return (weekIndex - 1) * 7 + dayOfWeek;
}

function parseIntensityToken(token: string): Record<string, any> {
    const trimmed = token.trim().toLowerCase();
    const rmMatch = trimmed.match(/^@(\d+(?:\.\d+)?)rm$/);
    if (rmMatch) {
        const value = Number(rmMatch[1]);
        return {
            强度: value,
            intensityConfig: {
                relativeIntensity: { type: "rm", value },
            },
        };
    }

    const percentMatch = trimmed.match(/^@(\d+(?:\.\d+)?)%$/);
    if (percentMatch) {
        const value = Number(percentMatch[1]);
        return {
            强度: `${value}%1RM`,
            intensityConfig: {
                relativeIntensity: { type: "percentage", value },
            },
        };
    }

    const kgMatch = trimmed.match(/^@(\d+(?:\.\d+)?)kg$/);
    if (kgMatch) {
        const value = Number(kgMatch[1]);
        return {
            load: value,
            intensityConfig: {
                fixedWeight: { value, unit: "kg" },
            },
        };
    }

    throw new Error(`无法解析强度标记：${token}`);
}

function normalizeScriptActionNameForExactMatch(name: string): string {
    return (name ?? "")
        .trim()
        .toLowerCase()
        .replace(/（/g, "(")
        .replace(/）/g, ")")
        .replace(/\s+/g, "");
}

function hasVariantMarker(name: string): boolean {
    return /[（(][^）)]*[）)]/.test(name ?? "");
}

function resolveScriptAction(
    actionName: string,
    actions: Array<Pick<CoachActionRow, "id" | "name" | "type">>,
): { id: string; name: string; score: number } {
    const exactName = normalizeScriptActionNameForExactMatch(actionName);
    const exactMatches = actions.filter(
        (action) => normalizeScriptActionNameForExactMatch(action.name) === exactName,
    );

    if (exactMatches.length === 1) {
        return { id: exactMatches[0].id, name: exactMatches[0].name, score: 1 };
    }

    if (exactMatches.length > 1) {
        throw new Error(`动作名称存在多个完全匹配项，请先合并或重命名：${actionName}`);
    }

    if (hasVariantMarker(actionName)) {
        throw new Error(`未找到精确动作：${actionName}。脚本动作名包含括号变体，为避免误匹配，不会自动降级为基础动作。`);
    }

    const match = findBestExistingActionMatch(actionName, actions);
    if (!match) {
        throw new Error(`未找到动作：${actionName}`);
    }
    return match;
}

function parseActionLine(
    line: string,
    actions: Array<Pick<CoachActionRow, "id" | "name" | "type">>,
): CoachPlanAction {
    let working = line.trim();
    let note = "";

    const noteSplit = working.split(/\s+#/);
    if (noteSplit.length > 1) {
        note = noteSplit.slice(1).join(" #").trim();
        working = noteSplit[0].trim();
    }

    const tokens = working.split(/\s+/).filter(Boolean);
    const params: Record<string, any> = {
        load: null,
        note,
        intensityConfig: null,
    };

    let sets: number | null = null;
    let reps: number | null = null;
    let durationSeconds: number | null = null;

    const remaining: string[] = [];
    for (const token of tokens) {
        const volumeMatch = token.match(/^(\d+)x(\d+)(s)?$/i);
        if (volumeMatch) {
            sets = Number(volumeMatch[1]);
            if (volumeMatch[3]) {
                durationSeconds = Number(volumeMatch[2]);
            } else {
                reps = Number(volumeMatch[2]);
            }
            continue;
        }

        const restMatch = token.match(/^r(\d+)$/i);
        if (restMatch) {
            params["休息时间"] = Number(restMatch[1]);
            continue;
        }

        if (token.startsWith("@")) {
            Object.assign(params, parseIntensityToken(token));
            continue;
        }

        remaining.push(token);
    }

    const actionName = remaining.join(" ").trim();
    if (!actionName) {
        throw new Error(`动作行缺少动作名称：${line}`);
    }

    const match = resolveScriptAction(actionName, actions);

    if (sets !== null) params["组数"] = sets;
    if (reps !== null) params["次数"] = reps;
    if (durationSeconds !== null) params["持续时间"] = durationSeconds;

    return {
        type: "no-filter",
        actionId: match.id,
        setName: actionName,
        params,
        itemType: actions.find((action) => action.id === match.id)?.type || "STRENGTH",
    } as CoachPlanAction;
}

export function formatTemplateToPlanScript(params: {
    description?: string | null;
    trainingDays: FormPlanTrainingDay[];
    actionNameById: Record<string, string>;
}): string {
    const { description, trainingDays, actionNameById } = params;
    const sortedDays = [...(trainingDays || [])].sort(
        (a, b) => (a.dayIndex || 0) - (b.dayIndex || 0),
    );
    const lines: string[] = [];

    if (description?.trim()) {
        for (const line of description.trim().split(/\r?\n/)) {
            lines.push(`> ${line.trim()}`);
        }
        lines.push("");
    }

    let currentWeek = -1;
    for (const day of sortedDays) {
        const weekIndex = Math.ceil((day.dayIndex || 0) / 7);
        const dayOfWeek = ((day.dayIndex || 1) - 1) % 7 + 1;
        if (weekIndex !== currentWeek) {
            if (lines.length > 0 && lines[lines.length - 1] !== "") {
                lines.push("");
            }
            lines.push(`W${weekIndex}`);
            currentWeek = weekIndex;
        }

        if (day.type === "rest") {
            const note = day.note?.trim() && day.note.trim() !== "休息日"
                ? ` #${day.note.trim()}`
                : "";
            lines.push(`D${dayOfWeek} off${note}`);
            continue;
        }

        lines.push(`D${dayOfWeek}`);
        if (day.note?.trim()) {
            lines.push(`!${day.note.trim()}`);
        }

        for (const actionSet of day.actionSets || []) {
            if ((actionSet as any).type !== "no-filter") {
                throw new Error("当前脚本模式暂不支持条件分支动作，请先使用普通编辑器处理该训练日。");
            }
            const set = actionSet as any;
            const actionName =
                actionNameById[String(set.actionId)] ||
                set.params?.action_name ||
                set.setName ||
                "未命名动作";
            const parts = [actionName];
            const sets = set.params?.["组数"];
            const reps = set.params?.["次数"];
            const durationSeconds = set.params?.["持续时间"];
            if (typeof sets === "number") {
                if (typeof durationSeconds === "number") {
                    parts.push(`${sets}x${durationSeconds}s`);
                } else if (typeof reps === "number") {
                    parts.push(`${sets}x${reps}`);
                }
            }

            const relative = set.params?.intensityConfig?.relativeIntensity;
            const fixedWeight = set.params?.intensityConfig?.fixedWeight;
            if (relative?.type === "rm" && typeof relative.value === "number") {
                parts.push(`@${relative.value}rm`);
            } else if (
                relative?.type === "percentage" &&
                typeof relative.value === "number"
            ) {
                parts.push(`@${relative.value}%`);
            } else if (
                typeof fixedWeight?.value === "number" &&
                Number.isFinite(fixedWeight.value)
            ) {
                parts.push(`@${fixedWeight.value}${fixedWeight.unit || "kg"}`);
            } else if (typeof set.params?.["强度"] === "number") {
                parts.push(`@${set.params["强度"]}rm`);
            }

            if (typeof set.params?.["休息时间"] === "number") {
                parts.push(`r${set.params["休息时间"]}`);
            }

            if (typeof set.params?.note === "string" && set.params.note.trim()) {
                parts.push(`#${set.params.note.trim()}`);
            }

            lines.push(parts.join(" "));
        }

        lines.push("");
    }

    return lines.join("\n").trim();
}

export function parsePlanScript({
    script,
    actions,
}: ParsePlanScriptParams): ParsePlanScriptResult {
    const lines = String(script || "").replace(/\r\n/g, "\n").split("\n");
    const descriptionLines: string[] = [];
    const days = new Map<number, FormPlanTrainingDay>();

    let currentWeek = 0;
    let currentDay: FormPlanTrainingDay | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith(">")) {
            descriptionLines.push(line.slice(1).trim());
            continue;
        }

        const weekMatch = line.match(/^W(\d+)$/i);
        if (weekMatch) {
            currentWeek = Number(weekMatch[1]);
            currentDay = null;
            continue;
        }

        const restDayMatch = line.match(/^D(\d+)\s+off(?:\s+(?:#|!)(.*))?$/i);
        if (restDayMatch) {
            if (!currentWeek) throw new Error(`休息日出现在周标题之前：${line}`);
            const dayOfWeek = Number(restDayMatch[1]);
            currentDay = {
                dayIndex: toDayIndex(currentWeek, dayOfWeek),
                type: "rest",
                note: restDayMatch[2]?.trim() || "休息日",
                actionSets: [],
            };
            days.set(currentDay.dayIndex, currentDay);
            continue;
        }

        const dayMatch = line.match(/^D(\d+)$/i);
        if (dayMatch) {
            if (!currentWeek) throw new Error(`训练日出现在周标题之前：${line}`);
            const dayOfWeek = Number(dayMatch[1]);
            currentDay = {
                dayIndex: toDayIndex(currentWeek, dayOfWeek),
                type: "training",
                note: "",
                actionSets: [],
            };
            days.set(currentDay.dayIndex, currentDay);
            continue;
        }

        if (!currentDay) {
            throw new Error(`无法识别的脚本行：${line}`);
        }

        if (line.startsWith("!")) {
            currentDay.note = line.slice(1).trim();
            continue;
        }

        if (currentDay.type !== "training") {
            throw new Error(`休息日不能包含动作行：${line}`);
        }

        currentDay.actionSets = currentDay.actionSets || [];
        currentDay.actionSets.push(parseActionLine(line, actions));
    }

    const resultDays = Array.from(days.values()).sort(
        (a, b) => (a.dayIndex || 0) - (b.dayIndex || 0),
    );

    return {
        description: descriptionLines.length > 0 ? descriptionLines.join("\n") : null,
        days: resultDays,
    };
}
