import type { RelativeIntensityType, WeightUnit } from "@/types/intensity";

export type LoadAdjustmentMode = "fixed" | "rm" | "percentage";

export interface LoadAdjustmentDraft {
    actionId?: string | null;
    actionName?: string | null;
    dayIndex?: number | null;
    setIndex?: number | null;
    mode?: LoadAdjustmentMode | "fixed_weight" | "recommended_load" | null;
    targetKg?: number | null;
    deltaKg?: number | null;
    targetValue?: number | null;
    reason?: string | null;
}

export interface LoadAdjustmentResolved {
    actionId: string;
    actionName: string;
    dayIndex: number;
    setIndex: number;
    mode: LoadAdjustmentMode;
    reason?: string;
    previousLoadKg?: number | null;
    nextLoadKg?: number | null;
    previousRelativeType?: RelativeIntensityType | null;
    previousRelativeValue?: number | null;
    nextRelativeValue?: number | null;
}

export interface LoadAdjustmentActionLite {
    id: string;
    name: string;
}

interface ApplyLoadAdjustmentsParams {
    drafts: LoadAdjustmentDraft[];
    trainingDays: any[];
    actions: LoadAdjustmentActionLite[];
}

function cloneTrainingDays(trainingDays: any[]) {
    return JSON.parse(JSON.stringify(trainingDays || []));
}

function normalizeActionNameKey(name?: string | null) {
    return String(name || "")
        .toLowerCase()
        .replace(/[\s\-_()（）【】\[\]·,，.。]/g, "")
        .trim();
}

function roundToSingleDecimal(value: number) {
    return Math.round(value * 10) / 10;
}

function normalizeWeightStep(value?: number | null): number | null {
    const raw = Number(value);
    if (!Number.isFinite(raw)) return null;
    return roundToSingleDecimal(Math.round(raw / 2.5) * 2.5);
}

function normalizeMode(mode?: string | null): LoadAdjustmentMode | null {
    const raw = String(mode || "").trim().toLowerCase();
    if (!raw) return null;
    if (raw === "fixed" || raw === "fixed_weight" || raw === "recommended_load") return "fixed";
    if (raw === "rm") return "rm";
    if (raw === "percentage" || raw === "%") return "percentage";
    return null;
}

function findActionByDraft(draft: LoadAdjustmentDraft, actions: LoadAdjustmentActionLite[]) {
    const rawActionId = String(draft.actionId || "").trim();
    if (rawActionId) {
        const exactById = actions.find((action) => String(action.id) === rawActionId);
        if (exactById) return exactById;
    }

    const actionNameKey = normalizeActionNameKey(draft.actionName);
    if (!actionNameKey) return null;

    const exactByName = actions.find((action) => normalizeActionNameKey(action.name) === actionNameKey);
    if (exactByName) return exactByName;

    const partials = actions.filter((action) => {
        const key = normalizeActionNameKey(action.name);
        return key.includes(actionNameKey) || actionNameKey.includes(key);
    });
    if (partials.length === 0) return null;

    return partials.sort((a, b) => b.name.length - a.name.length)[0];
}

function getCurrentLoadKg(params: any): number | null {
    const candidates = [
        params?.load,
        params?.weight,
        params?.intensityConfig?.fixedWeight?.value,
    ];

    for (const candidate of candidates) {
        if (candidate === null || candidate === undefined || candidate === "") continue;
        const n = Number(candidate);
        if (Number.isFinite(n)) return n;
    }

    return null;
}

function getCurrentUnit(params: any): WeightUnit {
    const unit = params?.intensityConfig?.fixedWeight?.unit || params?.loadUnit || "kg";
    return unit === "lbs" ? "lbs" : "kg";
}

function isStrengthSet(set: any) {
    const type = String(set?.itemType || "STRENGTH").toUpperCase();
    return type === "STRENGTH";
}

type SetRef = {
    dayIndex: number;
    setIndex: number;
    set: any;
};

