import { NextResponse } from 'next/server';

import type { ApiData } from '@/types/api';
import type { AppVersionInfo } from '@/lib/version';
import { getAppVersionInfo } from '@/lib/version';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    const data = getAppVersionInfo();

    return NextResponse.json<ApiData<AppVersionInfo>>({
        success: true,
        message: '版本信息获取成功',
        data,
    });
}
