import { CoachLinkTable } from "@/types";

export interface BulkCreateAiInstancesDto {
  /**
   * explicit: generate for given subscriptionIds
   * no_plan: auto-detect all active subscriptions without any plan instance
   */
  mode?: "explicit" | "no_plan";
  subscriptionIds?: string[];
  /**
   * Only used when mode=no_plan. These subscription ids will be excluded (manual uncheck).
   */
  excludedSubscriptionIds?: string[];
  startWeek?: number;
  startDay?: number;
  keepOriginalIndex?: boolean;
  useLLM?: boolean;
}

export interface BulkCreateAiInstancesResultItem {
  subscriptionId: string;
  success: boolean;
  template?: CoachLinkTable["coach_plan_instances"]["Insert"] | null;
  error?: string;
}

export interface BulkCreateAiInstancesResponseDto {
  total: number;
  successCount: number;
  failedCount: number;
  results: BulkCreateAiInstancesResultItem[];
}

