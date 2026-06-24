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
    const resolvedByActionId = new Map<string, OneRmAdjustmentResolved>();

    for (const draft of drafts || []) {
        const action = findActionByDraft(draft, actions);
        if (!action) continue;

        const currentOneRM = getCurrentOneRM(action, params);
        if (!Number.isFinite(currentOneRM) || Number(currentOneRM) <= 0) continue;

        let normalizedDelta = normalizeOneRmDelta(draft.deltaKg);
        if (normalizedDelta === null && Number.isFinite(Number(draft.targetOneRM))) {
            normalizedDelta = normalizeOneRmDelta(Number(draft.targetOneRM) - Number(currentOneRM));
        }
        if (normalizedDelta === null) continue;

        const existing = resolvedByActionId.get(action.id);
        const nextDelta = normalizeOneRmDelta((existing?.deltaKg || 0) + normalizedDelta);
        if (nextDelta === null) continue;

        const nextOneRM = roundToSingleDecimal(Math.max(0.5, Number(currentOneRM) + nextDelta));
        const reasons = [existing?.reason, draft.reason].filter(Boolean).map((x) => String(x).trim());

        resolvedByActionId.set(action.id, {
            actionId: action.id,
            actionName: action.name,
            canonicalActionId: action.canonical_action_id || null,
            studentActionId: getStudentActionId(action, params),
            currentOneRM: Number(currentOneRM),
            nextOneRM,
            deltaKg: nextDelta,
            reason: reasons.length > 0 ? Array.from(new Set(reasons)).join("；") : undefined,
        });
    }

    return Array.from(resolvedByActionId.values());
}

