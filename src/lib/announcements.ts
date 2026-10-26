/**
 * 平台公告（通知栏）的纯逻辑：后台输入校验、受众匹配、用户侧可见性与排序。
 * 数据读写见 announcementStore.ts；表结构见 supabase/migrations/20261025120000_announcements.sql。
 */

export const ANNOUNCEMENT_AUDIENCES = ['all', 'coach', 'student'] as const;
export const ANNOUNCEMENT_STATUSES = ['draft', 'published', 'archived'] as const;
export const ANNOUNCEMENT_MAX_IMAGES = 9;
/** 一次打开最多连续弹几条，避免长期未登录的用户被一串弹窗淹没。 */
export const ANNOUNCEMENT_MAX_POPUPS = 5;

const LIMITS = {
    title: 60,
    summary: 200,
    content: 5000,
    actionLabel: 20,
    path: 300,
    url: 1000,
} as const;

export type AnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];
export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export type AnnouncementRow = {
    id: string;
    title: string;
    summary: string;
    content: string;
    cover_image_url: string | null;
    image_urls: unknown;
    action_label: string;
    weapp_path: string;
    web_path: string;
    audience: AnnouncementAudience;
    status: AnnouncementStatus;
    popup: boolean;
    pinned: boolean;
    published_at: string | null;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
};

export type AnnouncementReadRow = {
    announcement_id: string;
    popped_at: string | null;
    read_at: string | null;
};

/** 下发给用户端（Web / 小程序）的公告。 */
export type UserAnnouncement = {
    id: string;
    title: string;
    summary: string;
    content: string;
    coverImageUrl: string | null;
    imageUrls: string[];
    actionLabel: string;
    weappPath: string;
    webPath: string;
    pinned: boolean;
    publishedAt: string | null;
    isRead: boolean;
    shouldPopup: boolean;
};

export type AnnouncementFeed = {
    items: UserAnnouncement[];
    unreadCount: number;
    /** 本次打开需要自动弹出的公告 id，按展示顺序。 */
    popupIds: string[];
};

/** 写入数据库的公告字段（不含 id / 时间戳 / created_by）。 */
export type AnnouncementInput = {
    title: string;
    summary: string;
    content: string;
    cover_image_url: string | null;
    image_urls: string[];
    action_label: string;
    weapp_path: string;
    web_path: string;
    audience: AnnouncementAudience;
    popup: boolean;
    pinned: boolean;
    expires_at: string | null;
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; message: string };

function text(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
}

function isHttpsUrl(value: string): boolean {
    if (value.length > LIMITS.url) return false;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

/** 只允许站内路径，防止公告被用来把用户带去外站。 */
function isInternalPath(value: string): boolean {
    return value.startsWith('/') && !value.startsWith('//') && !/\s/.test(value);
}

export function normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && isHttpsUrl(item));
}

