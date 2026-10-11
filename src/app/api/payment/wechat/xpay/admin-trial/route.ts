import { NextRequest, NextResponse } from 'next/server';
import { readXPayTrialState, requireXPayTrialAdmin } from '@/lib/wechatXPayAdminTrial';

export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
    try {
        const userId = await requireXPayTrialAdmin(request);
        return NextResponse.json({ success: true, data: await readXPayTrialState(userId) });
    } catch (error) {
        return NextResponse.json({ success: false, message: (error as Error).message }, { status: 403 });
    }
}
