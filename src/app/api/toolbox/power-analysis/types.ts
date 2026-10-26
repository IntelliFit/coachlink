import type { PowerAnalysisMode } from "@coachlink/core/src/powerAnalysisModes";
import type { PowerAnalysisJobStatus } from "@coachlink/core/src/powerAnalysisJobs";

export type { PowerAnalysisMode, PowerAnalysisJobStatus };
export type PowerAnalysisQuality = "compressed" | "original";
export type PowerAnalysisOverlayLanguage = "zh" | "en";

export interface PowerAnalysisRepMetric {
  repIndex: number;
  displacementM: number;
  ascentTimeS: number;
  avgPowerW: number;
  horsepowerHp: number;
  maxVelocityMps: number;
  /** Displacement / concentric time. */
  meanVelocityMps?: number;
  startTimeS?: number;
  endTimeS?: number;
  pauseS?: number | null;
  barHorizontalTravelCm?: number;
  /** Custom mode: time toward the far end of the motion, back to the start, and held there. */
  phase1TimeS?: number;
  phase2TimeS?: number;
  holdTimeS?: number;
  /** Custom mode: main joint angle range within the rep. */
  jointMinDeg?: number;
  jointMaxDeg?: number;
}

export interface PowerAnalysisTimeSeriesPoint {
  timeS: number;
  displacementM: number;
  velocityMps: number;
  powerW: number;
}

export interface PowerAnalysisRating {
  level: "low" | "steady" | "powerful" | "beast";
  normalizedPowerWPerKg: number;
  labelZh: string;
  labelEn: string;
  descriptionZh: string;
  descriptionEn: string;
}

export type PowerAnalysisCheckStatus = "good" | "info" | "warn" | "issue" | "unavailable";

export interface PowerAnalysisCheck {
  code: string;
  titleZh: string;
  status: PowerAnalysisCheckStatus;
  detailZh: string;
  repIndexes: number[];
  timesS: number[];
  value: number | null;
  unit: string;
}

export interface PowerAnalysisAssessment {
  version: string;
  view: "front" | "side" | "oblique" | "unknown";
  viewLabelZh: string;
  recommendedViewZh: string;
  counts: Record<PowerAnalysisCheckStatus, number>;
  checks: PowerAnalysisCheck[];
}

export interface PowerAnalysisMeasurement {
  target: "body_anchor" | "barbell_plate" | "barbell_body_proxy";
  anchorLabelZh: string;
  scaleSource: "plate_diameter" | "body_height" | "torso_segment" | "limb_segments" | "frame_fallback";
  confidence: "high" | "medium" | "low";
  plateDiameterCm?: number;
  trackingCoverage?: number;
  warningsZh: string[];
}

export interface PowerAnalysisExcludedRep {
  startTimeS: number | null;
  endTimeS: number | null;
  displacementM: number | null;
  maxVelocityMps: number | null;
  reason: "displacement_beyond_body" | "velocity_beyond_body" | "partial_rep";
  reasonZh: string;
}

/** What the generic analyzer followed for a custom movement. */
export interface PowerAnalysisCustomInfo {
  actionNameZh: string;
  primaryPart: string;
  primaryPartZh: string;
  axis: "vertical" | "horizontal" | "diagonal";
  phaseLabelsZh: [string, string];
  mainJoint: string | null;
  mainJointZh: string | null;
}

