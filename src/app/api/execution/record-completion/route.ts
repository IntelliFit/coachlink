import { NextResponse } from 'next/server';
import { getApiUserId } from '@/lib/getApiUserId';
import { serviceRoleSupabase as db } from '@/lib/supabaseClient';
import { validatePerformedOn } from '@coachlink/core/src/completionDate';
import { deriveEffectiveStartExecutionDay } from '@/lib/planProgress';
import { buildPlanDayFacts } from '@/lib/planDayFacts';
import { validateExecutionSubscriptionAccess } from '../_helpers/subscriptionAccess';
import { updateEstimatedEndDateForInstance } from '../updateEstimatedEndDate';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (message: string, status: number, code?: string) =>
  NextResponse.json({ success: false, message, code, data: null }, { status });

const SYSTEM_TIMEOUT_WRITE_WINDOW_MS = 5000;

/**
 * The page may still hold the row as it was before the 5-hour timeout closed it.
 * When that timeout is the only change since the student's copy, nothing they
 * recorded differs, so the confirmation proceeds against the current row.
 */
function expectedVersionAfterSystemTimeout(existing: any, expectedUpdatedAt: string) {
  if (!existing || String(existing.status) !== 'timed_out' || existing.close_reason !== 'hard_timeout_5h') return null;
  const expected = Date.parse(expectedUpdatedAt);
  const current = Date.parse(existing.updated_at || '');
  const timedOutAt = Date.parse(existing.ended_at || '');
  const lastSaved = Date.parse(existing.last_saved_at || '');
  if (![expected, current, timedOutAt].every(Number.isFinite) || expected >= current) return null;
  const timeoutWasLastWrite = Math.abs(current - timedOutAt) <= SYSTEM_TIMEOUT_WRITE_WINDOW_MS;
  const studentCopyPredatesTimeout = expected <= timedOutAt;
  const nothingSavedSinceCopy = !Number.isFinite(lastSaved) || lastSaved <= expected;
  return timeoutWasLastWrite && studentCopyPredatesTimeout && nothingSavedSinceCopy ? existing.updated_at as string : null;
}

/** Explicitly confirm a past workout/date. Does not invent weights, reps or sets. */
export async function POST(req: Request) {
  try {
    const userId = await getApiUserId(req);
    if (!userId) return fail('请先登录', 401);
    const body = await req.json();
    const { instanceId, dayIndex, performedOn, executionId, expectedUpdatedAt, requestId } = body;
    if (!uuid.test(instanceId || '') || !uuid.test(requestId || '') ||
      !Number.isInteger(dayIndex) || dayIndex < 1 ||
      (executionId && (!uuid.test(executionId) || !expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt))))) {
      return fail('补记参数不完整，请刷新页面重试', 400);
    }
    const { data: instance, error: planError } = await db.from('coach_plan_instances')
      .select('*').eq('id', instanceId).eq('student_id', userId).maybeSingle();
    if (planError) return fail('暂时无法核对计划', 503);
    if (!instance) return fail('无权访问这份计划', 403);
    const dateError = validatePerformedOn(performedOn, instance.start_date || instance.created_at);
    if (dateError) return fail(dateError, 400, 'INVALID_TRAINING_DATE');
    const days = Array.isArray(instance.training_days) ? instance.training_days : [];
    if (!days.some((d: any) => Number(d.dayIndex ?? d.day_index) === dayIndex && (d.type || 'training') === 'training')) {
      return fail('请选择原计划中的训练日', 400);
    }
    const { data: executions, error: executionsError } = await db.from('plan_instance_executions')
      .select('*').eq('instance_id', instanceId).eq('student_id', userId);
    if (executionsError) return fail('暂时无法核对训练记录', 503);
    const existing = executionId ? executions?.find(e => e.id === executionId && e.day_index === dayIndex) : null;
    if (executionId && !existing) return fail('训练记录已变化，请刷新后重试', 409);
    // A successful final-credit save can be retried after the response was lost.
    // Read the ledger before re-checking entitlement, but let the RPC verify the
    // exact payload and ownership under its transaction lock.
    const { data: priorRequest, error: requestError } = await db.from('plan_execution_date_confirmations')
      .select('request_id').eq('request_id', requestId).eq('student_id', userId).maybeSingle();
    if (requestError) return fail('补记服务尚未就绪，请确认数据库升级已完成', 503);
    // Correcting the date of an already charged workout must not require buying
    // more entitlement. New completions still go through normal access checks.
    if (!priorRequest && existing?.status !== 'completed') {
      const access = await validateExecutionSubscriptionAccess({ instanceId, studentId: userId, dayIndex });
      if (!access.allowed) return fail(access.message || '当前不能补记这一天', access.status);
    }
    let subscriptionStartDate: string | null = null;
    if (instance.coach_subscription_id) {
      const result = await db.from('coach_subscriptions').select('start_date')
        .eq('id', instance.coach_subscription_id).eq('student_id', userId).maybeSingle();
      if (result.error) return fail('暂时无法核对订阅起点', 503);
      subscriptionStartDate = result.data?.start_date || null;
    }
    const resolvedByDay = buildPlanDayFacts(executions || []);
    const effectiveStart = deriveEffectiveStartExecutionDay({
      storedStartExecutionDay: instance.start_execution_day, planDays: days,
      executionsByDayIndex: resolvedByDay, planStartDate: instance.start_date, subscriptionStartDate,
    });
    if (!priorRequest && dayIndex < effectiveStart && existing?.status !== 'completed') return fail('不能重复补记线下已完成的训练日', 400);
    const expectedVersion = executionId
      ? expectedVersionAfterSystemTimeout(existing, expectedUpdatedAt) || expectedUpdatedAt
      : null;
    const { data, error } = await db.rpc('record_plan_completion_date', {
      p_instance_id: instanceId, p_student_id: userId, p_day_index: dayIndex,
      p_performed_on: performedOn, p_execution_id: executionId || null,
      p_expected_updated_at: expectedVersion, p_request_id: requestId,
      p_start_execution_day: effectiveStart,
    });
    if (error) {
      const message = String(error.message || '');
      if (message.includes('PREVIOUS_TRAINING_UNRESOLVED')) return fail('请先确认原计划中前面的训练或恢复任务，再补记这一天', 409);
      if (/WRITE_CONFLICT|OTHER_ATTEMPT|REQUEST_ID_CONFLICT/.test(message)) return fail('这一天的记录已变化，请刷新后核对，未覆盖任何记录', 409);
      if (/INVALID_TRAINING_DATE|TRAINING_DAY_NOT_FOUND|NOT_FINISHABLE|PLAN_NOT_CURRENT/.test(message)) return fail('日期或计划状态不允许本次补记', 400);
      if (error.code === 'PGRST202') return fail('补记服务尚未启用，请先完成服务器数据库升级', 503);
      console.error('[record-completion]', error);
      return fail('补记失败，记录未修改', 500);
    }
    const saved = Array.isArray(data) ? data[0] : data;
    if (!saved) return fail('补记未成功，请刷新核对', 409);
    await updateEstimatedEndDateForInstance(instanceId);
    return NextResponse.json({ success: true, data: saved, message: '已按实际训练日期记录；未补填重量、次数或组数' });
  } catch (error) {
    console.error('[record-completion]', error);
    return fail('暂时无法补记，请稍后重试', 500);
  }
}
