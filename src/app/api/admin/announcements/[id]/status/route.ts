import { NextResponse } from 'next/server';
import { setAnnouncementStatus } from '@/lib/announcementStore';
import { ANNOUNCEMENT_STATUSES, isUuid, type AnnouncementRow, type AnnouncementStatus } from '@/lib/announcements';
import type { ApiData } from '@/types/api';
import { fail, requireAnnouncementAdmin } from '../../adminAuth';

/** body: { status: 'draft' | 'published' | 'archived' } */
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
    const auth = await requireAnnouncementAdmin();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    if (!isUuid(id)) return fail('公告 ID 无效', 400);

    const body = await req.json().catch(() => null) as { status?: unknown } | null;
    const status = body?.status;
    if (typeof status !== 'string' || !(ANNOUNCEMENT_STATUSES as readonly string[]).includes(status)) {
        return fail('状态无效', 400);
    }
    try {
        const item = await setAnnouncementStatus(id, status as AnnouncementStatus);
        if (!item) return fail('公告不存在', 404);
        return NextResponse.json<ApiData<{ item: AnnouncementRow }>>({ success: true, data: { item } });
    } catch (error) {
        console.error('[admin/announcements] status failed:', error);
        return fail('更新状态失败', 500);
    }
}
