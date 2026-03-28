import { serviceRoleSupabase } from "@/lib/supabaseClient";

export interface StreetliftingLocationContributorRow {
    id?: string;
    contributor_key: string;
    contributor_user_id: string | null;
    display_name: string;
    upload_count: number;
    detail_score_total: number;
    image_count_total: number;
    contribution_score: number;
    last_contributed_at: string | null;
}

export interface StreetliftingLocationAggregateSourceRow {
    id: string;
    created_at: string | null;
    user_contact: string | null;
    contributor_user_id?: string | null;
    contributor_name_snapshot?: string | null;
    description?: string | null;
    address?: string | null;
    province?: string | null;
    city?: string | null;
    county?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    image_url?: string | null;
    image_urls?: string[] | null;
}

function normalizeText(value: string | null | undefined): string {
    return String(value || "").trim();
}

export function getStreetliftingLocationImageCount(location: Pick<StreetliftingLocationAggregateSourceRow, "image_url" | "image_urls">): number {
    const multiCount = Array.isArray(location.image_urls)
        ? location.image_urls.map((item) => normalizeText(item)).filter(Boolean).length
        : 0;
    const singleCount = normalizeText(location.image_url) ? 1 : 0;
    return Math.max(multiCount, singleCount);
}

export function computeStreetliftingLocationDetailScore(location: Pick<
    StreetliftingLocationAggregateSourceRow,
    "description" | "address" | "province" | "city" | "county" | "latitude" | "longitude" | "image_url" | "image_urls"
>): number {
    let score = 1;
    const descriptionLength = normalizeText(location.description).length;
    if (descriptionLength >= 24) score += 3;
    else if (descriptionLength >= 8) score += 2;
    else if (descriptionLength > 0) score += 1;

    if (normalizeText(location.address)) score += 2;
    if (normalizeText(location.province)) score += 1;
    if (normalizeText(location.city)) score += 1;
    if (normalizeText(location.county)) score += 1;
    if (typeof location.latitude === "number" && typeof location.longitude === "number") score += 2;
    score += Math.min(getStreetliftingLocationImageCount(location), 3);
    return score;
}

export function buildStreetliftingContributorKey(params: {
    contributorUserId?: string | null;
    userContact?: string | null;
    contributorNameSnapshot?: string | null;
}): string | null {
    const contributorUserId = normalizeText(params.contributorUserId);
    if (contributorUserId) return `user:${contributorUserId}`;

    const contactSeed = normalizeText(params.userContact) || normalizeText(params.contributorNameSnapshot);
    if (!contactSeed) return null;
    return `contact:${contactSeed.toLowerCase()}`;
}

export function buildStreetliftingContributorDisplayName(params: {
    contributorNameSnapshot?: string | null;
    userContact?: string | null;
    contributorUserId?: string | null;
}): string {
    const snapshot = normalizeText(params.contributorNameSnapshot);
    if (snapshot) return snapshot;

    const contact = normalizeText(params.userContact);
    if (contact) return contact;

    const contributorUserId = normalizeText(params.contributorUserId);
    if (contributorUserId) return `用户 ${contributorUserId.slice(0, 8)}`;

    return "未署名贡献者";
}

export function aggregateStreetliftingLocationContributors(
    locations: StreetliftingLocationAggregateSourceRow[],
): StreetliftingLocationContributorRow[] {
    const contributorMap = new Map<string, StreetliftingLocationContributorRow>();

    for (const location of locations) {
        const contributorKey = buildStreetliftingContributorKey(location);
        if (!contributorKey) continue;

        const displayName = buildStreetliftingContributorDisplayName(location);
        const detailScore = computeStreetliftingLocationDetailScore(location);
        const imageCount = getStreetliftingLocationImageCount(location);
        const latestTimestamp = location.created_at || null;

        const current = contributorMap.get(contributorKey);
        if (current) {
            current.upload_count += 1;
            current.detail_score_total += detailScore;
            current.image_count_total += imageCount;
            current.contribution_score = current.upload_count * 12 + current.detail_score_total;
            if ((latestTimestamp || "") > (current.last_contributed_at || "")) {
                current.last_contributed_at = latestTimestamp;
                current.display_name = displayName || current.display_name;
            }
            continue;
        }

        contributorMap.set(contributorKey, {
            contributor_key: contributorKey,
            contributor_user_id: location.contributor_user_id || null,
            display_name: displayName,
            upload_count: 1,
            detail_score_total: detailScore,
            image_count_total: imageCount,
            contribution_score: 12 + detailScore,
            last_contributed_at: latestTimestamp,
        });
    }

    return Array.from(contributorMap.values()).sort((a, b) => {
        if (b.contribution_score !== a.contribution_score) return b.contribution_score - a.contribution_score;
        if (b.upload_count !== a.upload_count) return b.upload_count - a.upload_count;
        if (b.detail_score_total !== a.detail_score_total) return b.detail_score_total - a.detail_score_total;
        return (b.last_contributed_at || "").localeCompare(a.last_contributed_at || "");
    });
}

export async function rebuildStreetliftingLocationContributorStats(): Promise<void> {
    const { data: locations, error } = await serviceRoleSupabase
        .from("streetlifting_locations")
        .select("id, created_at, user_contact, contributor_user_id, contributor_name_snapshot, description, address, province, city, county, latitude, longitude, image_url, image_urls");

    if (error) {
        throw new Error(error.message || "读取单杠点位失败");
    }

    const rows = aggregateStreetliftingLocationContributors(
        (locations || []) as StreetliftingLocationAggregateSourceRow[],
    );

    const nextKeys = rows.map((row) => row.contributor_key);

    if (rows.length > 0) {
        const { error: upsertError } = await serviceRoleSupabase
            .from("streetlifting_location_contributors")
            .upsert(rows, { onConflict: "contributor_key" });

        if (upsertError) {
            throw new Error(upsertError.message || "更新贡献榜失败");
        }
    }

    const { data: existingRows, error: existingError } = await serviceRoleSupabase
        .from("streetlifting_location_contributors")
        .select("contributor_key");

    if (existingError) {
        throw new Error(existingError.message || "读取贡献榜失败");
    }

    const staleKeys = (existingRows || [])
        .map((row: any) => String(row.contributor_key || ""))
        .filter((key) => key && !nextKeys.includes(key));

    if (staleKeys.length > 0) {
        const { error: deleteError } = await serviceRoleSupabase
            .from("streetlifting_location_contributors")
            .delete()
            .in("contributor_key", staleKeys);

        if (deleteError) {
            throw new Error(deleteError.message || "清理旧贡献榜失败");
        }
    }

    if (rows.length === 0 && (existingRows || []).length > 0) {
        const { error: clearError } = await serviceRoleSupabase
            .from("streetlifting_location_contributors")
            .delete()
            .not("id", "is", null);

        if (clearError) {
            throw new Error(clearError.message || "清空贡献榜失败");
        }
    }
}
