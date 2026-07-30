export type MotionEffectJobStatus =
  | "awaiting_upload"
  | "awaiting_payment"
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
  exportQuality: "standard" | "hd";
  queueTier: "standard" | "priority";
  styleKey: string;
  bgmKey: string;
  paymentStatus: "unpaid" | "pending" | "paid" | "free" | "refunded";
  priceCents: number;
  entitlementSource: "signup_free" | "paid_export" | null;
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
  exportQuality?: "standard" | "hd";
  queueTier?: "standard" | "priority";
  styleKey?: string;
  bgmKey?: string;
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
  ownerToken?: string;
  signedIn: boolean;
  signupFreeAvailable: boolean;
  prices: {
    standardCents: number;
    hdCents: number;
    priorityAddonCents: number;
  };
}

export interface MotionEffectCheckoutDto {
  job: MotionEffectJobDto;
  order: {
    id: string;
    totalAmountCents: number;
    totalAmountYuan: number;
    status: string;
  };
  paymentInfo: {
    formHtml?: string;
    paymentUrl?: string;
    description: string;
  };
}

export interface MotionEffectDownloadUrlDto {
  url: string;
  proxyUrl?: string;
  signedUrl?: string;
  expiresInSeconds: number;
  filename: string;
}
