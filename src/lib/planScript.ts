import type { CoachActionRow } from "@/types";
import type {
    CoachPlanAction,
    FormPlanTrainingDay,
} from "@/app/api/plan-lib/create-template/entity";
import { findBestExistingActionMatch } from "@/lib/planImportText";
import type { OneRmAdjustmentDraft } from "@/lib/oneRmAdjustments";

export interface PlanScriptQuestionLite {
    question: string;
    options: string[];
}

export interface ParsePlanScriptParams {
    script: string;
    actions: Array<Pick<CoachActionRow, "id" | "name" | "type">>;
    questions?: PlanScriptQuestionLite[];
    /**
     * When true, unknown action names are preserved as pending actions instead of
     * being force-matched or rejected. The caller can then ask the user to map or
     * create them before saving.
     */
    allowPendingActions?: boolean;
}

export interface ParsePlanScriptResult {
    description: string | null;
    days: FormPlanTrainingDay[];
    oneRmAdjustments: OneRmAdjustmentDraft[];
}

function parseOneRmDirective(line: string): OneRmAdjustmentDraft | null {
    const match = line.match(/^1RM\s+(.+?)\s*(\+=|-=|=)\s*(\d+(?:\.\d+)?)\s*kg(?:\s+#\s*(.*))?$/i);
    if (!match) return null;

    const actionName = match[1].trim();
    const operator = match[2];
    const value = Number(match[3]);
    const reason = match[4]?.trim() || null;
    if (!actionName || !Number.isFinite(value) || value <= 0) return null;

    if (operator === "=") {
        return { actionName, targetOneRM: value, reason };
    }
    return {
        actionName,
        deltaKg: operator === "-=" ? -value : value,
        reason,
    };
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

    const lbsMatch = trimmed.match(/^@(\d+(?:\.\d+)?)(?:lbs?|磅)$/);
    if (lbsMatch) {
        const value = Number(lbsMatch[1]);
        return {
            load: value,
            loadUnit: "lbs",
            intensityConfig: {
                fixedWeight: { value, unit: "lbs" },
            },
        };
    }

    throw new Error(`无法解析强度标记：${token}`);
}

// 备注里的换行写成字面量 \n（反斜杠本身写成 \\）：原样换行会让下一行被当成动作行，变成假的待确认动作。
function encodeScriptText(text: string): string {
    return String(text ?? "").trim().replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n");
}

function decodeScriptText(text: string): string {
    return String(text ?? "").replace(/\\(\\|n)/g, (_, escaped) => (escaped === "n" ? "\n" : "\\")).trim();
}

function isConditionalActionSet(actionSet: any): boolean {
    return actionSet?.type === "one-filter" || Array.isArray(actionSet?.actions);
}

function readParamNumber(params: any, keys: string[]): number | null {
    for (const key of keys) {
        const value = params?.[key];
        if (value === null || value === undefined || value === "") continue;
        const n = Number(value);
        if (Number.isFinite(n)) return n;
    }
    return null;
}

type ScriptSetParts = {
    name: string;
    volume: string;
    intensity: string;
    rest: string;
    note: string;
};

function formatVolumePart(params: any): string {
    const sets = readParamNumber(params, ["组数", "sets"]);
    const setRangeMin = readParamNumber(params, ["组数下限"]);
    const setRangeMax = readParamNumber(params, ["组数上限"]);
    const reps = readParamNumber(params, ["次数", "reps"]);
    const durationSeconds = readParamNumber(params, ["持续时间", "durationSeconds", "duration_seconds"]);
    if (setRangeMin !== null && setRangeMax !== null && setRangeMin !== setRangeMax) {
        if (durationSeconds !== null) return `${setRangeMin}-${setRangeMax}x${durationSeconds}s`;
        if (reps !== null) return `${setRangeMin}-${setRangeMax}x${reps}`;
        return "";
    }
    if (sets === null) return "";
    if (durationSeconds !== null) return `${sets}x${durationSeconds}s`;
    if (reps !== null) return `${sets}x${reps}`;
    return "";
}

function formatIntensityPart(params: any): string {
    const relative = params?.intensityConfig?.relativeIntensity;
    const fixedWeight = params?.intensityConfig?.fixedWeight;
    if (relative?.type === "rm" && typeof relative.value === "number") return `@${relative.value}rm`;
    if (relative?.type === "percentage" && typeof relative.value === "number") return `@${relative.value}%`;
    if (typeof fixedWeight?.value === "number" && Number.isFinite(fixedWeight.value)) {
        return `@${fixedWeight.value}${fixedWeight.unit === "lbs" ? "lbs" : "kg"}`;
    }

    const legacy = params?.["强度"];
    if (typeof legacy === "number" && Number.isFinite(legacy)) return `@${legacy}rm`;
    if (typeof legacy === "string") {
        const percent = legacy.match(/^\s*(\d+(?:\.\d+)?)\s*%/);
        if (percent) return `@${Number(percent[1])}%`;
        const rm = legacy.match(/^\s*(\d+(?:\.\d+)?)\s*rm\s*$/i);
        if (rm) return `@${Number(rm[1])}rm`;
    }

    // 旧数据只把固定重量存在 load / weight 上，没有 intensityConfig。
    const load = readParamNumber(params, ["load", "weight"]);
    if (load !== null && load > 0) return `@${load}${params?.loadUnit === "lbs" ? "lbs" : "kg"}`;
    return "";
}

function formatActionSetParts(set: any, actionNameById: Record<string, string>): ScriptSetParts {
    const rest = readParamNumber(set?.params, ["休息时间", "rest_seconds", "restSeconds"]);
    const note = typeof set?.params?.note === "string" ? encodeScriptText(set.params.note) : "";
    return {
        name: actionNameById[String(set?.actionId)] || set?.params?.action_name || set?.setName || "未命名动作",
        volume: formatVolumePart(set?.params),
        intensity: formatIntensityPart(set?.params),
        rest: rest !== null ? `r${rest}` : "",
        note,
    };
}

function formatDayNotePart(day: any): string {
    const note = encodeScriptText(day?.note || "");
    if (day?.type === "rest") return note && note !== "休息日" ? note : "";
    return note;
}

const VOLUME_PARAM_KEYS = ["组数", "组数下限", "组数上限", "次数", "持续时间", "sets", "reps", "durationSeconds", "duration_seconds"];
const INTENSITY_PARAM_KEYS = ["强度", "intensityConfig", "load", "weight", "loadUnit"];
const REST_PARAM_KEYS = ["休息时间", "rest_seconds", "restSeconds"];

/**
 * 脚本只表达 组数/次数/强度/休息/备注。同一动作的脚本片段没变时保留原始参数，
 * 这样推荐负重、loadUnit、字符串强度、有氧/习惯参数等脚本写不出的字段不会丢。
 */
function mergeScriptActionSet(base: any, parsed: any, actionNameById: Record<string, string>): any {
    const before = formatActionSetParts(base, actionNameById);
    const after = formatActionSetParts(parsed, actionNameById);
    const parsedParams = parsed?.params || {};
    const params: Record<string, any> = { ...(base?.params || {}) };
    const take = (keys: string[]) => {
        for (const key of keys) delete params[key];
        for (const key of keys) {
            const value = parsedParams[key];
            if (value !== null && value !== undefined) params[key] = value;
        }
    };

    if (before.volume !== after.volume) take(VOLUME_PARAM_KEYS);
    if (before.intensity !== after.intensity) {
        const recommendedLoad = base?.params?.intensityConfig?.recommendedLoad;
        const hadWeight = base?.params?.weight !== undefined;
        take(INTENSITY_PARAM_KEYS);
        if (recommendedLoad && params.intensityConfig?.relativeIntensity) {
            params.intensityConfig = { ...params.intensityConfig, recommendedLoad };
        }
        if (hadWeight && typeof params.load === "number") params.weight = params.load;
        // 只改了 RM/百分比时保留原来的重量单位；改成固定重量时以脚本写的单位为准
        if (!params.intensityConfig?.fixedWeight && base?.params?.loadUnit && !params.loadUnit) {
            params.loadUnit = base.params.loadUnit;
        }
    }
    if (before.rest !== after.rest) take(REST_PARAM_KEYS);
    if (before.note !== after.note) params.note = parsedParams.note ?? "";

    return { ...base, params };
}

/**
 * 把一个脚本补丁日合并回原训练日：日级字段（id 等）保留，同一动作按位置（其次按出现顺序）
 * 继承原参数，换掉或新增的动作直接使用补丁内容。
 */
export function mergePlanScriptDayPatch(
    originalDay: FormPlanTrainingDay | null | undefined,
    patchedDay: FormPlanTrainingDay,
    actionNameById: Record<string, string>,
): FormPlanTrainingDay {
    if (!originalDay) return patchedDay;
    const baseSets: any[] = originalDay.type === "training" ? ((originalDay.actionSets as any[]) || []) : [];
    const used = new Set<number>();
    const pickBase = (set: any, index: number) => {
        const actionId = String(set?.actionId || "");
        const canUse = (candidate: any, candidateIndex: number) =>
            !used.has(candidateIndex) &&
            !isConditionalActionSet(candidate) &&
            String(candidate?.actionId || "") === actionId;
        if (baseSets[index] && canUse(baseSets[index], index)) {
            used.add(index);
            return baseSets[index];
        }
        const found = baseSets.findIndex((candidate, candidateIndex) => canUse(candidate, candidateIndex));
        if (found < 0) return null;
        used.add(found);
        return baseSets[found];
    };

    const actionSets = ((patchedDay.actionSets as any[]) || []).map((set, index) => {
        const base = pickBase(set, index);
        return base ? mergeScriptActionSet(base, set, actionNameById) : set;
    });
    const sameNote = formatDayNotePart(originalDay) === formatDayNotePart(patchedDay) &&
        originalDay.type === patchedDay.type;

    return {
        ...originalDay,
        dayIndex: patchedDay.dayIndex,
        type: patchedDay.type,
        note: sameNote ? originalDay.note : patchedDay.note,
        actionSets,
    } as FormPlanTrainingDay;
}

/**
 * 脚本编辑器“应用整份脚本”：脚本里的天按 dayIndex 合并回原训练日（保留脚本写不出的字段），
 * 脚本里删掉的天随之删除。
 */
export function mergePlanScriptPlan(
    trainingDays: FormPlanTrainingDay[],
    scriptDays: FormPlanTrainingDay[],
    actionNameById: Record<string, string>,
): FormPlanTrainingDay[] {
    const originals = new Map(
        (trainingDays || []).map((day) => [Number(day?.dayIndex || 0), day]),
    );
    return (scriptDays || []).map((day) =>
        mergePlanScriptDayPatch(originals.get(Number(day?.dayIndex || 0)), day, actionNameById),
    );
}

export function mergePlanScriptDayPatches(
    trainingDays: FormPlanTrainingDay[],
    patchedDays: FormPlanTrainingDay[],
    actionNameById: Record<string, string>,
): FormPlanTrainingDay[] {
    const patches = new Map(
        (patchedDays || []).map((day) => [Number(day?.dayIndex || 0), day]),
    );
    return (trainingDays || []).map((day) => {
        const patch = patches.get(Number(day?.dayIndex || 0));
        return patch ? mergePlanScriptDayPatch(day, patch, actionNameById) : day;
    });
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

type ParsedVolumeToken = {
    sets: number | null;
    reps: number | null;
    durationSeconds: number | null;
    setRangeMin?: number;
    setRangeMax?: number;
};

function parseVolumeToken(token: string): ParsedVolumeToken | null {
    const setRangeMatch = token.match(/^(\d+)-(\d+)x(\d+)(s)?$/i);
    if (setRangeMatch) {
        const min = Number(setRangeMatch[1]);
        const max = Number(setRangeMatch[2]);
        const value = Number(setRangeMatch[3]);
        if (max < min) {
            throw new Error(`组数范围无效：${token}`);
        }
        return {
            sets: min,
            reps: setRangeMatch[4] ? null : value,
            durationSeconds: setRangeMatch[4] ? value : null,
            setRangeMin: min,
            setRangeMax: max,
        };
    }

    const volumeMatch = token.match(/^(\d+)x(\d+)(s)?$/i);
    if (volumeMatch) {
        return {
            sets: Number(volumeMatch[1]),
            reps: volumeMatch[3] ? null : Number(volumeMatch[2]),
            durationSeconds: volumeMatch[3] ? Number(volumeMatch[2]) : null,
        };
    }

    return null;
}

function resolveScriptAction(
    actionName: string,
    actions: Array<Pick<CoachActionRow, "id" | "name" | "type">>,
    allowPendingActions = false,
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

    if (allowPendingActions) {
        const pendingKey = exactName
            .replace(/[^\p{L}\p{N}]+/gu, "")
            .slice(0, 48);
        return {
            id: `pending:${pendingKey || "unnamed"}`,
            name: actionName,
            score: 0,
        };
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
    allowPendingActions = false,
): CoachPlanAction {
    let working = line.trim();
    let note = "";

    const noteSplit = working.split(/\s+#/);
    if (noteSplit.length > 1) {
        note = decodeScriptText(noteSplit.slice(1).join(" #"));
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
    let setRangeMin: number | null = null;
    let setRangeMax: number | null = null;

    const remaining: string[] = [];
    for (const token of tokens) {
        const volume = parseVolumeToken(token);
        if (volume) {
            sets = volume.sets;
            reps = volume.reps;
            durationSeconds = volume.durationSeconds;
            setRangeMin = volume.setRangeMin ?? null;
            setRangeMax = volume.setRangeMax ?? null;
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

    const match = resolveScriptAction(actionName, actions, allowPendingActions);

    if (sets !== null) params["组数"] = sets;
    if (setRangeMin !== null && setRangeMax !== null) {
        params["组数下限"] = setRangeMin;
        params["组数上限"] = setRangeMax;
    }
    if (reps !== null) params["次数"] = reps;
    if (durationSeconds !== null) params["持续时间"] = durationSeconds;

    const nextParams = match.id.startsWith("pending:")
        ? {
            ...params,
            action_name: actionName,
        }
        : params;

    return {
        type: "no-filter",
        actionId: match.id,
        setName: actionName,
        params: nextParams,
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

        const dayNote = formatDayNotePart(day);
        if (day.type === "rest") {
            lines.push(`D${dayOfWeek} off${dayNote ? ` #${dayNote}` : ""}`);
            continue;
        }

        lines.push(`D${dayOfWeek}`);
        if (dayNote) {
            lines.push(`!${dayNote}`);
        }

        for (const actionSet of day.actionSets || []) {
            // 旧数据的普通动作可能没有 type；只有带 actions 的 one-filter 才是条件分支。
            if (isConditionalActionSet(actionSet)) {
                throw new Error("当前脚本模式暂不支持条件分支动作，请先使用普通编辑器处理该训练日。");
            }
            const parts = formatActionSetParts(actionSet, actionNameById);
            lines.push([
                parts.name,
                parts.volume,
                parts.intensity,
                parts.rest,
                parts.note ? `#${parts.note}` : "",
            ].filter(Boolean).join(" "));
        }

        lines.push("");
    }

    return lines.join("\n").trim();
}

export function parsePlanScript({
    script,
    actions,
    allowPendingActions = false,
}: ParsePlanScriptParams): ParsePlanScriptResult {
    const lines = String(script || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .flatMap((rawLine) => {
            const trimmed = rawLine.trim();
            const combinedWeekDayMatch = trimmed.match(/^(W\d+)\s+(D\d+(?:\s+off(?:\s+(?:#|!).*)?)?)$/i);
            if (!combinedWeekDayMatch) {
                return [rawLine];
            }
            return [combinedWeekDayMatch[1], combinedWeekDayMatch[2]];
        });
    const descriptionLines: string[] = [];
    const days = new Map<number, FormPlanTrainingDay>();
    const oneRmAdjustments: OneRmAdjustmentDraft[] = [];

    let currentWeek = 0;
    let currentDay: FormPlanTrainingDay | null = null;

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;

        if (line.startsWith(">")) {
            descriptionLines.push(line.slice(1).trim());
            continue;
        }

        const oneRmDirective = parseOneRmDirective(line);
        if (oneRmDirective) {
            oneRmAdjustments.push(oneRmDirective);
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
                note: decodeScriptText(restDayMatch[2] || "") || "休息日",
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
            currentDay.note = decodeScriptText(line.slice(1));
            continue;
        }

        if (currentDay.type !== "training") {
            throw new Error(`休息日不能包含动作行：${line}`);
        }

        currentDay.actionSets = currentDay.actionSets || [];
        currentDay.actionSets.push(parseActionLine(line, actions, allowPendingActions));
    }

    const resultDays = Array.from(days.values()).sort(
        (a, b) => (a.dayIndex || 0) - (b.dayIndex || 0),
    );

    return {
        description: descriptionLines.length > 0 ? descriptionLines.join("\n") : null,
        days: resultDays,
        oneRmAdjustments,
    };
}
