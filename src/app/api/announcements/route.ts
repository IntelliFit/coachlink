import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { loadAnnouncementFeed } from '@/lib/announcementStore';
import type { AnnouncementFeed } from '@/lib/announcements';
import type { ApiData } from '@/types/api';

export const dynamic = 'force-dynamic';

/** 当前用户可见的公告、未读数和本次需要弹出的公告。未登录返回空列表。 */
export async function GET(req: Request) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json<ApiData<AnnouncementFeed>>({
            success: true,
            data: { items: [], unreadCount: 0, popupIds: [] },
        });
    }
    try {
        const feed = await loadAnnouncementFeed(userId);
        return NextResponse.json<ApiData<AnnouncementFeed>>({ success: true, data: feed });
    } catch (error) {
        console.error('[announcements] load feed failed:', error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '加载通知失败', data: null },
            { status: 500 },
        );
    }
}
