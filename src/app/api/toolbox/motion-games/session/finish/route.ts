import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  MOTION_GAME_CONFIG,
  isMotionGameKey,
  isPlausibleMotionGameScore,
  parseLockRatio,
  parseNonNegativeInteger,
} from '@/lib/motionGameLeaderboard';
import { serviceRoleSupabase } from '@/lib/supabaseClient';

const MAX_SESSION_WALL_MS = 6 * 60 * 60 * 1000;
const WALL_CLOCK_TOLERANCE_MS = 15_000;

type FinishBody = {
  sessionId?: unknown;
  gameKey?: unknown;
  score?: unknown;
  elapsedMs?: unknown;
  actionCount?: unknown;
  lockRatio?: unknown;
};

export async function POST(req: Request) {
  const auth = await getAuthUser(req);
  if (!auth.isAuthenticated || !auth.userId) {
    return NextResponse.json({ success: false, message: '用户未登录', data: null }, { status: 401 });
  }

  const body = await req.json().catch(() => null) as FinishBody | null;
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
  const score = parseNonNegativeInteger(body?.score);
  const elapsedMs = parseNonNegativeInteger(body?.elapsedMs);
  const actionCount = parseNonNegativeInteger(body?.actionCount);
  const lockRatio = parseLockRatio(body?.lockRatio);

  if (!sessionId || !isMotionGameKey(body?.gameKey) || score === null || elapsedMs === null || actionCount === null || lockRatio === null) {
    return NextResponse.json({ success: false, message: '成绩参数不完整', data: null }, { status: 400 });
  }
  if (elapsedMs > MAX_SESSION_WALL_MS || !isPlausibleMotionGameScore(score, elapsedMs)) {
    return NextResponse.json({ success: false, message: '成绩校验未通过', data: null }, { status: 400 });
  }

  const db = serviceRoleSupabase as any;
  const { data: run, error: runError } = await db
    .from('motion_game_runs')
    .select('id, game_key, status, started_at')
    .eq('id', sessionId)
    .eq('user_id', auth.userId)
    .maybeSingle();

  if (runError || !run || run.game_key !== body.gameKey || run.status === 'abandoned') {
    return NextResponse.json({ success: false, message: '排行榜会话无效或已过期', data: null }, { status: 409 });
  }

  const wallElapsedMs = Date.now() - new Date(run.started_at).getTime();
  if (!Number.isFinite(wallElapsedMs) || wallElapsedMs < 0 || elapsedMs > wallElapsedMs + WALL_CLOCK_TOLERANCE_MS) {
    return NextResponse.json({ success: false, message: '成绩用时校验未通过', data: null }, { status: 400 });
  }

  const { data, error } = await db.rpc('finish_motion_game_run', {
    p_run_id: sessionId,
    p_user_id: auth.userId,
    p_score: score,
    p_elapsed_ms: elapsedMs,
    p_action_count: actionCount,
    p_lock_ratio: lockRatio,
  });

  const result = Array.isArray(data) ? data[0] : data;
  if (error || !result) {
    console.error('[motion-game] finish session failed:', error);
    return NextResponse.json({ success: false, message: '成绩同步失败，请稍后重试', data: null }, { status: 500 });
  }

  const templateId = MOTION_GAME_CONFIG[body.gameKey].templateId;
  return NextResponse.json({
    success: true,
    message: result.is_personal_best ? '已刷新个人最佳' : '成绩已同步',
    data: {
      isPersonalBest: Boolean(result.is_personal_best),
      rank: Number(result.player_rank),
      total: Number(result.player_total),
      percentile: Number(result.percentile),
      bestScore: Number(result.best_score),
      bestElapsedMs: Number(result.best_elapsed_ms),
      bestActionCount: Number(result.best_action_count),
      templateId,
      rankingPath: `/discovery/ranking/detail?id=${templateId}`,
    },
  });
}
