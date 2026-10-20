import type { PowerAnalysisMode } from "@coachlink/core/src/powerAnalysisModes";

export type { PowerAnalysisMode };
export type PowerAnalysisQuality = "compressed" | "original";
export type PowerAnalysisOverlayLanguage = "zh" | "en";
export type PowerAnalysisJobStatus =
  | "awaiting_upload"
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "expired";

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
  scaleSource: "plate_diameter" | "body_height" | "torso_segment" | "frame_fallback";
  confidence: "high" | "medium" | "low";
  plateDiameterCm?: number;
  trackingCoverage?: number;
  warningsZh: string[];
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
  timeSeries?: PowerAnalysisTimeSeriesPoint[];
  rating?: PowerAnalysisRating;
  assessment?: PowerAnalysisAssessment;
  measurement?: PowerAnalysisMeasurement;
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
