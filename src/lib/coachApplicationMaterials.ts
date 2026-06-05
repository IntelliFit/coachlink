export type CoachApplicationMaterialCategory =
    | "achievement"
    | "case"
    | "credential"
    | "media";

export type CoachApplicationMaterialMediaType = "image" | "video";

export interface CoachApplicationMaterialMedia {
    id: string;
    type: CoachApplicationMaterialMediaType;
    url: string;
    thumbnailUrl?: string | null;
    storageBucket?: string | null;
    storagePath?: string | null;
    fileName?: string | null;
    fileSizeBytes?: number | null;
    contentType?: string | null;
}

export interface CoachApplicationMaterialLink {
    id: string;
    label?: string | null;
    url: string;
}

export interface CoachApplicationMaterial {
    id: string;
    category: CoachApplicationMaterialCategory;
    title: string;
    summary?: string | null;
    detail?: string | null;
    isPublic: boolean;
    media: CoachApplicationMaterialMedia[];
    links: CoachApplicationMaterialLink[];
}

export interface LegacyCoachApplicationMaterialFields {
    achievements?: string[] | null;
    caseStudies?: string[] | null;
    credentials?: Array<{ name?: string | null; url?: string | null }> | null;
    socialLinks?: Record<string, string> | null;
}

export const COACH_APPLICATION_MATERIAL_CATEGORIES: Array<{
    value: CoachApplicationMaterialCategory;
    label: string;
}> = [
    { value: "achievement", label: "成就奖项" },
    { value: "case", label: "代表案例" },
    { value: "credential", label: "资质证书" },
    { value: "media", label: "图片/视频" },
];

const VALID_CATEGORY_SET = new Set(
    COACH_APPLICATION_MATERIAL_CATEGORIES.map((item) => item.value),
);

