/**
 * 计划 AI 助手的结果整理：把模型改过的 trainingDays 规范成编辑器口径，并计算真实差异。
 *
 * 计划里力量参数的规范键是中文（组数/次数/持续时间/休息时间）。模型常写英文键
 * （sets/reps/rest_seconds），这里把本轮新写的英文值折回中文键并删掉英文别名，
 * 否则小程序（优先读英文键）和差异统计（读中文键）会看到两份不同的数字。
 */
import type { ItemType } from "@/types";
import type { ModificationDiff } from "@/app/api/plan-lib/batch-operation/entity";
import type { OneRmAdjustmentDraft } from "@/lib/oneRmAdjustments";

const ITEM_TYPES: ItemType[] = ["STRENGTH", "CARDIO", "DIET", "HABIT"];

export type PlanAssistantActionLite = {
    id: string;
    name?: string | null;
    type?: string | null;
};

export function normalizeItemType(input?: unknown): ItemType {
    const raw = String(input ?? "").toUpperCase();
    if (ITEM_TYPES.includes(raw as ItemType)) return raw as ItemType;
    return "STRENGTH";
}

/** 代码沙箱里的动作目录：必须带 type，否则 findActionById(id)?.type 永远落回 STRENGTH。 */
export function buildVmActionCatalog(actions: PlanAssistantActionLite[]): Array<{ id: string; name: string; type: ItemType }> {
    return (actions || []).map((action) => ({
        id: String(action.id),
        name: String(action.name || ""),
        type: normalizeItemType(action.type),
    }));
}

export function firstDefinedNumber(...values: any[]): number | null {
    for (const value of values) {
        if (value === null || value === undefined || value === "") continue;
        const n = Number(value);
        if (!Number.isNaN(n)) return n;
    }
    return null;
}

type ParamAlias = {
    key: string;
    aliases: string[];
    /** true：别名是仍在使用的旧字段（weight），保留并与规范值同步；false：折回规范键后删除别名。 */
    keepAliases?: boolean;
    /** true：只接受数字（重量）；否则 "8-12" 这类文字次数也原样保留。 */
    numericOnly?: boolean;
};

const STRENGTH_PARAM_ALIASES: ParamAlias[] = [
    { key: "组数", aliases: ["sets"] },
    { key: "次数", aliases: ["reps"] },
    { key: "持续时间", aliases: ["durationSeconds", "duration_seconds"] },
    { key: "休息时间", aliases: ["rest_seconds", "restSeconds"] },
    { key: "load", aliases: ["weight"], keepAliases: true, numericOnly: true },
];

/** 数字串转数字；其余非空文字原样返回。 */
function toParamValue(value: unknown, numericOnly = false): number | string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = String(value).trim();
    if (!text) return null;
    const n = Number(text);
    if (Number.isFinite(n)) return n;
    return numericOnly ? null : text;
}

function resolveAliasedValue(src: any, previous: any, entry: ParamAlias): number | string | null {
    // 本轮新写的英文值（上一版没有，或与上一版不同）比留在原处的中文旧值更新。
    for (const alias of entry.aliases) {
        const value = toParamValue(src[alias], entry.numericOnly);
        if (value === null) continue;
        if (toParamValue(previous?.[alias], entry.numericOnly) !== value) return value;
    }
    for (const key of [entry.key, ...entry.aliases]) {
        const value = toParamValue(src[key], entry.numericOnly);
        if (value !== null) return value;
    }
    return null;
}

export function normalizeStrengthParamsForEditor(params: any, previousParams?: any): any {
    const src = params || {};
    const previous = previousParams || {};
    const next: Record<string, any> = { ...src };

    for (const entry of STRENGTH_PARAM_ALIASES) {
        const value = resolveAliasedValue(src, previous, entry);
        if (value !== null) next[entry.key] = value;
        for (const alias of entry.aliases) {
            if (!(alias in next)) continue;
            if (entry.keepAliases) {
                if (value !== null) next[alias] = value;
            } else if (value !== null || toParamValue(next[alias]) === null) {
                // 只有值已折回规范键（或别名本身为空）时才删，避免丢掉读不出来的值
                delete next[alias];
            }
        }
    }

    if (next.load === undefined) {
        const fixedWeight = firstDefinedNumber(
            src.fixedWeight,
            src.intensityConfig?.fixedWeight?.value,
            src.intensityConfig?.fixedWeight,
        );
        if (fixedWeight !== null) next.load = fixedWeight;
    }
    return next;
}

