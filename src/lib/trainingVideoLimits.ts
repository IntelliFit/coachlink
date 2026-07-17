const MEBIBYTE = 1024 * 1024;

/** Default aggregate storage available for training-video uploads. */
export const DEFAULT_TRAINING_VIDEO_STORAGE_MB = 200;

/** Aggregate storage available once a student has an active coach subscription. */
export const COACH_SUBSCRIPTION_TRAINING_VIDEO_STORAGE_MB = 1024;

/** Training videos are intentionally kept short and reviewable. */
export const MAX_TRAINING_VIDEO_UPLOAD_MB = 50;
export const MAX_TRAINING_VIDEO_UPLOAD_BYTES =
    MAX_TRAINING_VIDEO_UPLOAD_MB * MEBIBYTE;

export function getTrainingVideoSizeError(fileSizeBytes: number) {
    if (fileSizeBytes > MAX_TRAINING_VIDEO_UPLOAD_BYTES) {
        return `视频过大，单个训练视频请小于 ${MAX_TRAINING_VIDEO_UPLOAD_MB}MB`;
    }

    return null;
}
