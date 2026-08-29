export const POWER_ANALYSIS_CHALLENGE_KEYS = ["power", "speed"] as const;

export type PowerAnalysisChallengeKey = (typeof POWER_ANALYSIS_CHALLENGE_KEYS)[number];

export const POWER_ANALYSIS_CHALLENGE_CONFIG: Record<PowerAnalysisChallengeKey, {
  templateId: string;
  templateType: string;
  rankByField: string;
  scoreColumn: "best_power_w" | "best_velocity_mps";
  modeColumn: "best_power_mode" | "best_velocity_mode";
  jobIdColumn: "best_power_job_id" | "best_velocity_job_id";
  achievedAtColumn: "best_power_achieved_at" | "best_velocity_achieved_at";
  unit: "W" | "m/s";
  digits: 0 | 2;
}> = {
  power: {
    templateId: "b7bc1548-08ed-4f52-90cc-f5b22a785103",
    templateType: "power_analysis_power",
    rankByField: "最高功率（W）",
    scoreColumn: "best_power_w",
    modeColumn: "best_power_mode",
    jobIdColumn: "best_power_job_id",
    achievedAtColumn: "best_power_achieved_at",
    unit: "W",
    digits: 0,
  },
  speed: {
    templateId: "b7bc1548-08ed-4f52-90cc-f5b22a785104",
    templateType: "power_analysis_speed",
    rankByField: "最快速度（m/s）",
    scoreColumn: "best_velocity_mps",
    modeColumn: "best_velocity_mode",
    jobIdColumn: "best_velocity_job_id",
    achievedAtColumn: "best_velocity_achieved_at",
    unit: "m/s",
    digits: 2,
  },
};

export function findPowerAnalysisChallengeByTemplateId(templateId: unknown) {
  return Object.entries(POWER_ANALYSIS_CHALLENGE_CONFIG).find(
    ([, config]) => config.templateId === templateId,
  ) as [PowerAnalysisChallengeKey, (typeof POWER_ANALYSIS_CHALLENGE_CONFIG)[PowerAnalysisChallengeKey]] | undefined;
}

export function findPowerAnalysisChallengeByType(type: unknown) {
  return Object.entries(POWER_ANALYSIS_CHALLENGE_CONFIG).find(
    ([, config]) => config.templateType === type,
  ) as [PowerAnalysisChallengeKey, (typeof POWER_ANALYSIS_CHALLENGE_CONFIG)[PowerAnalysisChallengeKey]] | undefined;
}
