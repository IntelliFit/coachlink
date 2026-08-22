import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { MOTION_GAME_CONFIG, isMotionGameKey } from '@/lib/motionGameLeaderboard';
import { serviceRoleSupabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json({ success: false, message: '用户未登录', data: null }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as { gameKey?: unknown; clientVersion?: unknown } | null;
  if (!isMotionGameKey(body?.gameKey)) {
    return NextResponse.json({ success: false, message: '不支持的游戏类型', data: null }, { status: 400 });
  }

  const db = serviceRoleSupabase as any;
  const { error: abandonError } = await db
    .from('motion_game_runs')
    .update({ status: 'abandoned', completed_at: new Date().toISOString() })
    .eq('user_id', auth.userId)
    .eq('game_key', body.gameKey)
    .eq('status', 'active');

  if (abandonError) {
    console.error('[motion-game] abandon previous session failed:', abandonError);
    return NextResponse.json({ success: false, message: '排行榜会话启动失败', data: null }, { status: 500 });
  }

  const clientVersion = typeof body.clientVersion === 'string'
    ? body.clientVersion.trim().slice(0, 80)
    : null;
  const { data: run, error } = await db
    .from('motion_game_runs')
    .insert({
      user_id: auth.userId,
      game_key: body.gameKey,
      status: 'active',
      client_version: clientVersion || null,
    })
    .select('id, started_at')
    .single();

  if (error || !run) {
    console.error('[motion-game] create session failed:', error);
    return NextResponse.json({ success: false, message: '排行榜会话启动失败', data: null }, { status: 500 });
  }

  const { data: personalBest } = await db
    .from('motion_game_best_scores')
    .select('score')
    .eq('user_id', auth.userId)
    .eq('game_key', body.gameKey)
    .maybeSingle();

  const templateId = MOTION_GAME_CONFIG[body.gameKey].templateId;
  return NextResponse.json({
    success: true,
    message: '排行榜会话已启动',
    data: {
      sessionId: run.id,
      startedAt: run.started_at,
      bestScore: Number(personalBest?.score || 0),
      templateId,
      rankingPath: `/discovery/ranking/detail?id=${templateId}`,
    },
  });
}