export interface PowerAnalysisMetrics {
  analyzerVersion?: string;
  mode: PowerAnalysisMode;
  mass?: {
    bodyWeightKg: number;
    externalLoadKg: number;
    bodyMassFactor?: number;
    effectiveMassKg: number;
  };
  repCount: number;
  summary: {
    avgPowerW: number;
    bestPowerW: number;
    bestHorsepowerHp: number;
    bestVelocityMps: number;
    avgAscentTimeS: number;
    avgDisplacementM: number;
    bestMeanVelocityMps?: number;
    avgMeanVelocityMps?: number;
    lastMeanVelocityMps?: number;
    /** (fastest rep - last rep) / fastest rep, in percent. */
    velocityLossPct?: number | null;
  };
  reps: PowerAnalysisRepMetric[];
  /** Reps left out of the result: tracking jumps beyond human range, or partial reps. */
  excludedReps?: PowerAnalysisExcludedRep[];
  timeSeries?: PowerAnalysisTimeSeriesPoint[];
  rating?: PowerAnalysisRating;
  assessment?: PowerAnalysisAssessment;
  measurement?: PowerAnalysisMeasurement;
  custom?: PowerAnalysisCustomInfo;
  video?: {
    inputSizeBytes?: number;
    outputSizeBytes?: number;
    inputHasAudio?: boolean;
    outputHasAudio?: boolean;
    audioPreserved?: boolean;
    quality?: PowerAnalysisQuality;
  };
  notes?: string[];
}

export interface PowerAnalysisJobDto {
  id: string;
  mode: PowerAnalysisMode;
  heightCm: number;
  weightKg: number;
  /** Extra load for bodyweight movements; total bar mass for barbell lifts. */
  externalLoadKg: number;
  plateDiameterCm?: number;
  /** Movement name the user typed for the custom mode. */
  customActionName?: string;
  /** Who is in the video; "other" never enters the uploader's challenge boards. */
  subject: "self" | "other";
  status: PowerAnalysisJobStatus;
  progress: number;
  metrics: PowerAnalysisMetrics | null;
  llmSummary: string | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  canDownload: boolean;
  quality?: PowerAnalysisQuality;
  overlayLanguage?: PowerAnalysisOverlayLanguage;
  queueInfo?: PowerAnalysisQueueInfoDto | null;
  ranking?: PowerAnalysisRankingDto | null;
}

export interface PowerAnalysisRankingMetricDto {
  rank: number;
  participantTotal: number;
  percentile: number;
  bestValue: number;
  isPersonalBest: boolean;
}

export interface PowerAnalysisRankingDto {
  scope: "coachlink_nationwide_participants";
  scopeLabel: string;
  power: PowerAnalysisRankingMetricDto;
  speed: PowerAnalysisRankingMetricDto;
}

export interface PowerAnalysisQueueInfoDto {
  jobsAhead: number;
  queuedAhead: number;
  processingAhead: number;
  totalQueued: number;
}

export interface CreatePowerAnalysisUploadUrlDto {
  mode: PowerAnalysisMode;
  heightCm: number;
  weightKg: number;
  externalLoadKg?: number;
  plateDiameterCm?: number;
  /** Required for the custom mode. */
  customActionName?: string;
  /** Defaults to "self". */
  subject?: "self" | "other";
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  quality?: PowerAnalysisQuality;
  overlayLanguage?: PowerAnalysisOverlayLanguage;
}

export interface PowerAnalysisEntitlementsDto {
  tier: "free" | "basic" | "premium" | "trial";
  canUseOriginalQuality: boolean;
  availableQualities: PowerAnalysisQuality[];
  maxVideoSizeMb: number;
  maxDurationSeconds: number;
  dailyLimit: number;
}

export interface CreatePowerAnalysisUploadUrlResponseDto {
  job: PowerAnalysisJobDto;
  upload: {
    bucket: "videos";
    path: string;
    uploadUrl: string;
    token: string;
    expiresAt: string;
  };
  limits: {
    maxVideoSizeMb: number;
    dailyLimit: number;
    dailyLimitBypassed?: boolean;
    maxDurationSeconds?: number;
    canUseOriginalQuality?: boolean;
    tier?: "free" | "basic" | "premium" | "trial";
  };
}

export interface PowerAnalysisDownloadUrlResponseDto {
  url: string;
  proxyUrl?: string;
  signedUrl?: string;
  expiresInSeconds: number;
  filename: string;
}
