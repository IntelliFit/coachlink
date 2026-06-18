export type PowerAnalysisMode = "pullup" | "muscleup";
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

export interface PowerAnalysisMetrics {
  mode: PowerAnalysisMode;
  mass?: {
    bodyWeightKg: number;
    externalLoadKg: number;
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
}

export interface CreatePowerAnalysisUploadUrlDto {
  mode: PowerAnalysisMode;
  heightCm: number;
  weightKg: number;
  externalLoadKg?: number;
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
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
  };
}

export interface PowerAnalysisDownloadUrlResponseDto {
  url: string;
  proxyUrl?: string;
  signedUrl?: string;
  expiresInSeconds: number;
  filename: string;
}
