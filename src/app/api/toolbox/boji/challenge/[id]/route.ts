import { NextRequest, NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { getBojiChallengeView } from '@/lib/bojiScores';
import type { ApiData } from '@/types/api';
import type { BojiChallengeView } from '@coachlink/core/src/bojiInsights';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 薄肌 PK 卡：分享链接里的成绩 id → 发起人的昵称、头像和分数（没有照片）。
 * 不登录也能看（好友点开链接先看到对手）；发起人本人还能看到应战记录。
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const viewerId = await getApiUserId(request);
    const view = await getBojiChallengeView({ id, viewerId });
    if (!view) {
      return NextResponse.json<ApiData<null>>({ success: false, message: '这场 PK 不存在或已失效', data: null }, { status: 404 });
    }
    return NextResponse.json<ApiData<BojiChallengeView>>({ success: true, message: 'ok', data: view });
  } catch (error) {
    console.error('[boji] challenge view failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json<ApiData<null>>({ success: false, message: 'PK 信息暂时打不开，请稍后再试', data: null }, { status: 500 });
  }
}
