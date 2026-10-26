import { serviceRoleSupabase } from './supabaseClient';
import {
    buildAnnouncementFeed,
    type AnnouncementFeed,
    type AnnouncementInput,
    type AnnouncementReadRow,
    type AnnouncementRow,
    type AnnouncementStatus,
} from './announcements';

/** 新表还不在生成的数据库类型里，这里集中做一次类型收口。 */
function db(): any {
    return serviceRoleSupabase as any;
}

const COLUMNS = [
    'id', 'title', 'summary', 'content', 'cover_image_url', 'image_urls', 'action_label',
    'weapp_path', 'web_path', 'audience', 'status', 'popup', 'pinned', 'published_at',
    'expires_at', 'created_at', 'updated_at',
].join(', ');

/** 用户端一次最多拉这么多条已发布公告（足够覆盖实际在线的公告）。 */
const FEED_LIMIT = 50;

async function isCoachUser(userId: string): Promise<boolean> {
    const { data, error } = await db().from('users').select('is_coach').eq('id', userId).maybeSingle();
    if (error) throw new Error(`load user role failed: ${error.message}`);
    return data?.is_coach === true;
}

export async function loadAnnouncementFeed(userId: string, now = new Date()): Promise<AnnouncementFeed> {
    const nowIso = now.toISOString();
    const [rowsResult, isCoach] = await Promise.all([
        db()
            .from('announcements')
            .select(COLUMNS)
            .eq('status', 'published')
            .lte('published_at', nowIso)
            .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
            .order('published_at', { ascending: false })
            .limit(FEED_LIMIT),
        isCoachUser(userId),
    ]);
    if (rowsResult.error) throw new Error(`load announcements failed: ${rowsResult.error.message}`);
    const rows = (rowsResult.data ?? []) as AnnouncementRow[];

    let reads: AnnouncementReadRow[] = [];
    if (rows.length > 0) {
        const { data, error } = await db()
            .from('announcement_reads')
            .select('announcement_id, popped_at, read_at')
            .eq('user_id', userId)
            .in('announcement_id', rows.map((row) => row.id));
        if (error) throw new Error(`load announcement reads failed: ${error.message}`);
        reads = (data ?? []) as AnnouncementReadRow[];
    }

    return buildAnnouncementFeed({ rows, reads, isCoach, now });
}

/**
 * 记录弹出/阅读状态。已有的时间戳不覆盖，保持「第一次」的时间。
 * 只接受当前确实在线的公告 id，避免写入不存在或已下线的记录。
 */
export async function markAnnouncements(
    userId: string,
    ids: string[],
    kind: 'popped' | 'read',
    now = new Date(),
): Promise<void> {
    if (ids.length === 0) return;
    const feed = await loadAnnouncementFeed(userId, now);
    const visible = new Set(feed.items.map((item) => item.id));
    const targetIds = ids.filter((id) => visible.has(id));
    if (targetIds.length === 0) return;

    const { data: existing, error: loadError } = await db()
        .from('announcement_reads')
        .select('announcement_id, popped_at, read_at')
        .eq('user_id', userId)
        .in('announcement_id', targetIds);
    if (loadError) throw new Error(`load announcement reads failed: ${loadError.message}`);

    const existingById = new Map<string, AnnouncementReadRow>(
        ((existing ?? []) as AnnouncementReadRow[]).map((read) => [read.announcement_id, read]),
    );
    const nowIso = now.toISOString();
    const upserts = targetIds
        .map((id) => {
            const prev = existingById.get(id);
            const poppedAt = prev?.popped_at ?? nowIso;
            const readAt = kind === 'read' ? (prev?.read_at ?? nowIso) : (prev?.read_at ?? null);
            const unchanged = prev && prev.popped_at === poppedAt && prev.read_at === readAt;
            return unchanged ? null : { user_id: userId, announcement_id: id, popped_at: poppedAt, read_at: readAt };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null);
    if (upserts.length === 0) return;

    const { error } = await db()
        .from('announcement_reads')
        .upsert(upserts, { onConflict: 'user_id,announcement_id' });
    if (error) throw new Error(`save announcement reads failed: ${error.message}`);
}

// ---------- 管理后台 ----------

export type AdminAnnouncement = AnnouncementRow & { readCount: number };

export async function listAdminAnnouncements(status: AnnouncementStatus | 'all'): Promise<AdminAnnouncement[]> {
    let query = db().from('announcements').select(COLUMNS).order('created_at', { ascending: false }).limit(200);
    if (status !== 'all') query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw new Error(`list announcements failed: ${error.message}`);
    const rows = (data ?? []) as AnnouncementRow[];

    const counts = await Promise.all(rows.map(async (row) => {
        const { count, error: countError } = await db()
            .from('announcement_reads')
            .select('announcement_id', { count: 'exact', head: true })
            .eq('announcement_id', row.id)
            .not('read_at', 'is', null);
        if (countError) {
            console.error('[announcements] read count failed:', countError);
            return 0;
        }
        return count ?? 0;
    }));
    return rows.map((row, index) => ({ ...row, readCount: counts[index] }));
}

export async function createAnnouncement(input: AnnouncementInput, createdBy: string): Promise<AnnouncementRow> {
    const { data, error } = await db()
        .from('announcements')
        .insert({ ...input, status: 'draft', created_by: createdBy })
        .select(COLUMNS)
        .single();
    if (error || !data) throw new Error(`create announcement failed: ${error?.message ?? 'no row'}`);
    return data as AnnouncementRow;
}

export async function updateAnnouncement(id: string, input: AnnouncementInput): Promise<AnnouncementRow | null> {
    const { data, error } = await db()
        .from('announcements')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(COLUMNS)
        .maybeSingle();
    if (error) throw new Error(`update announcement failed: ${error.message}`);
    return (data as AnnouncementRow | null) ?? null;
}

/** 发布时写入发布时间（重新发布已下线的公告也刷新时间，让它重新排到前面）。 */
export async function setAnnouncementStatus(id: string, status: AnnouncementStatus): Promise<AnnouncementRow | null> {
    const nowIso = new Date().toISOString();
    const patch: Record<string, unknown> = { status, updated_at: nowIso };
    if (status === 'published') patch.published_at = nowIso;
    const { data, error } = await db()
        .from('announcements')
        .update(patch)
        .eq('id', id)
        .select(COLUMNS)
        .maybeSingle();
    if (error) throw new Error(`update announcement status failed: ${error.message}`);
    return (data as AnnouncementRow | null) ?? null;
}

export async function deleteAnnouncement(id: string): Promise<void> {
    const { error } = await db().from('announcements').delete().eq('id', id);
    if (error) throw new Error(`delete announcement failed: ${error.message}`);
}