function isOneFilterSet(actionSet: any): boolean {
    return actionSet?.type === "one-filter" && Array.isArray(actionSet?.actions);
}

export function normalizeActionSetForEditor(
    actionSet: any,
    actionTypeMap: Map<string, ItemType>,
    previousSet?: any,
): any {
    if (!actionSet || typeof actionSet !== "object") return actionSet;
    if (isOneFilterSet(actionSet)) {
        const previousInner = isOneFilterSet(previousSet) ? previousSet.actions : [];
        return {
            ...actionSet,
            actions: actionSet.actions.map((inner: any, index: number) =>
                normalizeActionSetForEditor(inner, actionTypeMap, previousInner[index]),
            ),
        };
    }

    const actionId = String(actionSet.actionId || "");
    // 动作库是类型的唯一来源：apply-batch-operation 会拒绝与动作库不一致的 itemType。
    const libraryType = actionTypeMap.get(actionId);
    const itemType = libraryType || normalizeItemType(actionSet.itemType);
    const next = {
        ...actionSet,
        type: actionSet.type || "no-filter",
        itemType,
    };

    if (itemType === "STRENGTH") {
        const comparablePrevious = previousSet && String(previousSet.actionId || "") === actionId
            ? previousSet.params
            : undefined;
        next.params = normalizeStrengthParamsForEditor(actionSet.params, comparablePrevious);
    }
    return next;
}

