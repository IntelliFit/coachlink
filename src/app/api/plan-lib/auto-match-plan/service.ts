import { onSubscriptionActivated, type SubscriptionActivatedOptions } from "@/lib/coachingAutomation";

export interface AutoMatchPlanResult {
  success: boolean;
  reason?: string;
  error?: string;
}

/**
 * Compatibility wrapper for the older subscription-to-plan call sites.
 *
 * New automation behavior lives in `src/lib/coachingAutomation`, where the
 * policy resolution, idempotency key, job status, failure record and the
 * coach's result message are kept together. Callers must not send their own
 * "plan assigned / failed" message on top of it.
 */
export async function autoMatchPlanForSubscription(
  subscriptionId: string,
  _actorUserId: string,
  _actorCoachId: string,
  options: SubscriptionActivatedOptions = {},
): Promise<AutoMatchPlanResult> {
  try {
    const result = await onSubscriptionActivated(subscriptionId, "legacy_auto_match_plan", options);
    return {
      success: Boolean(result.success),
      reason: result.reason,
      error: result.error,
    };
  } catch (error: any) {
    console.error(
      `[auto-match-plan] automation failed (subscriptionId=${subscriptionId}):`,
      error?.message || error,
    );
    return {
      success: false,
      reason: error?.message || "auto_match_failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
