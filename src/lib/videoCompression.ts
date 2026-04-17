export const MAX_VIDEO_UPLOAD_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_UPLOAD_MB = Math.round(MAX_VIDEO_UPLOAD_BYTES / 1024 / 1024);
export const AUTO_COMPRESS_THRESHOLD_BYTES = 18 * 1024 * 1024;
export const DEFAULT_COMPRESSED_TARGET_BYTES = 40 * 1024 * 1024;
export const MAX_VIDEO_DIMENSION = 1280;
export const DEFAULT_VIDEO_FRAME_RATE = 30;

const MIN_VIDEO_BITRATE = 450_000;
const MAX_VIDEO_BITRATE = 4_500_000;
const DEFAULT_AUDIO_BITRATE = 96_000;
const MIN_SAVINGS_BYTES = 2 * 1024 * 1024;
const MIN_SAVINGS_RATIO = 0.08;

export type VideoUploadPhase = "preparing" | "compressing" | "uploading";

export interface VideoCompressionMetadata {
    durationSeconds: number;
    width: number;
    height: number;
}

export interface VideoCompressionPlan {
    shouldCompress: boolean;
    targetWidth: number;
    targetHeight: number;
    targetMaxBytes: number;
    videoBitsPerSecond: number;
    audioBitsPerSecond: number;
    frameRate: number;
    mimeType: string;
}

export interface VideoPreparationProgress {
    phase: Exclude<VideoUploadPhase, "uploading">;
    percentage: number;
    statusText: string;
}

export interface PreparedVideoFile {
    file: File;
    compressed: boolean;
    originalFileName: string;
    originalFileSizeBytes: number;
    originalMimeType: string;
    finalFileSizeBytes: number;
    finalMimeType: string;
    durationSeconds?: number;
    width?: number;
    height?: number;
}

export interface PrepareVideoForUploadOptions {
    onProgress?: (progress: VideoPreparationProgress) => void;
    targetMaxBytes?: number;
    autoCompressThresholdBytes?: number;
    maxDimension?: number;
}

function clamp(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

function toEven(value: number) {
    const rounded = Math.max(2, Math.round(value));
    return rounded % 2 === 0 ? rounded : rounded - 1;
}

function stripExtension(filename: string) {
    const lastDot = filename.lastIndexOf(".");
    return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

function guessExtensionFromMime(mimeType: string) {
    if (mimeType.includes("webm")) return "webm";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("ogg")) return "ogv";
    return "mp4";
}

function getSupportedRecorderMimeType() {
    if (typeof MediaRecorder === "undefined") return null;

    const candidates = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm;codecs=h264,opus",
        "video/webm",
    ];

    for (const candidate of candidates) {
        if (MediaRecorder.isTypeSupported(candidate)) {
            return candidate;
        }
    }

    return "";
}

export function getVideoUploadSizeError(file: File, maxBytes = MAX_VIDEO_UPLOAD_BYTES) {
    if (file.size > maxBytes) {
        return `文件过大。当前最多支持 ${Math.round(maxBytes / 1024 / 1024)}MB 的原视频`;
    }

    return null;
}

