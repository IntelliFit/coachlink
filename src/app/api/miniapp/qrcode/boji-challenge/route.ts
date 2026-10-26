import { NextRequest, NextResponse } from 'next/server';
import { isBojiScoreId } from '@coachlink/core/src/bojiInsights';
import { bojiChallengeScene } from '@coachlink/core/src/bojiDisplay';
import { supabaseBojiScoreStore } from '@/lib/bojiScores';
import { fetchMiniappCode, resolveMiniappEnvVersion } from '@/lib/miniappCode';

export const runtime = 'nodejs';

const PAGE = 'toolbox/boji/index';

/**
 * 薄肌 PK 海报上的小程序码：扫码打开薄肌检测器并带上发起人的成绩 id。
 * 公开接口（海报在分享前生成，码里只有成绩 id，没有个人信息）。
 * 先确认成绩存在再调微信，防止有人用编造的 id 刷小程序码的调用额度。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get('id') || '').trim();
  if (!isBojiScoreId(id)) {
    return NextResponse.json({ success: false, message: 'Missing or invalid id' }, { status: 400 });
  }
  try {
    const score = await supabaseBojiScoreStore().find(id);
    if (!score) {
      return NextResponse.json({ success: false, message: 'Score not found' }, { status: 404 });
    }
    const png = await fetchMiniappCode({
      scene: bojiChallengeScene(id),
      page: PAGE,
      envVersion: resolveMiniappEnvVersion(searchParams.get('envVersion')),
    });
    return new NextResponse(png, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (error) {
    console.error('[miniapp][qrcode][boji-challenge] failed:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ success: false, message: 'Failed to generate miniapp code' }, { status: 502 });
  }
}