function makeId(prefix: string) {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanText(value: unknown, maxLength = 500) {
    if (typeof value !== "string") return "";
    return value.trim().slice(0, maxLength);
}

function cleanOptionalText(value: unknown, maxLength = 1200) {
    const text = cleanText(value, maxLength);
    return text || null;
}

function cleanUrl(value: unknown) {
    if (typeof value !== "string") return "";
    const url = value.trim();
    if (!url) return "";
    if (/^(https?:\/\/|wxfile:\/\/|cloud:\/\/|data:image\/)/i.test(url)) return url;
    return url;
}

function normalizeMediaItem(item: any): CoachApplicationMaterialMedia | null {
    const url = cleanUrl(item?.url);
    if (!url) return null;
    const explicitType = item?.type === "image" || item?.type === "video"
        ? item.type
        : "";
    const inferredType: CoachApplicationMaterialMediaType =
        explicitType ||
        (/(\.mp4|\.mov|\.m4v|\.webm)(\?|#|$)/i.test(url) || String(item?.contentType || "").startsWith("video/")
            ? "video"
            : "image");

    return {
        id: cleanText(item?.id, 120) || makeId("media"),
        type: inferredType,
        url,
        thumbnailUrl: cleanOptionalText(item?.thumbnailUrl ?? item?.thumbnail_url, 1000),
        storageBucket: cleanOptionalText(item?.storageBucket ?? item?.storage_bucket, 200),
        storagePath: cleanOptionalText(item?.storagePath ?? item?.storage_path, 1000),
        fileName: cleanOptionalText(item?.fileName ?? item?.file_name, 300),
        fileSizeBytes: Number.isFinite(Number(item?.fileSizeBytes ?? item?.file_size_bytes))
            ? Number(item?.fileSizeBytes ?? item?.file_size_bytes)
            : null,
        contentType: cleanOptionalText(item?.contentType ?? item?.content_type, 200),
    };
}

function normalizeLinkItem(item: any): CoachApplicationMaterialLink | null {
    const url = cleanUrl(item?.url);
    if (!url) return null;
    return {
        id: cleanText(item?.id, 120) || makeId("link"),
        label: cleanOptionalText(item?.label ?? item?.name, 80),
        url,
    };
}

export function normalizeCoachApplicationMaterials(
    input: unknown,
    legacy?: LegacyCoachApplicationMaterialFields,
): CoachApplicationMaterial[] {
    const source = Array.isArray(input) && input.length > 0
        ? input
        : buildMaterialsFromLegacyFields(legacy);

    return source
        .map((item: any) => {
            const rawCategory = item?.category;
            const category: CoachApplicationMaterialCategory = VALID_CATEGORY_SET.has(rawCategory)
                ? rawCategory
                : "media";
            const title = cleanText(item?.title ?? item?.name, 120);
            if (!title) return null;

            return {
                id: cleanText(item?.id, 120) || makeId("material"),
                category,
                title,
                summary: cleanOptionalText(item?.summary, 240),
                detail: cleanOptionalText(item?.detail ?? item?.description, 1600),
                isPublic: item?.isPublic === false || item?.is_public === false ? false : true,
                media: Array.isArray(item?.media)
                    ? item.media.map(normalizeMediaItem).filter(Boolean).slice(0, 8)
                    : [],
                links: Array.isArray(item?.links)
                    ? item.links.map(normalizeLinkItem).filter(Boolean).slice(0, 8)
                    : [],
            } as CoachApplicationMaterial;
        })
        .filter(Boolean) as CoachApplicationMaterial[];
}

export function filterPublicCoachApplicationMaterials(
    materials: unknown,
): CoachApplicationMaterial[] {
    return normalizeCoachApplicationMaterials(materials).filter((item) => item.isPublic);
}

export function buildMaterialsFromLegacyFields(
    legacy?: LegacyCoachApplicationMaterialFields,
): CoachApplicationMaterial[] {
    if (!legacy) return [];

    const achievements = (legacy.achievements || []).filter(Boolean).map((title) => ({
        id: makeId("achievement"),
        category: "achievement" as const,
        title,
        summary: null,
        detail: null,
        isPublic: true,
        media: [],
        links: [],
    }));

    const caseStudies = (legacy.caseStudies || []).filter(Boolean).map((title) => ({
        id: makeId("case"),
        category: "case" as const,
        title,
        summary: null,
        detail: null,
        isPublic: true,
        media: [],
        links: [],
    }));

    const credentials = (legacy.credentials || [])
        .filter((item) => item?.name)
        .map((item) => ({
            id: makeId("credential"),
            category: "credential" as const,
            title: String(item.name || ""),
            summary: null,
            detail: null,
            isPublic: true,
            media: [],
            links: item.url
                ? [{ id: makeId("link"), label: "证书链接", url: String(item.url) }]
                : [],
        }));

    return [...achievements, ...caseStudies, ...credentials];
}

export function deriveLegacyFieldsFromMaterials(
    materials: CoachApplicationMaterial[],
    fallback?: LegacyCoachApplicationMaterialFields,
): Required<LegacyCoachApplicationMaterialFields> {
    const achievements = materials
        .filter((item) => item.category === "achievement")
        .map((item) => item.summary ? `${item.title}：${item.summary}` : item.title)
        .filter(Boolean);

    const caseStudies = materials
        .filter((item) => item.category === "case")
        .map((item) => item.summary ? `${item.title}：${item.summary}` : item.title)
        .filter(Boolean);

    const credentials = materials
        .filter((item) => item.category === "credential")
        .map((item) => ({
            name: item.title,
            url: item.links[0]?.url || item.media[0]?.url || undefined,
        }));

    return {
        achievements: achievements.length ? achievements : (fallback?.achievements || []),
        caseStudies: caseStudies.length ? caseStudies : (fallback?.caseStudies || []),
        credentials: credentials.length ? credentials : (fallback?.credentials || []),
        socialLinks: fallback?.socialLinks || {},
    };
}

export function groupCoachApplicationMaterials(materials: unknown) {
    const normalized = normalizeCoachApplicationMaterials(materials);
    return {
        achievement: normalized.filter((item) => item.category === "achievement"),
        case: normalized.filter((item) => item.category === "case"),
        credential: normalized.filter((item) => item.category === "credential"),
        media: normalized.filter((item) => item.category === "media"),
        all: normalized,
    };
}

export const COACH_APPLICATION_MEDIA_LIMITS = {
    imageBytes: 5 * 1024 * 1024,
    videoBytes: 200 * 1024 * 1024,
};

export function validateCoachApplicationMediaUpload(input: {
    userId?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
}) {
    if (!input.userId) {
        return { ok: false as const, status: 401, message: "用户未登录" };
    }

    const isImage = input.contentType?.startsWith("image/");
    const isVideo = input.contentType?.startsWith("video/");
    if (!isImage && !isVideo) {
        return { ok: false as const, status: 400, message: "仅支持上传图片或视频文件" };
    }

    const maxBytes = isImage
        ? COACH_APPLICATION_MEDIA_LIMITS.imageBytes
        : COACH_APPLICATION_MEDIA_LIMITS.videoBytes;
    if ((input.sizeBytes || 0) > maxBytes) {
        return {
            ok: false as const,
            status: 413,
            message: isImage ? "图片过大，单张图片请小于 5MB" : "视频过大，单个视频请小于 200MB",
        };
    }

    return {
        ok: true as const,
        mediaType: (isImage ? "image" : "video") as CoachApplicationMaterialMediaType,
    };
}
