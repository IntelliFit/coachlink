import { serviceRoleSupabase } from "@/lib/supabaseClient";

/** 无 user_contact / contributor_user_id / 可识别署名的历史点位，统一归入同一贡献键，避免排行榜为空 */
export const STREETLIFTING_LEGACY_ANONYMOUS_KEY = "legacy:anonymous";
export const STREETLIFTING_LEGACY_ANONYMOUS_DISPLAY_NAME = "未署名贡献（历史数据）";

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

interface UserProfileNameRow {
    user_id: string | null;
    nickname: string | null;
    full_name: string | null;
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

export function buildStreetliftingContributorKey(
    row: Pick<StreetliftingLocationAggregateSourceRow, "contributor_user_id" | "user_contact" | "contributor_name_snapshot">,
): string {
    const contributorUserId = normalizeText(row.contributor_user_id);
    if (contributorUserId) return `user:${contributorUserId}`;

    const contactSeed = normalizeText(row.user_contact) || normalizeText(row.contributor_name_snapshot);
    if (contactSeed) return `contact:${contactSeed.toLowerCase()}`;

    return STREETLIFTING_LEGACY_ANONYMOUS_KEY;
}

export function buildStreetliftingContributorDisplayName(
    row: Pick<StreetliftingLocationAggregateSourceRow, "contributor_name_snapshot" | "user_contact" | "contributor_user_id">,
): string {
    const snapshot = normalizeText(row.contributor_name_snapshot);
    if (snapshot) return snapshot;

    const contact = normalizeText(row.user_contact);
    if (contact) return contact;

    const contributorUserId = normalizeText(row.contributor_user_id);
    if (contributorUserId) return `用户 ${contributorUserId.slice(0, 8)}`;

    return "未署名贡献者";
}

export function aggregateStreetliftingLocationContributors(
    locations: StreetliftingLocationAggregateSourceRow[],
): StreetliftingLocationContributorRow[] {
    const contributorMap = new Map<string, StreetliftingLocationContributorRow>();

    for (const location of locations) {
        const contributorKey = buildStreetliftingContributorKey(location);
        if (contributorKey === STREETLIFTING_LEGACY_ANONYMOUS_KEY) {
            continue;
        }
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

    const rawRows = aggregateStreetliftingLocationContributors(
        (locations || []) as StreetliftingLocationAggregateSourceRow[],
    );
    const contributorUserIds = Array.from(new Set(
        rawRows
            .map((row) => normalizeText(row.contributor_user_id))
            .filter(Boolean),
    ));

    let profileNameMap = new Map<string, string>();
    if (contributorUserIds.length > 0) {
        const { data: profiles, error: profileError } = await serviceRoleSupabase
            .from("user_profiles")
            .select("user_id, nickname, full_name")
            .in("user_id", contributorUserIds);

        if (profileError) {
            throw new Error(profileError.message || "读取贡献者昵称失败");
        }

        profileNameMap = new Map(
            ((profiles || []) as UserProfileNameRow[])
                .map((profile) => {
                    const userId = normalizeText(profile.user_id);
                    const displayName = normalizeText(profile.nickname) || normalizeText(profile.full_name);
                    if (!userId || !displayName) return null;
                    return [userId, displayName] as const;
                })
                .filter(Boolean) as Array<readonly [string, string]>,
        );
    }

    const rows = rawRows.map((row) => ({
        ...row,
        display_name: profileNameMap.get(normalizeText(row.contributor_user_id)) || row.display_name,
    }));

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