export function isBrowserVideoCompressionSupported() {
    if (typeof window === "undefined") return false;
    if (typeof document === "undefined") return false;
    if (typeof HTMLVideoElement === "undefined") return false;
    if (typeof HTMLCanvasElement === "undefined") return false;
    if (typeof MediaRecorder === "undefined") return false;

    const hasCanvasCapture = typeof HTMLCanvasElement.prototype.captureStream === "function";
    const hasVideoCapture =
        typeof (HTMLVideoElement.prototype as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream === "function" ||
        typeof (HTMLVideoElement.prototype as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream === "function";

    return hasCanvasCapture && hasVideoCapture && getSupportedRecorderMimeType() !== null;
}

export function buildVideoCompressionPlan(
    fileSizeBytes: number,
    metadata: VideoCompressionMetadata,
    options?: Pick<PrepareVideoForUploadOptions, "targetMaxBytes" | "autoCompressThresholdBytes" | "maxDimension">,
): VideoCompressionPlan {
    const targetMaxBytes = options?.targetMaxBytes ?? DEFAULT_COMPRESSED_TARGET_BYTES;
    const autoCompressThresholdBytes = options?.autoCompressThresholdBytes ?? AUTO_COMPRESS_THRESHOLD_BYTES;
    const maxDimension = options?.maxDimension ?? MAX_VIDEO_DIMENSION;

    const longestEdge = Math.max(metadata.width, metadata.height, 1);
    const scale = longestEdge > maxDimension ? maxDimension / longestEdge : 1;
    const targetWidth = toEven(metadata.width * scale);
    const targetHeight = toEven(metadata.height * scale);
    const needsResize = scale < 0.99;
    const sizeDrivenCompression = fileSizeBytes > autoCompressThresholdBytes;
    const shouldCompress = needsResize || sizeDrivenCompression;

    const effectiveTargetBytes = Math.min(
        targetMaxBytes,
        sizeDrivenCompression ? Math.floor(fileSizeBytes * 0.78) : Math.floor(fileSizeBytes * 0.9),
    );

    const durationSeconds = Math.max(metadata.durationSeconds || 0, 1);
    const totalBitsPerSecond = clamp(
        Math.floor((Math.max(effectiveTargetBytes, 4 * 1024 * 1024) * 8 * 0.92) / durationSeconds),
        MIN_VIDEO_BITRATE + DEFAULT_AUDIO_BITRATE,
        MAX_VIDEO_BITRATE + DEFAULT_AUDIO_BITRATE,
    );
    const audioBitsPerSecond = DEFAULT_AUDIO_BITRATE;
    const videoBitsPerSecond = clamp(
        totalBitsPerSecond - audioBitsPerSecond,
        MIN_VIDEO_BITRATE,
        MAX_VIDEO_BITRATE,
    );

    return {
        shouldCompress,
        targetWidth,
        targetHeight,
        targetMaxBytes: effectiveTargetBytes,
        videoBitsPerSecond,
        audioBitsPerSecond,
        frameRate: DEFAULT_VIDEO_FRAME_RATE,
        mimeType: getSupportedRecorderMimeType() || "video/webm",
    };
}

async function loadVideoMetadata(file: File): Promise<VideoCompressionMetadata> {
    const objectUrl = URL.createObjectURL(file);

    try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.src = objectUrl;
        video.playsInline = true;
        video.muted = true;

        await new Promise<void>((resolve, reject) => {
            const onLoaded = () => {
                cleanup();
                resolve();
            };

            const onError = () => {
                cleanup();
                reject(new Error("无法读取视频信息"));
            };

            const cleanup = () => {
                video.removeEventListener("loadedmetadata", onLoaded);
                video.removeEventListener("error", onError);
            };

            video.addEventListener("loadedmetadata", onLoaded, { once: true });
            video.addEventListener("error", onError, { once: true });
        });

        return {
            durationSeconds: Number.isFinite(video.duration) ? video.duration : 0,
            width: video.videoWidth || 0,
            height: video.videoHeight || 0,
        };
    } finally {
        URL.revokeObjectURL(objectUrl);
    }
}

async function compressVideoWithMediaRecorder(
    file: File,
    metadata: VideoCompressionMetadata,
    plan: VideoCompressionPlan,
    onProgress?: (progress: VideoPreparationProgress) => void,
) {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    if (!context) {
        URL.revokeObjectURL(objectUrl);
        throw new Error("浏览器不支持视频画布压缩");
    }

    canvas.width = plan.targetWidth;
    canvas.height = plan.targetHeight;

    video.preload = "auto";
    video.src = objectUrl;
    video.playsInline = true;
    video.muted = true;

    let animationFrame = 0;

    const cleanup = () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = 0;
        }
        URL.revokeObjectURL(objectUrl);
        video.pause();
        video.removeAttribute("src");
        try {
            video.load();
        } catch {
            // no-op
        }
    };

    try {
        await new Promise<void>((resolve, reject) => {
            const onCanPlay = () => {
                cleanupListeners();
                resolve();
            };
            const onError = () => {
                cleanupListeners();
                reject(new Error("浏览器无法解码这个视频文件"));
            };
            const cleanupListeners = () => {
                video.removeEventListener("canplay", onCanPlay);
                video.removeEventListener("error", onError);
            };

            video.addEventListener("canplay", onCanPlay, { once: true });
            video.addEventListener("error", onError, { once: true });
        });

        const videoCapture =
            (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.() ||
            (video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }).mozCaptureStream?.();

        const canvasStream = canvas.captureStream(plan.frameRate);
        const mixedTracks = [...canvasStream.getVideoTracks()];

        if (videoCapture) {
            mixedTracks.push(...videoCapture.getAudioTracks());
        }

        const mixedStream = new MediaStream(mixedTracks);
        const recorderOptions: MediaRecorderOptions = {
            mimeType: plan.mimeType,
            videoBitsPerSecond: plan.videoBitsPerSecond,
        };

        if (mixedTracks.some((track) => track.kind === "audio")) {
            recorderOptions.audioBitsPerSecond = plan.audioBitsPerSecond;
        }

        const recorder = new MediaRecorder(mixedStream, recorderOptions);
        const chunks: BlobPart[] = [];

        const compressionPromise = new Promise<Blob>((resolve, reject) => {
            recorder.addEventListener("dataavailable", (event) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            });

            recorder.addEventListener("stop", () => {
                resolve(new Blob(chunks, { type: recorder.mimeType || plan.mimeType }));
            });

            recorder.addEventListener("error", () => {
                reject(new Error("视频压缩过程中断，请重试"));
            });
        });

        const drawFrame = () => {
            if (video.paused || video.ended) {
                return;
            }

            context.drawImage(video, 0, 0, plan.targetWidth, plan.targetHeight);
            const ratio = metadata.durationSeconds > 0
                ? clamp(video.currentTime / metadata.durationSeconds, 0, 0.98)
                : 0;
            onProgress?.({
                phase: "compressing",
                percentage: Math.round(ratio * 100),
                statusText: "正在压缩视频…",
            });
            animationFrame = requestAnimationFrame(drawFrame);
        };

        recorder.start(1000);
        context.drawImage(video, 0, 0, plan.targetWidth, plan.targetHeight);
        await video.play();
        drawFrame();

        await new Promise<void>((resolve, reject) => {
            const onEnded = () => {
                video.removeEventListener("ended", onEnded);
                video.removeEventListener("error", onError);
                if (animationFrame) {
                    cancelAnimationFrame(animationFrame);
                    animationFrame = 0;
                }
                context.drawImage(video, 0, 0, plan.targetWidth, plan.targetHeight);
                if (recorder.state !== "inactive") {
                    recorder.stop();
                }
                resolve();
            };

            const onError = () => {
                video.removeEventListener("ended", onEnded);
                video.removeEventListener("error", onError);
                reject(new Error("视频播放中断，无法完成压缩"));
            };

            video.addEventListener("ended", onEnded, { once: true });
            video.addEventListener("error", onError, { once: true });
        });

        return await compressionPromise;
    } finally {
        cleanup();
    }
}

