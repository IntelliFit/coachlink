export interface OneRmAdjustmentDraft {
    actionId?: string | null;
    actionName?: string | null;
    deltaKg?: number | null;
    targetOneRM?: number | null;
    reason?: string | null;
}

export interface OneRmActionLite {
    id: string;
    name: string;
    canonical_action_id?: string | null;
}

export interface OneRmAdjustmentResolved {
    actionId: string;
    actionName: string;
    canonicalActionId?: string | null;
    studentActionId?: string | null;
    currentOneRM: number;
    nextOneRM: number;
    deltaKg: number;
    reason?: string;
}

interface ResolveOneRmAdjustmentsParams {
    drafts: OneRmAdjustmentDraft[];
    actions: OneRmActionLite[];
    currentOneRMByActionId?: Record<string, number>;
    currentOneRMByCanonicalActionId?: Record<string, number>;
    currentOneRMByActionName?: Record<string, number>;
    studentActionIdByCanonicalActionId?: Record<string, string>;
    studentActionIdByActionName?: Record<string, string>;
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

export function normalizeOneRmDelta(deltaKg?: number | null): number | null {
    const raw = Number(deltaKg);
    if (!Number.isFinite(raw) || raw === 0) return null;

    const sign = raw > 0 ? 1 : -1;
    const normalizedAbs = Math.max(2.5, Math.round(Math.abs(raw) / 2.5) * 2.5);
    return roundToSingleDecimal(sign * normalizedAbs);
}

function findActionByDraft(draft: OneRmAdjustmentDraft, actions: OneRmActionLite[]) {
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

function getCurrentOneRM(action: OneRmActionLite, params: ResolveOneRmAdjustmentsParams) {
    const byActionId = params.currentOneRMByActionId?.[action.id];
    if (Number.isFinite(byActionId) && Number(byActionId) > 0) {
        return Number(byActionId);
    }

    const canonicalActionId = String(action.canonical_action_id || "").trim();
    if (canonicalActionId) {
        const byCanonical = params.currentOneRMByCanonicalActionId?.[canonicalActionId];
        if (Number.isFinite(byCanonical) && Number(byCanonical) > 0) {
            return Number(byCanonical);
        }
    }

    const byName = params.currentOneRMByActionName?.[normalizeActionNameKey(action.name)];
    if (Number.isFinite(byName) && Number(byName) > 0) {
        return Number(byName);
    }

    return null;
}

function getStudentActionId(action: OneRmActionLite, params: ResolveOneRmAdjustmentsParams) {
    const canonicalActionId = String(action.canonical_action_id || "").trim();
    if (canonicalActionId) {
        const byCanonical = params.studentActionIdByCanonicalActionId?.[canonicalActionId];
        if (byCanonical) return byCanonical;
    }

    const byName = params.studentActionIdByActionName?.[normalizeActionNameKey(action.name)];
    if (byName) return byName;

    return null;
}

export function resolveOneRmAdjustments(
    params: ResolveOneRmAdjustmentsParams,
): OneRmAdjustmentResolved[] {
    const { drafts, actions } = params;
    const stateByActionId = new Map<string, {
        action: OneRmActionLite;
        currentOneRM: number;
        targetOneRM: number | null;
        relativeDeltaKg: number;
        reasons: string[];
    }>();

    for (const draft of drafts || []) {
        const action = findActionByDraft(draft, actions);
        if (!action) continue;

        const detectedCurrentOneRM = getCurrentOneRM(action, params);
        const currentOneRM = Number.isFinite(detectedCurrentOneRM) && Number(detectedCurrentOneRM) > 0
            ? Number(detectedCurrentOneRM)
            : 0;
        const state = stateByActionId.get(action.id) || {
            action,
            currentOneRM,
            targetOneRM: null,
            relativeDeltaKg: 0,
            reasons: [],
        };
        const rawTargetOneRM = Number(draft.targetOneRM);
        const normalizedDelta = normalizeOneRmDelta(draft.deltaKg);
        let hasValidOperation = false;

        if (Number.isFinite(rawTargetOneRM) && rawTargetOneRM > 0) {
            // “=” 提供精确的绝对基准；同一动作的 += / -= 在该基准上累计。
            state.targetOneRM = roundToSingleDecimal(Math.max(0.5, rawTargetOneRM));
            hasValidOperation = true;
        }
        if (normalizedDelta !== null) {
            state.relativeDeltaKg = roundToSingleDecimal(state.relativeDeltaKg + normalizedDelta);
            hasValidOperation = true;
        }
        if (!hasValidOperation) continue;
        if (draft.reason) state.reasons.push(String(draft.reason).trim());
        stateByActionId.set(action.id, state);
    }

    const resolved: OneRmAdjustmentResolved[] = [];
    for (const state of stateByActionId.values()) {
        const baseOneRM = state.targetOneRM ?? state.currentOneRM;
        if (baseOneRM <= 0) continue;

        const nextOneRM = roundToSingleDecimal(Math.max(0.5, baseOneRM + state.relativeDeltaKg));
        const deltaKg = roundToSingleDecimal(nextOneRM - state.currentOneRM);
        if (deltaKg === 0) continue;

        resolved.push({
            actionId: state.action.id,
            actionName: state.action.name,
            canonicalActionId: state.action.canonical_action_id || null,
            studentActionId: getStudentActionId(state.action, params),
            currentOneRM: state.currentOneRM,
            nextOneRM,
            deltaKg,
            reason: state.reasons.length > 0
                ? Array.from(new Set(state.reasons.filter(Boolean))).join("；")
                : undefined,
        });
    }

    return resolved;
}

