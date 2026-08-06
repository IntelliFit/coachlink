/**
 * Build a stable identity for an action name without discarding semantic
 * qualifiers such as equipment, grip, pause, tempo, or loading mode.
 *
 * This is intentionally stricter than planImportText.sanitizeActionName(),
 * which removes parenthesized text because that helper was designed for
 * cleaning free-form plan instructions. Parenthesized text in structured
 * catalog data is often part of the exercise identity.
 */
export function normalizeActionNameIdentity(value: unknown): string {
    return String(value ?? "")
        .normalize("NFKC")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

export function actionIdentityKey(type: unknown, name: unknown): string {
    const normalizedType = String(type || "STRENGTH").trim().toUpperCase() || "STRENGTH";
    return `${normalizedType}:${normalizeActionNameIdentity(name)}`;
}

export function canonicalActionMatchesName(
    canonical: { name?: unknown; aliases?: unknown } | null | undefined,
    actionName: unknown,
): boolean {
    const target = normalizeActionNameIdentity(actionName);
    if (!target || !canonical) return false;

    const candidates = [
        canonical.name,
        ...(Array.isArray(canonical.aliases) ? canonical.aliases : []),
    ];
    return candidates.some((candidate) => normalizeActionNameIdentity(candidate) === target);
}
