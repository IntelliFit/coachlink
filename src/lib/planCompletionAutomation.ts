import { after } from "next/server";
import { onPlanProgressChanged } from "@/lib/coachingAutomation";

/**
 * Run next-phase automation after the response has been sent, so a student
 * opening "today's training" never waits for coach notifications. Call this
 * only from the request that actually moved the plan to completed.
 */
export function schedulePlanCompletionAutomation(
    instanceId: string,
    triggerSource = "plan_completed",
) {
    const id = String(instanceId || "").trim();
    if (!id) return;

    after(async () => {
        try {
            const result = await onPlanProgressChanged(id, triggerSource);
            if (result?.reason === "next_phase_failed" || result?.reason === "instance_not_found") {
                console.warn("[plan-completion] next-phase automation did not finish:", {
                    instanceId: id,
                    reason: result.reason,
                });
            }
        } catch (error) {
            console.error("[plan-completion] next-phase automation failed:", { instanceId: id, error });
        }
    });
}
