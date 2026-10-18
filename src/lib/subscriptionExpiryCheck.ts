import defaultSupabase from "@/lib/supabaseClient";
import { findDoubleChargedCarriedDays } from "@/lib/subscriptionCarriedProgress";
import { deriveSubscriptionBalance } from "@/lib/subscriptionBalance";
import { readAllRowsByIdChunks, readAllRowsByKeyset } from "@/lib/supabaseKeysetPages";

const PLAN_STATUSES = ["active", "paused", "completed", "scheduled", "archived"];

export type SubscriptionExpiryCheckResult =
    | {
        ok: true;
        expiredCount: number;
        refreshedCount: number;
        cancelledCount: number;
        expiredSubscriptionIds: string[];
        heldForReviewIds: string[];
    }
    | { ok: false; stage: "subscriptions" | "plans" | "executions" | "write"; message: string };

function fail(
    stage: "subscriptions" | "plans" | "executions" | "write",
    message: string,
    error: unknown,
): SubscriptionExpiryCheckResult {
    console.error(`[subscription-expiry] ${message}`, error);
    return { ok: false, stage, message };
}

function groupBy<T>(rows: T[], keyOf: (row: T) => string) {
    const groups = new Map<string, T[]>();
    for (const row of rows) {
        const key = keyOf(row);
        if (!key) continue;
        groups.set(key, [...(groups.get(key) || []), row]);
    }
    return groups;
}

/**
 * B1 expiry: a subscription ends when its paid credits are used up, not by
 * calendar. Refreshes the displayed end date, marks used-up subscriptions and
 * cancels them after the grace period. Every read is fully paginated; any read
 * failure aborts before the first write. Subscriptions whose balance includes
 * double-charged carried days are never auto-cancelled; they are reported for
 * manual review instead.
 */
