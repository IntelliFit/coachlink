import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { ApiData } from '@/types/api';

type AdminCheck = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function requireAnnouncementAdmin(): Promise<AdminCheck> {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return { ok: false, response: fail('未登录', 401) };
    }
    if (!(session.user as { is_admin?: boolean })?.is_admin) {
        return { ok: false, response: fail('无权限', 403) };
    }
    return { ok: true, userId: session.user.id };
}

export function fail(message: string, status: number) {
    return NextResponse.json<ApiData<null>>({ success: false, message, data: null }, { status });
}
