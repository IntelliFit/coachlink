export type PowerAnalysisMode = "pullup" | "muscleup" | "dip" | "pushup" | "squat";
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

export interface PowerAnalysisMetrics {
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
  };
  reps: PowerAnalysisRepMetric[];
  timeSeries?: PowerAnalysisTimeSeriesPoint[];
  rating?: PowerAnalysisRating;
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
  externalLoadKg: number;
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
