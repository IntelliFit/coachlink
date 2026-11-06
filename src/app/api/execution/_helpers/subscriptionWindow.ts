import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { toBeijingDateKey } from "@/lib/beijingTime";

/**
 * B1: a subscription starts when the student actually begins training. The first real start
 * writes coach_subscriptions.start_date (and the plan's D1 date when it is day 1).
 *
 * A student adding a light task (diet, cardio, habit) also creates the day's execution, but that
 * is not training: those starts pass `purpose: 'light_task'` and leave the window closed. The
 * window then opens the first time the student really starts that day, even though the
 * execution row already exists.
 */
export async function startSubscriptionWindowIfNeeded(params: {
    subscriptionId: string | null | undefined;
    instanceId: string;
    dayIndex: number;
    startedAt: string;
}): Promise<void> {
    const { subscriptionId, instanceId, dayIndex, startedAt } = params;
    if (!subscriptionId) return;
    try {
        const { data: subRow } = await serviceRoleSupabase
            .from("coach_subscriptions")
            .select("id, status, start_date")
            .eq("id", subscriptionId)
            .maybeSingle();
        if (!subRow || subRow.status !== "active" || subRow.start_date) return;

        // Only open a window that is still closed, so a concurrent start cannot move it.
        await serviceRoleSupabase
            .from("coach_subscriptions")
            .update({ start_date: startedAt, updated_at: startedAt } as any)
            .eq("id", subscriptionId)
            .is("start_date", null);

        // D1 必须以第一次实际训练日期为准，覆盖分配计划时预填的日期；后续 revision 再继承这个真实键点。
        if (Number(dayIndex) === 1) {
            await serviceRoleSupabase
                .from("coach_plan_instances" as any)
                .update({ start_date: toBeijingDateKey(startedAt), updated_at: startedAt } as any)
                .eq("id", instanceId);
        }
    } catch (e) {
        console.error("[execution/start] Failed to start subscription window:", e);
    }
}