export async function prepareVideoForUpload(
    file: File,
    options?: PrepareVideoForUploadOptions,
): Promise<PreparedVideoFile> {
    const tooLargeError = getVideoUploadSizeError(file);
    if (tooLargeError) {
        throw new Error(tooLargeError);
    }

    if (!file.type?.startsWith("video/")) {
        return {
            file,
            compressed: false,
            originalFileName: file.name,
            originalFileSizeBytes: file.size,
            originalMimeType: file.type || "application/octet-stream",
            finalFileSizeBytes: file.size,
            finalMimeType: file.type || "application/octet-stream",
        };
    }

    options?.onProgress?.({
        phase: "preparing",
        percentage: 0,
        statusText: "正在读取视频信息…",
    });

    const metadata = await loadVideoMetadata(file);
    const plan = buildVideoCompressionPlan(file.size, metadata, options);

    if (!plan.shouldCompress || !isBrowserVideoCompressionSupported()) {
        options?.onProgress?.({
            phase: "preparing",
            percentage: 100,
            statusText: "无需压缩，准备上传…",
        });
        return {
            file,
            compressed: false,
            originalFileName: file.name,
            originalFileSizeBytes: file.size,
            originalMimeType: file.type || "application/octet-stream",
            finalFileSizeBytes: file.size,
            finalMimeType: file.type || "application/octet-stream",
            durationSeconds: metadata.durationSeconds,
            width: metadata.width,
            height: metadata.height,
        };
    }

    options?.onProgress?.({
        phase: "preparing",
        percentage: 100,
        statusText: "已读取视频，开始压缩…",
    });

    const compressedBlob = await compressVideoWithMediaRecorder(
        file,
        metadata,
        plan,
        options?.onProgress,
    );

    const savingsBytes = file.size - compressedBlob.size;
    const savingsRatio = savingsBytes / Math.max(file.size, 1);

    if (
        compressedBlob.size === 0 ||
        compressedBlob.size >= file.size ||
        (savingsBytes < MIN_SAVINGS_BYTES && savingsRatio < MIN_SAVINGS_RATIO)
    ) {
        return {
            file,
            compressed: false,
            originalFileName: file.name,
            originalFileSizeBytes: file.size,
            originalMimeType: file.type || "application/octet-stream",
            finalFileSizeBytes: file.size,
            finalMimeType: file.type || "application/octet-stream",
            durationSeconds: metadata.durationSeconds,
            width: metadata.width,
            height: metadata.height,
        };
    }

    const outputMimeType = compressedBlob.type || plan.mimeType;
    const compressedFile = new File(
        [compressedBlob],
        `${stripExtension(file.name)}-compressed.${guessExtensionFromMime(outputMimeType)}`,
        {
            type: outputMimeType,
            lastModified: Date.now(),
        },
    );

    return {
        file: compressedFile,
        compressed: true,
        originalFileName: file.name,
        originalFileSizeBytes: file.size,
        originalMimeType: file.type || "application/octet-stream",
        finalFileSizeBytes: compressedFile.size,
        finalMimeType: compressedFile.type || "application/octet-stream",
        durationSeconds: metadata.durationSeconds,
        width: plan.targetWidth,
        height: plan.targetHeight,
    };
}
