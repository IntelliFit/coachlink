import { normalizeActionNameForMatch } from "@/lib/planImportText";

export interface CanonicalActionLite {
    id: string;
    name: string | null;
    aliases?: string[] | null;
}

interface CanonicalLookup {
    ids: Set<string>;
    keyToIds: Map<string, Set<string>>;
}

export interface CanonicalResolveResult {
    canonicalActionId: string | null;
    errorMessage: string | null;
    reason: "invalid_provided" | "missing_name" | "not_found" | "ambiguous" | null;
}

function appendNameKey(
    bucket: Map<string, Set<string>>,
    key: string,
    id: string,
) {
    if (!key) return;
    const existing = bucket.get(key);
    if (existing) {
        existing.add(id);
        return;
    }
    bucket.set(key, new Set([id]));
}

export function buildCanonicalLookup(rows: CanonicalActionLite[]): CanonicalLookup {
    const ids = new Set<string>();
    const keyToIds = new Map<string, Set<string>>();

    for (const row of rows || []) {
        if (!row?.id) continue;
        ids.add(row.id);

        const nameKey = normalizeActionNameForMatch(row.name || "");
        appendNameKey(keyToIds, nameKey, row.id);

        for (const alias of row.aliases || []) {
            const aliasKey = normalizeActionNameForMatch(alias || "");
            appendNameKey(keyToIds, aliasKey, row.id);
        }
    }

    return { ids, keyToIds };
}

export function resolveCanonicalActionId(
    lookup: CanonicalLookup,
    params: {
        actionName: string;
        providedCanonicalId?: string | null;
        requireCanonical: boolean;
    },
): CanonicalResolveResult {
    const provided = (params.providedCanonicalId || "").trim();
    if (provided) {
        if (lookup.ids.has(provided)) {
            return { canonicalActionId: provided, errorMessage: null, reason: null };
        }
        return {
            canonicalActionId: null,
            errorMessage: `canonical_action_id 无效：${provided}`,
            reason: "invalid_provided",
        };
    }

    if (!params.requireCanonical) {
        return { canonicalActionId: null, errorMessage: null, reason: null };
    }

    const key = normalizeActionNameForMatch(params.actionName || "");
    if (!key) {
        return {
            canonicalActionId: null,
            errorMessage: "动作名称为空，无法确定 canonical_action_id",
            reason: "missing_name",
        };
    }

    const matched = lookup.keyToIds.get(key);
    if (!matched || matched.size === 0) {
        return {
            canonicalActionId: null,
            errorMessage: `动作「${params.actionName}」未匹配到 canonical_action_id`,
            reason: "not_found",
        };
    }

    if (matched.size > 1) {
        return {
            canonicalActionId: null,
            errorMessage: `动作「${params.actionName}」匹配到多个 canonical_action_id，请手动指定`,
            reason: "ambiguous",
        };
    }

    const [id] = Array.from(matched);
    return { canonicalActionId: id, errorMessage: null, reason: null };
}