function getDayIndex(day: any, fallback: number): number {
    const value = Number(day?.dayIndex);
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function normalizeTrainingDaysForEditor(
    trainingDays: any[],
    actions: PlanAssistantActionLite[],
    previousTrainingDays: any[] = [],
): any[] {
    const actionTypeMap = new Map<string, ItemType>();
    for (const action of actions || []) {
        actionTypeMap.set(String(action.id), normalizeItemType(action.type));
    }
    const previousByDay = new Map(
        (previousTrainingDays || []).map((day, index) => [getDayIndex(day, index + 1), day]),
    );
    return (trainingDays || []).map((day, index) => {
        const previousSets: any[] = previousByDay.get(getDayIndex(day, index + 1))?.actionSets || [];
        const used = new Set<number>();
        // 上一版的同一动作：同位置同 id 优先，否则取第一个未用过的同 id 动作（删掉前面的动作后位置会错开）
        const findPrevious = (set: any, setIndex: number) => {
            const actionId = String(set?.actionId || "");
            const matches = (candidate: any, candidateIndex: number) =>
                !used.has(candidateIndex) && String(candidate?.actionId || "") === actionId;
            let found = previousSets[setIndex] && matches(previousSets[setIndex], setIndex) ? setIndex : -1;
            if (found < 0) found = previousSets.findIndex(matches);
            if (found < 0) return undefined;
            used.add(found);
            return previousSets[found];
        };
        return {
            ...day,
            actionSets: (day?.actionSets || []).map((set: any, setIndex: number) =>
                normalizeActionSetForEditor(set, actionTypeMap, findPrevious(set, setIndex)),
            ),
        };
    });
}

// ---------------------------------------------------------------------------
// 差异
// ---------------------------------------------------------------------------

function readParamValue(params: any, key: string, aliases: string[] = []): number | string | null {
    for (const candidate of [key, ...aliases]) {
        const value = toParamValue(params?.[candidate]);
        if (value !== null) return value;
    }
    return null;
}

const readSets = (params: any) => readParamValue(params, "组数", ["sets"]);
const readReps = (params: any) => readParamValue(params, "次数", ["reps"]);
const readDuration = (params: any) => readParamValue(params, "持续时间", ["durationSeconds", "duration_seconds"]);
const readRest = (params: any) => readParamValue(params, "休息时间", ["rest_seconds", "restSeconds"]);
// 与 normalizeStrengthParamsForEditor 读取同样的旧字段，规范化不会被当成重量变化
const readFixedLoad = (params: any) => firstDefinedNumber(
    params?.load,
    params?.weight,
    params?.fixedWeight,
    params?.intensityConfig?.fixedWeight?.value,
    typeof params?.intensityConfig?.fixedWeight === "number" ? params.intensityConfig.fixedWeight : null,
);

function describeVolume(params: any): string {
    const sets = readSets(params);
    const reps = readReps(params);
    const duration = readDuration(params);
    if (sets === null && reps === null && duration === null) return "";
    if (duration !== null) return `${sets ?? 0}组 × ${duration}秒`;
    return `${sets ?? 0}组 × ${reps ?? 0}次`;
}

function describeSet(actionName: string, set: any): string {
    const volume = describeVolume(set?.params);
    return volume ? `${actionName} (${volume})` : actionName;
}

function describeIntensity(params: any): string {
    const relative = params?.intensityConfig?.relativeIntensity;
    if (relative && relative.value !== undefined && relative.value !== null) {
        return relative.type === "percentage" ? `${relative.value}%` : `${relative.value}RM`;
    }
    const legacy = params?.["强度"];
    if (legacy === null || legacy === undefined || legacy === "") return "无";
    return typeof legacy === "number" ? `${legacy}RM` : String(legacy);
}

function describeRecommendedLoad(params: any): string {
    const recommended = params?.intensityConfig?.recommendedLoad;
    if (!recommended || recommended.value === undefined || recommended.value === null) return "无";
    return `${recommended.value}${recommended.unit || "kg"}`;
}

function describeLoadUnit(params: any): string {
    return params?.intensityConfig?.fixedWeight?.unit || params?.loadUnit || "kg";
}

// 由上面专门字段比较过的参数；其余参数（有氧距离、习惯目标值等）按键逐一比较。
const HANDLED_PARAM_KEYS = new Set([
    "组数", "sets", "次数", "reps", "持续时间", "durationSeconds", "duration_seconds",
    "休息时间", "rest_seconds", "restSeconds", "load", "weight", "fixedWeight", "loadUnit",
    "intensityConfig", "强度", "note", "action_name", "组数下限", "组数上限",
]);

function stableJson(value: unknown): string {
    if (value === undefined) return "undefined";
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
    const entries = Object.keys(value as Record<string, unknown>)
        .filter((key) => (value as any)[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${stableJson((value as any)[key])}`);
    return `{${entries.join(",")}}`;
}

/**
 * 计划内容指纹（键排序后的 JSON）。模板保存不会更新 updated_at，应用 AI 草稿前用它判断
 * 数据库里的计划是否已不是预览时的那一版。
 */
export function trainingDaysFingerprint(trainingDays: unknown): string {
    return stableJson(Array.isArray(trainingDays) ? trainingDays : []);
}

function isEmptyValue(value: unknown): boolean {
    return value === null || value === undefined || value === "";
}

function compareSetParams(
    push: (field: string, oldValue: any, newValue: any) => void,
    origParams: any,
    updParams: any,
) {
    const numericFields: Array<[string, (params: any) => number | string | null, string]> = [
        ["组数", readSets, ""],
        ["次数", readReps, ""],
        ["持续时间", readDuration, "秒"],
        ["休息时间", readRest, "秒"],
    ];
    for (const [field, read, unit] of numericFields) {
        const before = read(origParams);
        const after = read(updParams);
        if (before !== after) push(field, `${before ?? 0}${unit}`, `${after ?? 0}${unit}`);
    }

    const rangeBefore = [origParams?.["组数下限"], origParams?.["组数上限"]];
    const rangeAfter = [updParams?.["组数下限"], updParams?.["组数上限"]];
    if (stableJson(rangeBefore) !== stableJson(rangeAfter)) {
        const fmt = (range: any[]) => (isEmptyValue(range[0]) && isEmptyValue(range[1]) ? "无" : `${range[0] ?? "?"}-${range[1] ?? "?"}组`);
        push("组数范围", fmt(rangeBefore), fmt(rangeAfter));
    }

    const loadBefore = readFixedLoad(origParams);
    const loadAfter = readFixedLoad(updParams);
    const unitBefore = describeLoadUnit(origParams);
    const unitAfter = describeLoadUnit(updParams);
    if ((loadBefore !== loadAfter || unitBefore !== unitAfter) && (loadBefore !== null || loadAfter !== null)) {
        push("重量", `${loadBefore ?? 0}${unitBefore}`, `${loadAfter ?? 0}${unitAfter}`);
    }

    const intensityBefore = describeIntensity(origParams);
    const intensityAfter = describeIntensity(updParams);
    if (intensityBefore !== intensityAfter) push("强度", intensityBefore, intensityAfter);

    const recommendedBefore = describeRecommendedLoad(origParams);
    const recommendedAfter = describeRecommendedLoad(updParams);
    if (recommendedBefore !== recommendedAfter) push("推荐负重", recommendedBefore, recommendedAfter);

    const noteBefore = origParams?.note;
    const noteAfter = updParams?.note;
    if ((noteBefore || "") !== (noteAfter || "")) push("备注", noteBefore || "无", noteAfter || "无");

    const otherKeys = new Set([
        ...Object.keys(origParams || {}),
        ...Object.keys(updParams || {}),
    ].filter((key) => !HANDLED_PARAM_KEYS.has(key)));
    for (const key of otherKeys) {
        const before = origParams?.[key];
        const after = updParams?.[key];
        if (isEmptyValue(before) && isEmptyValue(after)) continue;
        if (stableJson(before) !== stableJson(after)) push(key, before ?? "无", after ?? "无");
    }
}

const dayTypeLabel = (day: any) => (day?.type === "training" ? "训练日" : "休息日");

/** 按 dayIndex 对齐比较两版计划；参数读取兼容中文规范键和英文别名。 */
export function analyzeModifications(
    original: any[],
    updated: any[],
    actions: Array<{ id: string; name?: string | null }>,
): ModificationDiff[] {
    const modifications: ModificationDiff[] = [];
    const actionMap = new Map((actions || []).map((action) => [String(action.id), String(action.name || "")]));
    const nameOf = (set: any) =>
        actionMap.get(String(set?.actionId || "")) || set?.params?.action_name || set?.setName || "未知动作";

    const originalByDay = new Map((original || []).map((day, index) => [getDayIndex(day, index + 1), day]));
    const updatedByDay = new Map((updated || []).map((day, index) => [getDayIndex(day, index + 1), day]));
    const dayIndexes = Array.from(new Set([...originalByDay.keys(), ...updatedByDay.keys()])).sort((a, b) => a - b);

    for (const dayIndex of dayIndexes) {
        const origDay = originalByDay.get(dayIndex);
        const updDay = updatedByDay.get(dayIndex);

        if (origDay && !updDay) {
            modifications.push({ dayIndex, actionName: "整个训练日", field: "删除", oldValue: dayTypeLabel(origDay), newValue: "已删除" });
            continue;
        }
        if (!origDay && updDay) {
            modifications.push({ dayIndex, actionName: "整个训练日", field: "添加", oldValue: "无", newValue: dayTypeLabel(updDay) });
            continue;
        }
        if (!origDay || !updDay) continue;

        if (origDay.type !== updDay.type) {
            modifications.push({ dayIndex, actionName: "训练日类型", field: "type", oldValue: dayTypeLabel(origDay), newValue: dayTypeLabel(updDay) });
        }
        if ((origDay.note || "") !== (updDay.note || "")) {
            modifications.push({ dayIndex, actionName: "备注", field: "note", oldValue: origDay.note || "无", newValue: updDay.note || "无" });
        }

        const origSets = origDay.actionSets || [];
        const updSets = updDay.actionSets || [];
        for (let j = 0; j < Math.max(origSets.length, updSets.length); j++) {
            const origSet = origSets[j];
            const updSet = updSets[j];
            if (!origSet && updSet) {
                const actionName = nameOf(updSet);
                modifications.push({ dayIndex, actionName, field: "添加动作", oldValue: "无", newValue: describeSet(actionName, updSet) });
                continue;
            }
            if (origSet && !updSet) {
                const actionName = nameOf(origSet);
                modifications.push({ dayIndex, actionName, field: "删除动作", oldValue: describeSet(actionName, origSet), newValue: "已删除" });
                continue;
            }
            if (!origSet || !updSet) continue;

            const actionName = nameOf(updSet);
            if (String(origSet.actionId || "") !== String(updSet.actionId || "")) {
                const oldActionName = nameOf(origSet);
                modifications.push({ dayIndex, actionName: oldActionName, field: "替换动作", oldValue: oldActionName, newValue: actionName });
            }
            if (isOneFilterSet(origSet) || isOneFilterSet(updSet)) {
                if (stableJson(origSet) !== stableJson(updSet)) {
                    modifications.push({ dayIndex, actionName, field: "条件分支", oldValue: "原分支", newValue: "已修改" });
                }
                continue;
            }
            compareSetParams(
                (field, oldValue, newValue) => modifications.push({ dayIndex, actionName, field, oldValue, newValue }),
                origSet.params || {},
                updSet.params || {},
            );
        }
    }

    return modifications;
}

// ---------------------------------------------------------------------------
// “本轮到底改没改”
// ---------------------------------------------------------------------------

function normalizeNameKey(name?: string | null) {
    return String(name || "")
        .toLowerCase()
        .replace(/[\s\-_()（）【】\[\]·,，.。]/g, "")
        .trim();
}

/** 模型提出、但没有落成实际 1RM 变化的调整（动作没对上、没有当前 1RM、或没有学员）。 */
export function findUnresolvedOneRmDrafts(
    drafts: OneRmAdjustmentDraft[] | undefined,
    resolved: Array<{ actionId: string; actionName: string }>,
): string[] {
    const resolvedIds = new Set(resolved.map((item) => String(item.actionId)));
    const resolvedNames = new Set(resolved.map((item) => normalizeNameKey(item.actionName)));
    const unresolved: string[] = [];
    for (const draft of drafts || []) {
        const name = String(draft.actionName || draft.actionId || "").trim();
        if (!name) continue;
        if (draft.actionId && resolvedIds.has(String(draft.actionId))) continue;
        if (resolvedNames.has(normalizeNameKey(draft.actionName))) continue;
        if (!unresolved.includes(name)) unresolved.push(name);
    }
    return unresolved;
}

/**
 * 计划和全局 1RM 都没有变化时，本轮不能报“成功”。返回给教练看的说明；有变化时返回 null。
 */
export function describeNoChangeTurn(params: {
    modificationCount: number;
    resolvedOneRmCount: number;
    unresolvedOneRmNames?: string[];
    hasOneRmSubject?: boolean;
}): string | null {
    if (params.modificationCount > 0 || params.resolvedOneRmCount > 0) return null;
    const unresolved = params.unresolvedOneRmNames || [];
    if (unresolved.length > 0) {
        const reason = params.hasOneRmSubject === false
            ? "当前没有关联学员，无法调整全局 1RM（模板只能直接改动作行的重量或强度）"
            : "没有找到这些动作当前的 1RM，或动作名与动作库对不上";
        return `本轮没有产生实际修改：${unresolved.join("、")} 的 1RM 调整未生效（${reason}）。请直接说明要改成的重量，或补充该动作的 1RM。`;
    }
    return "本轮没有产生实际修改。请把要修改的周次、训练日、动作和目标参数写得更明确。";
}
