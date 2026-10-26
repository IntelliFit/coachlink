import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { markAnnouncements } from '@/lib/announcementStore';
import { normalizeAnnouncementIds } from '@/lib/announcements';
import type { ApiData } from '@/types/api';

/** body: { ids: string[], kind: 'popped' | 'read' } */
export async function POST(req: Request) {
    const userId = await getApiUserId(req);
    if (!userId) {
        return NextResponse.json<ApiData<null>>({ success: false, message: '未登录', data: null }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as { ids?: unknown; kind?: unknown } | null;
    const kind = body?.kind;
    if (kind !== 'popped' && kind !== 'read') {
        return NextResponse.json<ApiData<null>>({ success: false, message: '参数无效', data: null }, { status: 400 });
    }
    const ids = normalizeAnnouncementIds(body?.ids);
    if (ids.length === 0) {
        return NextResponse.json<ApiData<null>>({ success: false, message: '缺少通知 ID', data: null }, { status: 400 });
    }

    try {
        await markAnnouncements(userId, ids, kind);
        return NextResponse.json<ApiData<null>>({ success: true, data: null });
    } catch (error) {
        console.error('[announcements] mark failed:', error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: '更新通知状态失败', data: null },
            { status: 500 },
        );
    }
}