export function validateAnnouncementInput(raw: unknown): ValidationResult<AnnouncementInput> {
    const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

    const title = text(body.title);
    if (!title) return { ok: false, message: '请填写标题' };
    if (title.length > LIMITS.title) return { ok: false, message: `标题不能超过 ${LIMITS.title} 字` };

    const summary = text(body.summary);
    if (summary.length > LIMITS.summary) return { ok: false, message: `摘要不能超过 ${LIMITS.summary} 字` };

    const content = text(body.content);
    if (content.length > LIMITS.content) return { ok: false, message: `正文不能超过 ${LIMITS.content} 字` };

    const cover = text(body.cover_image_url);
    if (cover && !isHttpsUrl(cover)) return { ok: false, message: '封面图必须是 https 链接' };

    const rawImages = Array.isArray(body.image_urls) ? body.image_urls : [];
    const imageUrls = rawImages.map(text).filter(Boolean);
    if (imageUrls.length > ANNOUNCEMENT_MAX_IMAGES) {
        return { ok: false, message: `正文图片最多 ${ANNOUNCEMENT_MAX_IMAGES} 张` };
    }
    if (imageUrls.some((url) => !isHttpsUrl(url))) return { ok: false, message: '正文图片必须是 https 链接' };

    const actionLabel = text(body.action_label);
    if (actionLabel.length > LIMITS.actionLabel) {
        return { ok: false, message: `按钮文字不能超过 ${LIMITS.actionLabel} 字` };
    }
    const weappPath = text(body.weapp_path);
    const webPath = text(body.web_path);
    for (const path of [weappPath, webPath]) {
        if (path && (path.length > LIMITS.path || !isInternalPath(path))) {
            return { ok: false, message: '跳转路径必须是以 / 开头的站内路径' };
        }
    }
    if (actionLabel && !weappPath && !webPath) return { ok: false, message: '填写了按钮文字，请同时填写跳转路径' };

    const audience = text(body.audience) || 'all';
    if (!(ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(audience)) {
        return { ok: false, message: '受众无效' };
    }

    const expiresRaw = text(body.expires_at);
    let expiresAt: string | null = null;
    if (expiresRaw) {
        const time = Date.parse(expiresRaw);
        if (Number.isNaN(time)) return { ok: false, message: '过期时间格式无效' };
        expiresAt = new Date(time).toISOString();
    }

    if (!summary && !content && !cover && imageUrls.length === 0) {
        return { ok: false, message: '请至少填写摘要、正文或图片之一' };
    }

    return {
        ok: true,
        value: {
            title,
            summary,
            content,
            cover_image_url: cover || null,
            image_urls: imageUrls,
            action_label: actionLabel,
            weapp_path: weappPath,
            web_path: webPath,
            audience: audience as AnnouncementAudience,
            popup: body.popup !== false,
            pinned: body.pinned === true,
            expires_at: expiresAt,
        },
    };
}

/** coach 只给教练；student 只给非教练用户；all 给所有人。 */
export function matchesAudience(audience: AnnouncementAudience, isCoach: boolean): boolean {
    if (audience === 'all') return true;
    return audience === 'coach' ? isCoach : !isCoach;
}

export function isAnnouncementLive(row: Pick<AnnouncementRow, 'status' | 'published_at' | 'expires_at'>, now: Date): boolean {
    if (row.status !== 'published' || !row.published_at) return false;
    if (Date.parse(row.published_at) > now.getTime()) return false;
    return !row.expires_at || Date.parse(row.expires_at) > now.getTime();
}

function publishedTime(row: Pick<AnnouncementRow, 'published_at'>): number {
    return row.published_at ? Date.parse(row.published_at) : 0;
}

/** 置顶在前，其余按发布时间倒序。 */
export function compareAnnouncements(
    a: Pick<AnnouncementRow, 'pinned' | 'published_at'>,
    b: Pick<AnnouncementRow, 'pinned' | 'published_at'>,
): number {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return publishedTime(b) - publishedTime(a);
}

export function toUserAnnouncement(row: AnnouncementRow, read: AnnouncementReadRow | undefined): UserAnnouncement {
    return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        content: row.content,
        coverImageUrl: row.cover_image_url,
        imageUrls: normalizeImageUrls(row.image_urls),
        actionLabel: row.action_label,
        weappPath: row.weapp_path,
        webPath: row.web_path,
        pinned: row.pinned,
        publishedAt: row.published_at,
        isRead: Boolean(read?.read_at),
        shouldPopup: row.popup && !read?.popped_at && !read?.read_at,
    };
}

export function buildAnnouncementFeed(params: {
    rows: AnnouncementRow[];
    reads: AnnouncementReadRow[];
    isCoach: boolean;
    now: Date;
}): AnnouncementFeed {
    const readById = new Map(params.reads.map((read) => [read.announcement_id, read]));
    const items = params.rows
        .filter((row) => isAnnouncementLive(row, params.now) && matchesAudience(row.audience, params.isCoach))
        .sort(compareAnnouncements)
        .map((row) => toUserAnnouncement(row, readById.get(row.id)));

    return {
        items,
        unreadCount: items.filter((item) => !item.isRead).length,
        popupIds: items
            .filter((item) => item.shouldPopup)
            .slice(0, ANNOUNCEMENT_MAX_POPUPS)
            .map((item) => item.id),
    };
}

export function isUuid(value: unknown): value is string {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/** 用户端上报的 id 列表：去重、只留合法 uuid、限制条数。 */
export function normalizeAnnouncementIds(value: unknown, max = 50): string[] {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.filter(isUuid))).slice(0, max);
}