function collectMatchingSetRefs(params: {
    trainingDays: any[];
    action: LoadAdjustmentActionLite;
    draft: LoadAdjustmentDraft;
}): SetRef[] {
    const refs: SetRef[] = [];
    const actionNameKey = normalizeActionNameKey(params.action.name);
    const targetDayIndex = Number(params.draft.dayIndex);

    for (const day of params.trainingDays || []) {
        const dayIndex = Number(day?.dayIndex || 0);
        if (Number.isFinite(targetDayIndex) && targetDayIndex > 0 && dayIndex !== targetDayIndex) {
            continue;
        }

        let matchedCount = 0;
        for (const set of day?.actionSets || []) {
            if (!isStrengthSet(set)) continue;

            const byActionId = String(set?.actionId || "") === params.action.id;
            const byActionName = normalizeActionNameKey(
                set?.params?.action_name || set?.setName || "",
            ) === actionNameKey;
            if (!byActionId && !byActionName) continue;

            matchedCount += 1;
            refs.push({
                dayIndex,
                setIndex: matchedCount,
                set,
            });
        }
    }

    const targetSetIndex = Number(params.draft.setIndex);
    if (Number.isFinite(targetSetIndex) && targetSetIndex > 0) {
        if (!Number.isFinite(targetDayIndex) || targetDayIndex <= 0) {
            return refs.slice(targetSetIndex - 1, targetSetIndex);
        }
        return refs.filter((ref) => ref.setIndex === targetSetIndex);
    }

    return refs;
}

function applyFixedLoad(set: any, draft: LoadAdjustmentDraft) {
    const currentLoad = getCurrentLoadKg(set?.params);
    const targetKg = normalizeWeightStep(draft.targetKg);
    const deltaKg = normalizeWeightStep(draft.deltaKg);
    const nextLoadKg = targetKg ?? (
        currentLoad === null || deltaKg === null
            ? null
            : normalizeWeightStep(currentLoad + deltaKg)
    );
    if (nextLoadKg === null) return null;

    const unit = getCurrentUnit(set?.params);
    set.params = {
        ...(set?.params || {}),
        load: nextLoadKg,
        weight: nextLoadKg,
        loadUnit: unit,
        intensityConfig: {
            fixedWeight: { value: nextLoadKg, unit },
        },
        "强度": undefined,
    };

    return {
        previousLoadKg: currentLoad,
        nextLoadKg,
    };
}

function applyRelativeIntensity(set: any, draft: LoadAdjustmentDraft, type: RelativeIntensityType) {
    const rawTargetValue = Number(draft.targetValue);
    if (!Number.isFinite(rawTargetValue)) return null;

    const nextValue = type === "rm"
        ? Math.max(1, Math.min(36, Math.round(rawTargetValue)))
        : Math.max(1, Math.min(100, Math.round(rawTargetValue * 10) / 10));

    const currentLoad = getCurrentLoadKg(set?.params);
    const unit = getCurrentUnit(set?.params);
    const currentConfig = set?.params?.intensityConfig || {};
    const nextConfig: Record<string, any> = {
        relativeIntensity: {
            type,
            value: nextValue,
        },
    };

    if (currentLoad !== null) {
        nextConfig.recommendedLoad = {
            value: currentLoad,
            unit,
        };
    } else if (currentConfig?.recommendedLoad) {
        nextConfig.recommendedLoad = currentConfig.recommendedLoad;
    }

    set.params = {
        ...(set?.params || {}),
        intensityConfig: nextConfig,
        "强度": type === "rm" ? nextValue : undefined,
    };

    return {
        previousLoadKg: currentLoad,
        nextLoadKg: currentLoad,
        previousRelativeType: currentConfig?.relativeIntensity?.type || null,
        previousRelativeValue: Number.isFinite(Number(currentConfig?.relativeIntensity?.value))
            ? Number(currentConfig.relativeIntensity.value)
            : null,
        nextRelativeValue: nextValue,
    };
}

export function applyLoadAdjustments(
    params: ApplyLoadAdjustmentsParams,
): { updatedTrainingDays: any[]; adjustments: LoadAdjustmentResolved[] } {
    const nextTrainingDays = cloneTrainingDays(params.trainingDays || []);
    const resolved: LoadAdjustmentResolved[] = [];

    for (const draft of params.drafts || []) {
        const action = findActionByDraft(draft, params.actions || []);
        const mode = normalizeMode(draft.mode);
        if (!action || !mode) continue;

        const refs = collectMatchingSetRefs({
            trainingDays: nextTrainingDays,
            action,
            draft,
        });
        if (refs.length === 0) continue;

        for (const ref of refs) {
            const updateResult = mode === "fixed"
                ? applyFixedLoad(ref.set, draft)
                : applyRelativeIntensity(ref.set, draft, mode === "rm" ? "rm" : "percentage");
            if (!updateResult) continue;

            resolved.push({
                actionId: action.id,
                actionName: action.name,
                dayIndex: ref.dayIndex,
                setIndex: ref.setIndex,
                mode,
                reason: draft.reason ? String(draft.reason).trim() : undefined,
                ...updateResult,
            });
        }
    }

    return {
        updatedTrainingDays: nextTrainingDays,
        adjustments: resolved,
    };
}
