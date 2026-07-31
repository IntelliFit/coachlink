export type MotionEffectJobStatus =
  | "awaiting_upload"
  | "queued"
  | "processing"
  | "done"
  | "failed"
  | "expired";

export interface MotionEffectResult {
  analyzedFrames: number;
  handFrames: number;
  peakPairs: number;
  pairFrameCounts: number[];
  durationSeconds: number;
  audioPreserved: boolean;
}

export interface MotionEffectJobDto {
  id: string;
  status: MotionEffectJobStatus;
  progress: number;
  result: MotionEffectResult | null;
  errorMessage: string | null;
  expiresAt: string;
  createdAt: string;
  completedAt: string | null;
  canDownload: boolean;
  styleKey: string;
  motionSpeed: string;
  glowStrength: string;
  surfaceDensity: string;
  queueInfo?: {
    jobsAhead: number;
    queuedAhead: number;
    processingAhead: number;
    totalQueued: number;
  } | null;
}

export interface CreateMotionEffectUploadDto {
  originalFilename: string;
  contentType: string;
  fileSizeBytes: number;
  durationSeconds?: number;
  styleKey?: string;
  motionSpeed?: "gentle" | "balanced" | "energetic";
  glowStrength?: "soft" | "balanced" | "strong";
  surfaceDensity?: "transparent" | "balanced" | "rich";
}

export interface CreateMotionEffectUploadResponseDto {
  job: MotionEffectJobDto;
  upload: {
    bucket: "videos";
    path: string;
    uploadUrl: string;
    token: string;
    expiresAt: string;
  };
  limits: {
    maxVideoSizeMb: number;
    maxDurationSeconds: number;
    dailyLimit: number;
  };
}

export interface MotionEffectDownloadUrlDto {
  url: string;
  proxyUrl?: string;
  signedUrl?: string;
  expiresInSeconds: number;
  filename: string;
}
