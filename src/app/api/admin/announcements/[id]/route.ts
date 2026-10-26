import { NextResponse } from 'next/server';
import { deleteAnnouncement, updateAnnouncement } from '@/lib/announcementStore';
import { isUuid, validateAnnouncementInput, type AnnouncementRow } from '@/lib/announcements';
import type { ApiData } from '@/types/api';
import { fail, requireAnnouncementAdmin } from '../adminAuth';

type Context = { params: Promise<{ id: string }> };

export async function PUT(req: Request, context: Context) {
    const auth = await requireAnnouncementAdmin();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    if (!isUuid(id)) return fail('公告 ID 无效', 400);

    const validation = validateAnnouncementInput(await req.json().catch(() => null));
    if (!validation.ok) return fail(validation.message, 400);
    try {
        const item = await updateAnnouncement(id, validation.value);
        if (!item) return fail('公告不存在', 404);
        return NextResponse.json<ApiData<{ item: AnnouncementRow }>>({ success: true, data: { item } });
    } catch (error) {
        console.error('[admin/announcements] update failed:', error);
        return fail('保存公告失败', 500);
    }
}

export async function DELETE(_req: Request, context: Context) {
    const auth = await requireAnnouncementAdmin();
    if (!auth.ok) return auth.response;
    const { id } = await context.params;
    if (!isUuid(id)) return fail('公告 ID 无效', 400);
    try {
        await deleteAnnouncement(id);
        return NextResponse.json<ApiData<null>>({ success: true, data: null });
    } catch (error) {
        console.error('[admin/announcements] delete failed:', error);
        return fail('删除公告失败', 500);
    }
}
