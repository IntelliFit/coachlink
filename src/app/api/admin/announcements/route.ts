import { NextResponse } from 'next/server';
import {
    createAnnouncement,
    listAdminAnnouncements,
    type AdminAnnouncement,
} from '@/lib/announcementStore';
import {
    ANNOUNCEMENT_STATUSES,
    validateAnnouncementInput,
    type AnnouncementRow,
    type AnnouncementStatus,
} from '@/lib/announcements';
import type { ApiData } from '@/types/api';
import { fail, requireAnnouncementAdmin } from './adminAuth';

export async function GET(req: Request) {
    const auth = await requireAnnouncementAdmin();
    if (!auth.ok) return auth.response;

    const raw = new URL(req.url).searchParams.get('status') || 'all';
    const status = (ANNOUNCEMENT_STATUSES as readonly string[]).includes(raw) ? raw as AnnouncementStatus : 'all';
    try {
        const items = await listAdminAnnouncements(status);
        return NextResponse.json<ApiData<{ items: AdminAnnouncement[] }>>({ success: true, data: { items } });
    } catch (error) {
        console.error('[admin/announcements] list failed:', error);
        return fail('加载公告失败', 500);
    }
}

/** 新建公告（草稿）。发布走 /[id]/status。 */
export async function POST(req: Request) {
    const auth = await requireAnnouncementAdmin();
    if (!auth.ok) return auth.response;

    const validation = validateAnnouncementInput(await req.json().catch(() => null));
    if (!validation.ok) return fail(validation.message, 400);
    try {
        const item = await createAnnouncement(validation.value, auth.userId);
        return NextResponse.json<ApiData<{ item: AnnouncementRow }>>({ success: true, data: { item } });
    } catch (error) {
        console.error('[admin/announcements] create failed:', error);
        return fail('创建公告失败', 500);
    }
}