export async function runSubscriptionExpiryCheck(
    params: { db?: any; now?: Date } = {},
): Promise<SubscriptionExpiryCheckResult> {
    const db = params.db ?? defaultSupabase;
    const now = params.now ?? new Date();
    const nowIso = now.toISOString();

    const candidatesResult = await readAllRowsByKeyset<any>((afterId) => {
        let query = db
            .from("coach_subscriptions")
            .select("id, student_id, coach_id, status, start_date, end_date, subscribed_weeks")
            .eq("status", "active")
            .not("start_date", "is", null)
            .gt("subscribed_weeks", 0);
        if (afterId) query = query.gt("id", afterId);
        return query.order("id", { ascending: true });
    });
    if (candidatesResult.error) return fail("subscriptions", "读取订阅失败，未调整订阅", candidatesResult.error);
    const candidates = candidatesResult.data;
    if (candidates.length === 0) {
        return { ok: true, expiredCount: 0, refreshedCount: 0, cancelledCount: 0, expiredSubscriptionIds: [], heldForReviewIds: [] };
    }

    const instancesResult = await readAllRowsByIdChunks<any>(candidates.map((sub: any) => sub.id), (chunk, afterId) => {
        let query = db
            .from("coach_plan_instances")
            .select("id, coach_subscription_id, training_days, start_execution_day, created_at, status, entitlement_consumption_policy")
            .in("coach_subscription_id", chunk)
            .in("status", PLAN_STATUSES);
        if (afterId) query = query.gt("id", afterId);
        return query.order("id", { ascending: true });
    });
    if (instancesResult.error) return fail("plans", "读取计划失败，未调整订阅", instancesResult.error);
    // Newest first: the first non-archived plan per subscription is its current one.
    const instances = [...instancesResult.data].sort((left, right) =>
        String(right?.created_at || "").localeCompare(String(left?.created_at || ""))
    );

    const executionsResult = await readAllRowsByIdChunks<any>(instances.map((instance) => instance.id), (chunk, afterId) => {
        let query = db
            .from("plan_instance_executions")
            .select("id, instance_id, day_index, status, started_at, completed_at, created_at")
            .in("instance_id", chunk)
            .eq("status", "completed");
        if (afterId) query = query.gt("id", afterId);
        return query.order("id", { ascending: true });
    });
    if (executionsResult.error) return fail("executions", "读取训练记录失败，未调整订阅", executionsResult.error);

    const instancesBySub = groupBy(instances, (instance) => String(instance?.coach_subscription_id || ""));
    const executionsByInstance = groupBy(executionsResult.data, (execution) => String(execution?.instance_id || ""));

    const toExpire: Array<{ id: string; end_date: string }> = [];
    const toRefresh: Array<{ id: string; end_date: string }> = [];
    const toCancel: Array<{ id: string; student_id: string | null; subscribed_weeks: unknown }> = [];
    const heldForReviewIds: string[] = [];

    for (const sub of candidates) {
        const weeks = Number(sub?.subscribed_weeks || 0);
        if (!weeks || weeks <= 0) continue;
        const subInstances = instancesBySub.get(sub.id) || [];
        const subExecutions = subInstances.flatMap((instance) => executionsByInstance.get(instance.id) || []);

        let model;
        try {
            // Same rule as the student's training gate; an older completed plan
            // next to the running one must not be mistaken for the current plan.
            const balance = deriveSubscriptionBalance({ subscription: sub, instances: subInstances, executions: subExecutions, now });
            if (!balance) continue;
            model = balance.state;
        } catch (error) {
            // Unknown history is not unused or used-up credit; leave this subscription untouched.
            console.error("[subscription-expiry] skipped subscription with unreadable plan history:", { subscriptionId: sub.id, error });
            continue;
        }

        if (model.totalCredits <= 0) continue;
        if (model.remainingCredits === 0) {
            toExpire.push({ id: sub.id, end_date: model.displayEndDate || nowIso });
            if (!model.shouldAutoCancel) continue;
            const doubleCharged = findDoubleChargedCarriedDays({ instances: subInstances, executions: subExecutions });
            if (doubleCharged.length > 0) {
                heldForReviewIds.push(sub.id);
                console.warn("[subscription-expiry] auto-cancel held for review; carried days were charged more than once", {
                    subscriptionId: sub.id,
                    versions: doubleCharged,
                });
                continue;
            }
            toCancel.push({ id: sub.id, student_id: sub.student_id || null, subscribed_weeks: sub.subscribed_weeks });
            continue;
        }
        if (model.displayEndDate) toRefresh.push({ id: sub.id, end_date: model.displayEndDate });
    }

    const writeEndDates = async (items: Array<{ id: string; end_date: string }>) => {
        const results = await Promise.all(items.map((item) =>
            db.from("coach_subscriptions").update({ end_date: item.end_date, updated_at: nowIso }).eq("id", item.id)
        ));
        return results.find((result: any) => result?.error)?.error || null;
    };

    const refreshError = await writeEndDates(toRefresh);
    if (refreshError) return fail("write", "刷新订阅预计完成日失败", refreshError);
    const expireError = await writeEndDates(toExpire);
    if (expireError) return fail("write", "更新订阅结束时间失败", expireError);

    let cancelledCount = 0;
    const cancelledStudentIds: string[] = [];
    for (const item of toCancel) {
        // A renewal paid after the read changes subscribed_weeks; such a row
        // no longer matches and stays active.
        const { data: cancelledRows, error: cancelError } = await db
            .from("coach_subscriptions")
            .update({ status: "cancelled", updated_at: nowIso })
            .eq("id", item.id)
            .eq("status", "active")
            .eq("subscribed_weeks", item.subscribed_weeks)
            .select("id, student_id");
        if (cancelError) {
            console.error("[subscription-expiry] auto-cancel failed; student coach link kept:", { subscriptionId: item.id, cancelError });
            continue;
        }
        // PostgREST returns the updated rows; an empty list means nothing changed.
        if (Array.isArray(cancelledRows) && cancelledRows.length === 0) continue;
        cancelledCount += 1;
        const studentId = (Array.isArray(cancelledRows) ? cancelledRows[0]?.student_id : null) || item.student_id;
        if (studentId) cancelledStudentIds.push(studentId);
    }
    if (cancelledStudentIds.length > 0) {
        const { error: userError } = await db.from("users").update({ invitation_coach_id: null }).in("id", cancelledStudentIds);
        if (userError) console.error("[subscription-expiry] clearing invitation coach failed:", userError);
    }

    return {
        ok: true,
        expiredCount: toExpire.length,
        refreshedCount: toRefresh.length,
        cancelledCount,
        expiredSubscriptionIds: toExpire.map((item) => item.id),
        heldForReviewIds,
    };
}

let runningCheck: Promise<SubscriptionExpiryCheckResult> | null = null;

/** At most one run per process; callers arriving during a run share its result. */
export function runSubscriptionExpiryCheckOnce(): Promise<SubscriptionExpiryCheckResult> {
    if (!runningCheck) {
        runningCheck = runSubscriptionExpiryCheck().finally(() => {
            runningCheck = null;
        });
    }
    return runningCheck;
}
