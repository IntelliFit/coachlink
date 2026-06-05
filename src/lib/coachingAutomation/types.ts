export type InitialPlanMode = "off" | "draft" | "auto_publish";
export type FeedbackAdjustmentMode =
  | "off"
  | "draft_notify"
  | "auto_apply_low_risk"
  | "auto_apply_safe";
export type NextPhaseMode = "off" | "draft_notify" | "auto_publish_if_credits";
export type RiskGuardMode = "strict" | "normal";
export type AutomationRiskLevel = "low" | "medium" | "high";

export type AutomationJobType =
  | "initial_plan"
  | "feedback_adjustment"
  | "next_phase"
  | "renewal_check"
  | "subscription_end";

export type AutomationJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "needs_coach_review"
  | "skipped";

export interface AutomationPolicy {
  initialPlanMode: InitialPlanMode;
  feedbackAdjustmentMode: FeedbackAdjustmentMode;
  nextPhaseMode: NextPhaseMode;
  riskGuardMode: RiskGuardMode;
  source: "default" | "coach" | "subscription";
}

export interface AutomationContext {
  subscriptionId: string;
  coachId: string;
  studentId: string;
  coachUserId: string | null;
}

export interface AutomationJobRow {
  id: string;
  type: AutomationJobType;
  status: AutomationJobStatus;
  idempotency_key: string;
  subscription_id?: string | null;
  coach_id?: string | null;
  student_id?: string | null;
  plan_instance_id?: string | null;
  feedback_id?: string | null;
  input_snapshot?: any;
  output_snapshot?: any;
  error_message?: string | null;
}

export interface FeedbackPatchResult {
  riskLevel: AutomationRiskLevel;
  summary: string;
  proposedPatch: Record<string, unknown>;
  updatedTrainingDays?: any[];
  requiresCoachReview: boolean;
}
