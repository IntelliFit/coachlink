"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  ArrowLeft,
  Download,
  Hand,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import presets from "../../../../config/motion-effects-presets.json";
import type {
  CreateMotionEffectUploadResponseDto,
  MotionEffectCheckoutDto,
  MotionEffectJobDto,
} from "@/app/api/toolbox/motion-effects/types";
import {
  buildSideTriangles,
  lerpPoint,
  smoothstep,
  type MotionEffectPoint as Point,
} from "@/lib/motionEffectsGeometry";

type AnalyzerStatus =
  | "idle"
  | "loading-model"
  | "ready"
  | "analyzing"
  | "paused"
  | "complete"
  | "error";

type FingerState = {
  active: boolean;
  highFrames: number;
  lowFrames: number;
  weight: number;
};

type AnalyzerStats = {
  analyzedFrames: number;
  handFrames: number;
  currentHands: number;
  currentPairs: number;
  peakPairs: number;
  pairFrames: [number, number, number, number, number, number];
};

type CaptureVideoElement = HTMLVideoElement & {
  captureStream?: () => MediaStream;
  mozCaptureStream?: () => MediaStream;
};

const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.0/wasm";
const HAND_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

const FINGERS = [
  { name: "拇指", chain: [1, 2, 3, 4] },
  { name: "食指", chain: [5, 6, 7, 8] },
  { name: "中指", chain: [9, 10, 11, 12] },
  { name: "无名指", chain: [13, 14, 15, 16] },
  { name: "小指", chain: [17, 18, 19, 20] },
] as const;

const EMPTY_STATS: AnalyzerStats = {
  analyzedFrames: 0,
  handFrames: 0,
  currentHands: 0,
  currentPairs: 0,
  peakPairs: 0,
  pairFrames: [0, 0, 0, 0, 0, 0],
};

const EMPTY_FINGER_STATE = (): FingerState => ({
  active: false,
  highFrames: 0,
  lowFrames: 0,
  weight: 0,
});

const BASE_HUES = [174, 214, 267, 329, 39] as const;
type MotionStyle = (typeof presets.styles)[number];
const MOTION_STYLES = presets.styles as MotionStyle[];
const PALM_CENTER_INDICES = [0, 5, 9, 13, 17] as const;
const REVEAL_DISTANCE_START = 0.14;
const REVEAL_DISTANCE_END = 0.3;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds)) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function toPoint(landmark: NormalizedLandmark, width: number, height: number): Point {
  return {
    x: landmark.x * width,
    y: landmark.y * height,
    z: landmark.z || 0,
  };
}

function distance3d(a: NormalizedLandmark, b: NormalizedLandmark) {
  return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0));
}

function jointAngle(
  first: NormalizedLandmark,
  middle: NormalizedLandmark,
  last: NormalizedLandmark,
) {
  const ax = first.x - middle.x;
  const ay = first.y - middle.y;
  const az = (first.z || 0) - (middle.z || 0);
  const bx = last.x - middle.x;
  const by = last.y - middle.y;
  const bz = (last.z || 0) - (middle.z || 0);
  const denominator = Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz);
  if (denominator < 0.000001) return 0;
  return Math.acos(clamp((ax * bx + ay * by + az * bz) / denominator, -1, 1));
}

function smoothLandmarks(
  previous: NormalizedLandmark[] | undefined,
  current: NormalizedLandmark[],
  alpha = 0.58,
) {
  if (!previous || previous.length !== current.length) {
    return current.map((item) => ({ ...item }));
  }
  return current.map((item, index) => ({
    ...item,
    x: previous[index].x * (1 - alpha) + item.x * alpha,
    y: previous[index].y * (1 - alpha) + item.y * alpha,
    z: previous[index].z * (1 - alpha) + item.z * alpha,
  }));
}

function fingerExtensionScore(landmarks: NormalizedLandmark[], fingerIndex: number) {
  const chain = FINGERS[fingerIndex].chain;
  const [mcpIndex, pipIndex, dipIndex, tipIndex] = chain;
  const mcp = landmarks[mcpIndex];
  const pip = landmarks[pipIndex];
  const dip = landmarks[dipIndex];
  const tip = landmarks[tipIndex];
  const wrist = landmarks[0];

  const pathLength =
    distance3d(mcp, pip) + distance3d(pip, dip) + distance3d(dip, tip);
  const straightness = pathLength
    ? clamp((distance3d(mcp, tip) / pathLength - 0.58) / 0.4, 0, 1)
    : 0;
  const firstAngle = clamp((jointAngle(mcp, pip, dip) - 1.72) / 1.18, 0, 1);
  const secondAngle = clamp((jointAngle(pip, dip, tip) - 1.72) / 1.18, 0, 1);

  if (fingerIndex === 0) {
    const palmWidth = Math.max(distance3d(landmarks[5], landmarks[17]), 0.0001);
    const thumbSpread = clamp(
      (distance3d(tip, landmarks[5]) / palmWidth - 0.52) / 0.78,
      0,
      1,
    );
    return straightness * 0.34 + firstAngle * 0.2 + secondAngle * 0.18 + thumbSpread * 0.28;
  }

  const baseDistance = Math.max(distance3d(wrist, mcp), 0.0001);
  const reach = clamp((distance3d(wrist, tip) / baseDistance - 1.42) / 1.15, 0, 1);
  return straightness * 0.34 + firstAngle * 0.23 + secondAngle * 0.23 + reach * 0.2;
}

function updateFingerState(state: FingerState, score: number) {
  if (score >= 0.63) {
    state.highFrames += 1;
    state.lowFrames = 0;
  } else if (score <= 0.46) {
    state.lowFrames += 1;
    state.highFrames = 0;
  } else {
    state.highFrames = Math.max(0, state.highFrames - 1);
    state.lowFrames = Math.max(0, state.lowFrames - 1);
  }

  if (!state.active && state.highFrames >= 2) state.active = true;
  if (state.active && state.lowFrames >= 3) state.active = false;
  state.weight = clamp(state.weight + (state.active ? 0.34 : -0.22), 0, 1);
  return state;
}

function handSeparationAlpha(
  hands: NormalizedLandmark[][],
  width: number,
  height: number,
) {
  const centers = hands.slice(0, 2).map((hand) => {
    const points = PALM_CENTER_INDICES.map((index) => toPoint(hand[index], width, height));
    return points.reduce(
      (center, point) => ({
        x: center.x + point.x / points.length,
        y: center.y + point.y / points.length,
        z: center.z + point.z / points.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
  });
  const normalizedDistance =
    Math.hypot(centers[0].x - centers[1].x, centers[0].y - centers[1].y) /
    Math.hypot(width, height);
  return smoothstep(REVEAL_DISTANCE_START, REVEAL_DISTANCE_END, normalizedDistance);
}

function drawTexturedTriangle(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  target: Point[],
  hue: number,
  alpha: number,
  timeSeconds: number,
  phase: number,
  style: MotionStyle,
) {
  context.save();
  context.beginPath();
  context.moveTo(target[0].x, target[0].y);
  context.lineTo(target[1].x, target[1].y);
  context.lineTo(target[2].x, target[2].y);
  context.closePath();
  context.clip();
  context.globalAlpha = style.textureAlpha * alpha;
  context.filter = `brightness(0.58) saturate(${1 + style.saturation / 170}) contrast(1.08)`;
  context.translate(video.videoWidth, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  context.restore();

  context.save();
  context.beginPath();
  context.moveTo(target[0].x, target[0].y);
  context.lineTo(target[1].x, target[1].y);
  context.lineTo(target[2].x, target[2].y);
  context.closePath();
  context.fillStyle = `hsl(${hue}, 94%, 58%)`;
  context.globalAlpha = style.faceAlpha * alpha;
  context.globalCompositeOperation = "screen";
  context.fill();
  context.restore();

  const sweep = (timeSeconds * style.sweepSpeed + phase) % 1;
  const sweepStart = lerpPoint(target[0], target[2], sweep);
  const sweepEnd = lerpPoint(target[1], target[2], sweep);
  context.save();
  context.beginPath();
  context.moveTo(target[0].x, target[0].y);
  context.lineTo(target[1].x, target[1].y);
  context.lineTo(target[2].x, target[2].y);
  context.closePath();
  context.clip();
  context.beginPath();
  context.moveTo(sweepStart.x, sweepStart.y);
  context.lineTo(sweepEnd.x, sweepEnd.y);
  context.strokeStyle = `hsla(${(hue + 48) % 360}, 100%, 78%, ${0.52 * alpha})`;
  context.lineWidth = Math.max(1.5, video.videoWidth / 420);
  context.shadowColor = `hsla(${hue}, 100%, 65%, ${0.8 * alpha})`;
  context.shadowBlur = 14;
  context.stroke();
  context.restore();
}

function drawEdge(
  context: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  width: number,
  alpha: number,
  hue: number,
  timeSeconds: number,
  phase: number,
  style: MotionStyle,
) {
  const lineWidth = Math.max(1.2, width / 680);
  context.save();
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.lineCap = "round";
  context.strokeStyle = `hsla(${hue}, 100%, 88%, ${0.42 + alpha * 0.5})`;
  context.lineWidth = lineWidth;
  context.shadowColor = `hsla(${hue}, 100%, 63%, ${0.78 * alpha})`;
  context.shadowBlur = 9 * style.edgeGlow;
  context.stroke();

  const dash = Math.max(6, width / 92);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.setLineDash([dash, dash * 1.35]);
  context.lineDashOffset = -(timeSeconds * width * 0.12 + phase * dash * 3);
  context.strokeStyle = `hsla(${(hue + 54) % 360}, 100%, 72%, ${0.62 * alpha})`;
  context.lineWidth = lineWidth * 1.7;
  context.shadowBlur = 12 * style.edgeGlow;
  context.stroke();
  context.restore();
}

function drawNode(
  context: CanvasRenderingContext2D,
  point: Point,
  width: number,
  hue: number,
  alpha: number,
) {
  const radius = Math.max(3.4, width / 210);
  context.save();
  context.globalAlpha = alpha;
  context.beginPath();
  context.arc(point.x, point.y, radius * 2.2, 0, Math.PI * 2);
  context.fillStyle = `hsla(${hue}, 95%, 64%, 0.2)`;
  context.shadowColor = `hsla(${hue}, 95%, 68%, 0.9)`;
  context.shadowBlur = 14;
  context.fill();
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = "#F2FFFD";
  context.fill();
  context.restore();
}

function drawAdaptiveMesh(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  hands: NormalizedLandmark[][],
  states: FingerState[][],
  width: number,
  height: number,
  timeSeconds: number,
  style: MotionStyle,
) {
  if (hands.length < 2) return 0;

  const pairs = FINGERS.map((finger, fingerIndex) => {
    const weight = Math.min(states[0][fingerIndex].weight, states[1][fingerIndex].weight);
    return {
      fingerIndex,
      weight,
      left: toPoint(hands[0][finger.chain[3]], width, height),
      right: toPoint(hands[1][finger.chain[3]], width, height),
    };
  }).filter((pair) => pair.weight > 0.08);

  const stablePairCount = pairs.filter((pair) => pair.weight >= 0.5).length;
  if (!pairs.length) return stablePairCount;

  const revealAlpha = handSeparationAlpha(hands, width, height);
  if (revealAlpha <= 0.01) return 0;
  const overallAlpha =
    (pairs.reduce((sum, pair) => sum + pair.weight, 0) / Math.max(1, pairs.length)) *
    revealAlpha;
  const left = pairs.map((pair) => pair.left);
  const right = pairs.map((pair) => pair.right);
  const triangles: { points: Point[]; hue: number; depth: number; phase: number }[] = [];
  const edges: { start: Point; end: Point; hue: number; phase: number }[] = [];
  const hueFor = (fingerIndex: number, offset = 0) =>
    ((style.hues[fingerIndex] ?? BASE_HUES[fingerIndex]) +
      timeSeconds * style.hueSpeed +
      offset) %
    360;
  const addTriangle = (
    points: Point[],
    fingerIndex: number,
    offset: number,
    phase: number,
  ) => {
    triangles.push({
      points,
      hue: hueFor(fingerIndex, offset),
      depth: points.reduce((sum, point) => sum + point.z, 0) / points.length,
      phase,
    });
  };

  if (pairs.length === 1) {
    edges.push({
      start: left[0],
      end: right[0],
      hue: hueFor(pairs[0].fingerIndex),
      phase: pairs[0].fingerIndex,
    });
  } else {
    const sideCount = pairs.length === 2 ? 1 : pairs.length;
    for (let index = 0; index < sideCount; index += 1) {
      const next = (index + 1) % pairs.length;
      buildSideTriangles(left[index], right[index], left[next], right[next]).forEach(
        (points, triangleIndex) =>
          addTriangle(
            points,
            pairs[index].fingerIndex,
            triangleIndex * 38 + index * 17,
            index * 0.19 + triangleIndex * 0.31,
          ),
      );
      edges.push(
        {
          start: left[index],
          end: left[next],
          hue: hueFor(pairs[index].fingerIndex, 24),
          phase: index + 0.25,
        },
        {
          start: right[index],
          end: right[next],
          hue: hueFor(pairs[next].fingerIndex, 24),
          phase: index + 0.65,
        },
      );
    }

    pairs.forEach((pair, index) => {
      edges.push({
        start: left[index],
        end: right[index],
        hue: hueFor(pair.fingerIndex),
        phase: index,
      });
    });

    if (pairs.length >= 3) {
      for (let index = 1; index < pairs.length - 1; index += 1) {
        addTriangle(
          [left[0], left[index], left[index + 1]],
          pairs[index].fingerIndex,
          52,
          index * 0.23,
        );
        addTriangle(
          [right[0], right[index + 1], right[index]],
          pairs[index].fingerIndex,
          118,
          index * 0.23 + 0.41,
        );
      }
    }
  }

  triangles
    .sort((a, b) => b.depth - a.depth)
    .forEach((triangle) =>
      drawTexturedTriangle(
        context,
        video,
        triangle.points,
        triangle.hue,
        overallAlpha,
        timeSeconds,
        triangle.phase,
        style,
      ),
    );
  edges.forEach((edge) =>
    drawEdge(
      context,
      edge.start,
      edge.end,
      width,
      overallAlpha,
      edge.hue,
      timeSeconds,
      edge.phase,
      style,
    ),
  );
  pairs.forEach((pair) => {
    const hue = hueFor(pair.fingerIndex);
    const nodeAlpha = pair.weight * revealAlpha;
    drawNode(context, pair.left, width, hue, nodeAlpha);
    drawNode(context, pair.right, width, hue, nodeAlpha);
  });

  return stablePairCount;
}

async function createTracker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  const createWithDelegate = (delegate: "GPU" | "CPU") =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.42,
      minHandPresenceConfidence: 0.42,
      minTrackingConfidence: 0.42,
    });

  try {
    return await createWithDelegate("GPU");
  } catch {
    return createWithDelegate("CPU");
  }
}

function getRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return [
    "video/mp4;codecs=h264,aac",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function readApi<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `请求失败（${response.status}）`);
  }
  return payload.data as T;
}

function putFile(uploadUrl: string, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
      } else {
        reject(new Error(xhr.responseText || `上传失败（${xhr.status}）`));
      }
    };
    xhr.onerror = () => reject(new Error("上传中断，请检查网络"));
    xhr.send(file);
  });
}

function getOrCreateMotionClientId() {
  const key = "jiaolian_motion_effect_client_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(key, created);
  return created;
}

const PENDING_JOB_KEY = "jiaolian_motion_effect_pending_job";

export default function MotionEffectsPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<HandLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const isExportingRef = useRef(false);
  const lastProcessedVideoTimeRef = useRef(-1);
  const lastInferenceAtRef = useRef(0);
  const lastStatsCommitAtRef = useRef(0);
  const statsRef = useRef<AnalyzerStats>({ ...EMPTY_STATS });
  const smoothedHandsRef = useRef<NormalizedLandmark[][]>([]);
  const fingerStatesRef = useRef<FingerState[][]>([
    FINGERS.map(EMPTY_FINGER_STATE),
    FINGERS.map(EMPTY_FINGER_STATE),
  ]);
  const lastResultsRef = useRef<HandLandmarkerResult | null>(null);

  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState<AnalyzerStatus>("idle");
  const [statusDetail, setStatusDetail] = useState("选择一段双手动作视频开始体验。");
  const [stats, setStats] = useState<AnalyzerStats>({ ...EMPTY_STATS });
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoRatio, setVideoRatio] = useState(9 / 16);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [serverJob, setServerJob] = useState<MotionEffectJobDto | null>(null);
  const [serverExporting, setServerExporting] = useState(false);
  const [ownerToken, setOwnerToken] = useState("");
  const [selectedStyleKey, setSelectedStyleKey] = useState("aurora");
  const [exportQuality, setExportQuality] = useState<"standard" | "hd">("standard");
  const [queueTier, setQueueTier] = useState<"standard" | "priority">("standard");
  const [signupFreeAvailable, setSignupFreeAvailable] = useState<boolean | null>(null);
  const [checkout, setCheckout] = useState<MotionEffectCheckoutDto | null>(null);
  const [prices, setPrices] = useState({
    standardCents: 290,
    hdCents: 490,
    priorityAddonCents: 190,
  });
  const clientIdRef = useRef("");
  const selectedStyle =
    MOTION_STYLES.find((style) => style.key === selectedStyleKey) || MOTION_STYLES[0];

  useEffect(() => {
    if (sessionStatus === "loading") return;
    void fetch("/api/toolbox/motion-effects/quote", { cache: "no-store" })
      .then((response) => readApi<{
        signedIn: boolean;
        signupFreeAvailable: boolean;
        prices: typeof prices;
      }>(response))
      .then((data) => {
        setPrices(data.prices);
        setSignupFreeAvailable(data.signupFreeAvailable);
      })
      .catch(() => null);
  }, [sessionStatus]);

  const handCoverage = stats.analyzedFrames
    ? Math.round((stats.handFrames / stats.analyzedFrames) * 100)
    : 0;
  const canStart =
    Boolean(videoUrl) && !["loading-model", "analyzing"].includes(status) && !isExporting;
  const isPlaying = status === "analyzing";
  const currentFingerNames = useMemo(
    () =>
      stats.currentPairs
        ? `${stats.currentPairs} 对同名指尖`
        : stats.currentHands < 2
          ? "等待双手入镜"
          : "等待手指伸展",
    [stats.currentHands, stats.currentPairs],
  );
  const signedIn = sessionStatus === "authenticated";
  const freeStandardSelected =
    signedIn && signupFreeAvailable === true && exportQuality === "standard";
  const selectedPriceCents =
    (freeStandardSelected
      ? 0
      : exportQuality === "hd"
        ? prices.hdCents
        : prices.standardCents) +
    (queueTier === "priority" ? prices.priorityAddonCents : 0);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const closeTracker = useCallback(() => {
    trackerRef.current?.close();
    trackerRef.current = null;
  }, []);

  const resetAnalysis = useCallback(() => {
    stopAnimation();
    statsRef.current = {
      ...EMPTY_STATS,
      pairFrames: [...EMPTY_STATS.pairFrames] as AnalyzerStats["pairFrames"],
    };
    setStats(statsRef.current);
    smoothedHandsRef.current = [];
    fingerStatesRef.current = [
      FINGERS.map(EMPTY_FINGER_STATE),
      FINGERS.map(EMPTY_FINGER_STATE),
    ];
    lastProcessedVideoTimeRef.current = -1;
    lastInferenceAtRef.current = 0;
    lastResultsRef.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }, [stopAnimation]);

  useEffect(() => {
    return () => {
      stopAnimation();
      closeTracker();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, [closeTracker, stopAnimation]);

  const updateFingerStates = useCallback((hands: NormalizedLandmark[][]) => {
    for (let handIndex = 0; handIndex < 2; handIndex += 1) {
      for (let fingerIndex = 0; fingerIndex < FINGERS.length; fingerIndex += 1) {
        const state = fingerStatesRef.current[handIndex][fingerIndex];
        const score = hands[handIndex]
          ? fingerExtensionScore(hands[handIndex], fingerIndex)
          : 0;
        updateFingerState(state, score);
      }
    }
  }, []);

  const drawOverlay = useCallback(
    (handsResult: HandLandmarkerResult | null) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !video.videoWidth || !video.videoHeight) return 0;
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      const context = canvas.getContext("2d");
      if (!context) return 0;
      context.clearRect(0, 0, canvas.width, canvas.height);

      const orderedHands = [...(handsResult?.landmarks || [])].sort(
        (a, b) => a[0].x - b[0].x,
      );
      const hands = orderedHands.map((landmarks, index) =>
        smoothLandmarks(smoothedHandsRef.current[index], landmarks),
      );
      smoothedHandsRef.current = hands;
      updateFingerStates(hands);
      const pairCount = drawAdaptiveMesh(
        context,
        video,
        hands,
        fingerStatesRef.current,
        canvas.width,
        canvas.height,
        video.currentTime,
        selectedStyle,
      );

      if (isExportingRef.current && exportCanvasRef.current) {
        const exportCanvas = exportCanvasRef.current;
        const exportContext = exportCanvas.getContext("2d");
        if (exportContext) {
          exportContext.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
          exportContext.drawImage(video, 0, 0, exportCanvas.width, exportCanvas.height);
          exportContext.drawImage(canvas, 0, 0, exportCanvas.width, exportCanvas.height);
        }
      }
      return pairCount;
    },
    [selectedStyle, updateFingerStates],
  );

  const runFrameLoop = useCallback(() => {
    const frame = () => {
      const video = videoRef.current;
      const tracker = trackerRef.current;
      if (!video || !tracker || video.paused || video.ended) {
        animationFrameRef.current = null;
        return;
      }

      const now = performance.now();
      setCurrentTime(video.currentTime);
      if (duration > 0 && isExportingRef.current) {
        setExportProgress(clamp(video.currentTime / duration, 0, 1));
      }

      if (
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
        video.currentTime !== lastProcessedVideoTimeRef.current &&
        now - lastInferenceAtRef.current >= 42
      ) {
        lastProcessedVideoTimeRef.current = video.currentTime;
        lastInferenceAtRef.current = now;
        try {
          const hands = tracker.detectForVideo(video, now);
          lastResultsRef.current = hands;
          const pairCount = drawOverlay(hands);
          const nextStats = statsRef.current;
          nextStats.analyzedFrames += 1;
          if (hands.landmarks.length > 0) nextStats.handFrames += 1;
          nextStats.currentHands = hands.landmarks.length;
          nextStats.currentPairs = pairCount;
          nextStats.peakPairs = Math.max(nextStats.peakPairs, pairCount);
          nextStats.pairFrames[pairCount] += 1;
          if (now - lastStatsCommitAtRef.current > 220) {
            lastStatsCommitAtRef.current = now;
            setStats({
              ...nextStats,
              pairFrames: [...nextStats.pairFrames] as AnalyzerStats["pairFrames"],
            });
          }
        } catch (error) {
          console.error("[finger-motion] frame analysis failed", error);
        }
      } else if (isExportingRef.current && exportCanvasRef.current) {
        const exportContext = exportCanvasRef.current.getContext("2d");
        if (exportContext && canvasRef.current) {
          exportContext.drawImage(video, 0, 0);
          exportContext.drawImage(canvasRef.current, 0, 0);
        }
      }

      animationFrameRef.current = window.requestAnimationFrame(frame);
    };

    stopAnimation();
    animationFrameRef.current = window.requestAnimationFrame(frame);
  }, [drawOverlay, duration, stopAnimation]);

  const ensureTracker = useCallback(async () => {
    if (trackerRef.current) return trackerRef.current;
    setStatus("loading-model");
    setStatusDetail("正在加载手部识别模型，首次打开需要一点时间…");
    try {
      trackerRef.current = await createTracker();
      setStatus("ready");
      setStatusDetail("模型已就绪。伸出几根手指，就会使用几对同名指尖。");
      return trackerRef.current;
    } catch (error) {
      console.error("[finger-motion] model loading failed", error);
      setStatus("error");
      setStatusDetail("模型加载失败，请检查网络后重试。");
      return null;
    }
  }, []);

  const startPlayback = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    if (!trackerRef.current && !(await ensureTracker())) return;
    try {
      await video.play();
      setStatus("analyzing");
      setStatusDetail("正在识别有效指尖，所有处理都在当前设备完成。");
      runFrameLoop();
    } catch {
      setStatus("error");
      setStatusDetail("浏览器阻止了视频播放，请再次点击开始。");
    }
  }, [ensureTracker, runFrameLoop]);

  const pausePlayback = useCallback(() => {
    videoRef.current?.pause();
    stopAnimation();
    setStatus("paused");
    setStatusDetail("已暂停，可继续播放或拖动进度条。");
  }, [stopAnimation]);

  const stopRecorder = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }, []);

  const resetVideo = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setCurrentTime(0);
    setExportProgress(0);
    resetAnalysis();
    setStatus("ready");
    setStatusDetail("已回到开头，可以重新分析。");
  }, [resetAnalysis]);

  const handleFile = useCallback(
    (file?: File) => {
      if (!file) return;
      if (!file.type.startsWith("video/")) {
        setStatus("error");
        setStatusDetail("请选择 MP4、MOV 或 WebM 视频文件。");
        return;
      }
      stopRecorder();
      resetAnalysis();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const nextUrl = URL.createObjectURL(file);
      objectUrlRef.current = nextUrl;
      setVideoUrl(nextUrl);
      setFileName(file.name);
      setSelectedFile(file);
      setServerJob(null);
      setCheckout(null);
      setOwnerToken("");
      setDuration(0);
      setCurrentTime(0);
      setIsExporting(false);
      isExportingRef.current = false;
      setExportProgress(0);
      setStatus("ready");
      setStatusDetail("视频已载入。建议双手完整入镜，并让要参与的手指明显伸展。");
      void ensureTracker();
    },
    [ensureTracker, resetAnalysis, stopRecorder],
  );

  const exportSnapshot = useCallback(() => {
    const video = videoRef.current;
    const overlay = canvasRef.current;
    if (!video || !overlay || !video.videoWidth) return;
    const output = document.createElement("canvas");
    output.width = video.videoWidth;
    output.height = video.videoHeight;
    const context = output.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, output.width, output.height);
    context.drawImage(overlay, 0, 0, output.width, output.height);
    const link = document.createElement("a");
    link.download = `${fileName.replace(/\.[^.]+$/, "") || "jiaolian"}-手指光膜.png`;
    link.href = output.toDataURL("image/png");
    link.click();
  }, [fileName]);

  const pollServerJob = useCallback(
    async (jobId: string, token: string) => {
      setServerExporting(true);
      try {
        let current = await readApi<MotionEffectJobDto>(
          await fetch(`/api/toolbox/motion-effects/jobs/${jobId}`, {
            cache: "no-store",
            headers: token ? { "x-motion-owner-token": token } : undefined,
          }),
        );
        setServerJob(current);
        setStatusDetail(
          current.queueInfo?.jobsAhead
            ? `已进入${current.queueTier === "priority" ? "极速" : "标准"}队列，前方还有 ${current.queueInfo.jobsAhead} 个真实任务。`
            : "视频正在生成，请保持页面打开。",
        );
        while (!["done", "failed", "expired"].includes(current.status)) {
          await new Promise((resolve) => window.setTimeout(resolve, 1800));
          current = await readApi<MotionEffectJobDto>(
            await fetch(`/api/toolbox/motion-effects/jobs/${jobId}`, {
              cache: "no-store",
              headers: token ? { "x-motion-owner-token": token } : undefined,
            }),
          );
          setServerJob(current);
          setExportProgress(35 + Math.max(0, Math.min(65, current.progress * 0.65)));
        }
        if (current.status !== "done") {
          throw new Error(current.errorMessage || "特效视频生成失败，请重新尝试");
        }
        window.localStorage.removeItem(PENDING_JOB_KEY);
        setCheckout(null);
        setExportProgress(100);
        setStatus("complete");
        setStatusDetail("MP4 已生成并保留原音频，可以直接下载。");
      } finally {
        setServerExporting(false);
      }
    },
    [],
  );

  const exportServerVideo = useCallback(async () => {
    if (!selectedFile || serverExporting) return;
    setServerExporting(true);
    setExportProgress(0);
    setServerJob(null);
    try {
      setStatusDetail("正在创建临时渲染任务…");
      const clientId = clientIdRef.current || getOrCreateMotionClientId();
      clientIdRef.current = clientId;
      const created = await readApi<CreateMotionEffectUploadResponseDto>(
        await fetch("/api/toolbox/motion-effects/create-upload-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-motion-client-id": clientId,
          },
          body: JSON.stringify({
            originalFilename: selectedFile.name,
            contentType: selectedFile.type || "video/mp4",
            fileSizeBytes: selectedFile.size,
            durationSeconds: duration,
            exportQuality,
            queueTier,
            styleKey: selectedStyleKey,
            bgmKey: "original",
          }),
        }),
      );
      const nextOwnerToken = created.ownerToken || "";
      setOwnerToken(nextOwnerToken);
      setSignupFreeAvailable(created.signupFreeAvailable);
      setServerJob(created.job);
      window.localStorage.setItem(
        PENDING_JOB_KEY,
        JSON.stringify({ jobId: created.job.id, ownerToken: nextOwnerToken }),
      );
      setStatusDetail("正在安全上传视频，原文件与成片最多保留 24 小时…");
      await putFile(created.upload.uploadUrl, selectedFile, (value) => {
        setExportProgress(value * 0.35);
      });
      const enqueueResponse = await fetch(
        `/api/toolbox/motion-effects/jobs/${created.job.id}/enqueue`,
        {
          method: "POST",
          headers: nextOwnerToken
            ? { "x-motion-owner-token": nextOwnerToken }
            : undefined,
        },
      );
      if (enqueueResponse.status === 402) {
        const paymentPayload = await enqueueResponse.json().catch(() => null);
        const checkoutData = await readApi<MotionEffectCheckoutDto>(
          await fetch(`/api/toolbox/motion-effects/jobs/${created.job.id}/order`, {
            method: "POST",
            headers: nextOwnerToken
              ? { "x-motion-owner-token": nextOwnerToken }
              : undefined,
          }),
        );
        setCheckout(checkoutData);
        setServerJob(checkoutData.job);
        setStatus("ready");
        setStatusDetail(
          paymentPayload?.message ||
            "预览免费；视频导出会占用服务器计算、临时存储和下载带宽，请完成支付。",
        );
        return;
      }
      const queued = await readApi<MotionEffectJobDto>(enqueueResponse);
      setServerJob(queued);
      await pollServerJob(created.job.id, nextOwnerToken);
    } catch (error) {
      console.error("[finger-motion] server export failed", error);
      setStatus("error");
      setStatusDetail(error instanceof Error ? error.message : "服务端生成失败，请稍后重试。");
    } finally {
      setServerExporting(false);
    }
  }, [
    duration,
    exportQuality,
    pollServerJob,
    queueTier,
    selectedFile,
    selectedStyleKey,
    serverExporting,
  ]);

  const openCheckoutPayment = useCallback(() => {
    const formHtml = checkout?.paymentInfo.formHtml;
    if (!formHtml) return;
    const paymentWindow = window.open("", "_blank");
    if (!paymentWindow) {
      setStatusDetail("浏览器拦截了支付窗口，请允许弹窗后重试。");
      return;
    }
    paymentWindow.document.open();
    paymentWindow.document.write(formHtml);
    paymentWindow.document.close();
    setStatusDetail("支付页面已打开。完成支付后回到本页，点击“我已支付，开始生成”。");
  }, [checkout]);

  const continueAfterPayment = useCallback(async () => {
    if (!serverJob || serverExporting) return;
    setServerExporting(true);
    try {
      const headers = ownerToken ? { "x-motion-owner-token": ownerToken } : undefined;
      const paidJob = await readApi<MotionEffectJobDto>(
        await fetch(
          `/api/toolbox/motion-effects/jobs/${serverJob.id}/payment-status`,
          { cache: "no-store", headers },
        ),
      );
      setServerJob(paidJob);
      if (paidJob.paymentStatus !== "paid") {
        setStatusDetail("暂未收到支付结果；若刚支付完成，请等待几秒后再试。");
        return;
      }
      const queued = await readApi<MotionEffectJobDto>(
        await fetch(`/api/toolbox/motion-effects/jobs/${serverJob.id}/enqueue`, {
          method: "POST",
          headers,
        }),
      );
      setServerJob(queued);
      await pollServerJob(serverJob.id, ownerToken);
    } catch (error) {
      setStatus("error");
      setStatusDetail(error instanceof Error ? error.message : "支付状态确认失败");
    } finally {
      setServerExporting(false);
    }
  }, [ownerToken, pollServerJob, serverExporting, serverJob]);

  const downloadServerVideo = useCallback(async () => {
    if (!serverJob?.canDownload) return;
    try {
      const data = await readApi<{ url: string }>(
        await fetch(
          `/api/toolbox/motion-effects/jobs/${serverJob.id}/download-url`,
          {
            method: "POST",
            headers: ownerToken
              ? { "x-motion-owner-token": ownerToken }
              : undefined,
          },
        ),
      );
      window.location.href = data.url;
    } catch (error) {
      setStatus("error");
      setStatusDetail(error instanceof Error ? error.message : "下载失败");
    }
  }, [ownerToken, serverJob]);

  useEffect(() => {
    clientIdRef.current = getOrCreateMotionClientId();
    const paymentJobId = new URLSearchParams(window.location.search).get("paymentJob");
    if (!paymentJobId) return;
    const pending = window.localStorage.getItem(PENDING_JOB_KEY);
    let saved: { jobId?: string; ownerToken?: string } = {};
    try {
      saved = pending ? JSON.parse(pending) : {};
    } catch {
      saved = {};
    }
    if (saved.jobId !== paymentJobId) {
      setStatusDetail("未找到与本次支付匹配的本机任务，请在原设备上继续。");
      return;
    }
    const token = String(saved.ownerToken || "");
    setOwnerToken(token);
    setServerExporting(true);
    const headers = token ? { "x-motion-owner-token": token } : undefined;
    void (async () => {
      try {
        const paidJob = await readApi<MotionEffectJobDto>(
          await fetch(
            `/api/toolbox/motion-effects/jobs/${paymentJobId}/payment-status`,
            { cache: "no-store", headers },
          ),
        );
        setServerJob(paidJob);
        if (paidJob.paymentStatus !== "paid") {
          setStatusDetail("支付结果仍在确认中，请稍后点击“我已支付，开始生成”。");
          return;
        }
        const queued = await readApi<MotionEffectJobDto>(
          await fetch(`/api/toolbox/motion-effects/jobs/${paymentJobId}/enqueue`, {
            method: "POST",
            headers,
          }),
        );
        setServerJob(queued);
        await pollServerJob(paymentJobId, token);
      } catch (error) {
        setStatus("error");
        setStatusDetail(error instanceof Error ? error.message : "恢复支付任务失败");
      } finally {
        setServerExporting(false);
      }
    })();
  }, [pollServerJob]);

  const exportVideo = useCallback(async () => {
    const video = videoRef.current as CaptureVideoElement | null;
    if (!video || !video.videoWidth || !(await ensureTracker())) return;
    if (
      typeof MediaRecorder === "undefined" ||
      typeof HTMLCanvasElement.prototype.captureStream !== "function"
    ) {
      setStatus("error");
      setStatusDetail("当前浏览器暂不支持整段导出，请使用最新版 Chrome/Edge，或先保存当前帧。");
      return;
    }

    const output = document.createElement("canvas");
    output.width = video.videoWidth;
    output.height = video.videoHeight;
    exportCanvasRef.current = output;
    const outputStream = output.captureStream(30);
    const sourceStream = video.captureStream?.() || video.mozCaptureStream?.();
    sourceStream?.getAudioTracks().forEach((track) => outputStream.addTrack(track));
    const mimeType = getRecorderMimeType();

    try {
      const recorder = new MediaRecorder(
        outputStream,
        mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined,
      );
      recorderChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const actualType = recorder.mimeType || mimeType || "video/webm";
        const extension = actualType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(recorderChunksRef.current, { type: actualType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileName.replace(/\.[^.]+$/, "") || "jiaolian"}-手指光膜.${extension}`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1500);
        outputStream.getTracks().forEach((track) => track.stop());
        exportCanvasRef.current = null;
        recorderRef.current = null;
        setIsExporting(false);
        isExportingRef.current = false;
        setExportProgress(1);
        setStatus("complete");
        setStatusDetail(
          sourceStream?.getAudioTracks().length
            ? "特效视频已生成并保留原音频。"
            : "特效视频已生成；当前浏览器未开放原视频音轨，因此导出为静音。",
        );
      };
      recorder.onerror = () => {
        setIsExporting(false);
        isExportingRef.current = false;
        setStatus("error");
        setStatusDetail("视频生成中断，请重试或改用 Chrome/Edge。");
      };
      recorderRef.current = recorder;
      resetAnalysis();
      const seekToStart = new Promise<void>((resolve) => {
        if (video.currentTime <= 0.01) {
          resolve();
          return;
        }
        video.addEventListener("seeked", () => resolve(), { once: true });
      });
      video.currentTime = 0;
      await seekToStart;
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
          resolve();
          return;
        }
        video.addEventListener("canplay", () => resolve(), { once: true });
      });
      setIsExporting(true);
      isExportingRef.current = true;
      setExportProgress(0);
      recorder.start(500);
      await video.play();
      setStatus("analyzing");
      setStatusDetail("正在实时生成整段特效视频，请保持页面开启…");
      runFrameLoop();
    } catch (error) {
      console.error("[finger-motion] video export failed", error);
      outputStream.getTracks().forEach((track) => track.stop());
      exportCanvasRef.current = null;
      setIsExporting(false);
      isExportingRef.current = false;
      setStatus("error");
      setStatusDetail("无法启动视频导出，请换用最新版 Chrome/Edge。");
    }
  }, [ensureTracker, fileName, resetAnalysis, runFrameLoop]);

  const handleEnded = useCallback(() => {
    stopAnimation();
    setCurrentTime(duration);
    setStats({
      ...statsRef.current,
      pairFrames: [...statsRef.current.pairFrames] as AnalyzerStats["pairFrames"],
    });
    if (isExportingRef.current) {
      stopRecorder();
    } else {
      setStatus("complete");
      setStatusDetail("分析完成。可以回看、保存当前帧，或生成整段特效视频。");
    }
  }, [duration, stopAnimation, stopRecorder]);

  return (
    <main className="min-h-screen bg-[#F7F3EE] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/toolbox")}
            className="inline-flex items-center gap-2 rounded-full border border-[#DCCFC5] bg-white px-4 py-2 text-sm font-bold text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回工具箱
          </button>
          <span className="rounded-full bg-[#E8F4EF] px-3 py-1 text-xs font-black text-[#236654]">
            教链手指光膜
          </span>
        </header>

        <section className="mb-6 overflow-hidden rounded-[32px] border border-[#E3D9D0] bg-white p-6 shadow-sm sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#FFF0E9] px-3 py-1 text-xs font-black text-[#A84A2E]">
                <Sparkles className="h-3.5 w-3.5" />
                手指运动识别 + 即时视觉反馈
              </div>
              <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
                伸出几根手指，
                <span className="text-[#CF6D4E]">光膜就由几根手指生长</span>
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
                上传一段双手视频。系统只配对左右手真正伸展的同名手指：拇指对拇指、食指对食指。
                双手靠近时不显示，随着距离拉开，彩色膜面与流光会逐渐生长；弯曲或被遮挡的手指不会硬塞进图形。
              </p>
            </div>
            <div className="rounded-3xl bg-[#17352B] p-5 text-white">
              <div className="text-xs font-bold text-emerald-200">适合怎么用</div>
              <div className="mt-2 text-xl font-black">拍动作 → 识别手指 → 生成特效</div>
              <p className="mt-2 text-sm leading-6 text-emerald-50/75">
                它既是手部灵活性互动，也可以继续扩展成手指热身、反应训练和动作小游戏。
              </p>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_380px]">
          <section className="rounded-[30px] border border-[#E3D9D0] bg-white p-4 shadow-sm sm:p-6">
            {!videoUrl ? (
              <label className="flex min-h-[520px] cursor-pointer flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-[#DCCFC5] bg-[#FCFAF7] px-6 text-center transition hover:border-[#CF6D4E]">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF0E9] text-[#CF6D4E]">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="mt-5 text-xl font-black">上传双手动作视频</div>
                <div className="mt-2 max-w-md text-sm leading-6 text-slate-500">
                  推荐 MP4 / MOV，双手完整入镜、手掌朝向清楚。预览在本机完成；生成通用
                  MP4 时会临时上传，文件最多保留 24 小时。
                </div>
                <span className="mt-6 rounded-full bg-[#CF6D4E] px-6 py-3 text-sm font-black text-white">
                  选择视频
                </span>
                <input
                  className="hidden"
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/*"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
              </label>
            ) : (
              <>
                <div
                  className="relative overflow-hidden rounded-[24px] bg-black"
                  style={{ aspectRatio: videoRatio }}
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-contain"
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget;
                      setDuration(video.duration || 0);
                      setVideoRatio(
                        video.videoWidth && video.videoHeight
                          ? video.videoWidth / video.videoHeight
                          : 9 / 16,
                      );
                    }}
                    onEnded={handleEnded}
                    onPause={() => {
                      if (!isExporting && status === "analyzing") {
                        setStatus("paused");
                        stopAnimation();
                      }
                    }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                  />
                  <div className="pointer-events-none absolute left-3 top-3 flex gap-2">
                    <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-black text-white backdrop-blur">
                      {currentFingerNames}
                    </span>
                    {(isExporting || serverExporting) && (
                      <span className="rounded-full bg-[#CF6D4E] px-3 py-1 text-xs font-black text-white">
                        生成中 {Math.round(serverExporting ? exportProgress : exportProgress * 100)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={Math.min(currentTime, duration || 0)}
                    disabled={isExporting}
                    onChange={(event) => {
                      const nextTime = Number(event.target.value);
                      if (!videoRef.current) return;
                      videoRef.current.currentTime = nextTime;
                      setCurrentTime(nextTime);
                      lastProcessedVideoTimeRef.current = -1;
                      if (lastResultsRef.current) drawOverlay(lastResultsRef.current);
                    }}
                    className="w-full accent-[#CF6D4E]"
                  />
                  <div className="mt-1 flex justify-between text-xs font-bold text-slate-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!canStart && !isPlaying}
                    onClick={isPlaying ? pausePlayback : startPlayback}
                    className="inline-flex min-w-36 items-center justify-center gap-2 rounded-full bg-[#CF6D4E] px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {status === "loading-model" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    {isPlaying ? "暂停" : "开始识别"}
                  </button>
                  <button
                    type="button"
                    disabled={isExporting}
                    onClick={resetVideo}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    重新播放
                  </button>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700">
                    <Upload className="h-4 w-4" />
                    更换视频
                    <input
                      className="hidden"
                      type="file"
                      accept="video/*"
                      onChange={(event) => handleFile(event.target.files?.[0])}
                    />
                  </label>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={isExporting || serverExporting}
                    onClick={
                      serverJob?.canDownload
                        ? downloadServerVideo
                        : exportServerVideo
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#17352B] px-5 py-4 text-sm font-black text-white disabled:opacity-50"
                  >
                    {serverExporting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : serverJob?.canDownload ? (
                      <Download className="h-4 w-4" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    {serverExporting
                      ? `生成中 ${Math.round(exportProgress)}%`
                      : serverJob?.canDownload
                        ? "下载 MP4"
                        : selectedPriceCents === 0
                          ? "使用注册赠送生成"
                          : `生成并下载 · ¥${(selectedPriceCents / 100).toFixed(1)}`}
                  </button>
                  <button
                    type="button"
                    disabled={!stats.analyzedFrames || isExporting}
                    onClick={exportSnapshot}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#DCCFC5] bg-[#FCFAF7] px-5 py-4 text-sm font-black text-slate-800 disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    保存当前帧
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-[28px] border border-[#E5DDD7] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">选择视觉风格</h2>
                <span className="text-xs font-bold text-slate-500">
                  {MOTION_STYLES.length} 种
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {MOTION_STYLES.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    aria-pressed={selectedStyleKey === style.key}
                    onClick={() => setSelectedStyleKey(style.key)}
                    className={`rounded-2xl border p-3 text-left transition ${
                      selectedStyleKey === style.key
                        ? "border-[#CF6D4E] bg-[#FFF0E9]"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex gap-1">
                      {style.hues.slice(0, 5).map((hue) => (
                        <span
                          key={hue}
                          className="h-3 flex-1 rounded-full"
                          style={{
                            backgroundColor: `hsl(${hue}, ${style.saturation}%, 58%)`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 text-sm font-black">{style.name}</div>
                    <div className="mt-1 text-[11px] leading-4 text-slate-500">
                      {style.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-[#E5DDD7] bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black">下载规格</h2>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                预览免费。视频导出会持续占用服务器计算、临时存储和下载带宽，免费资源无法长期支撑，因此下载按规格收费。
              </p>
              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => setExportQuality("standard")}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    exportQuality === "standard"
                      ? "border-[#CF6D4E] bg-[#FFF0E9]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black">标准版 720p</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      标准码率 · 带“教链”
                    </span>
                  </span>
                  <span className="text-sm font-black text-[#A84A2E]">
                    {freeStandardSelected
                      ? "注册赠送"
                      : `¥${(prices.standardCents / 100).toFixed(1)}`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setExportQuality("hd")}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    exportQuality === "hd"
                      ? "border-[#CF6D4E] bg-[#FFF0E9]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black">高清版 1080p</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      高码率 · 风格细节更完整
                    </span>
                  </span>
                  <span className="text-sm font-black text-[#A84A2E]">
                    ¥{(prices.hdCents / 100).toFixed(1)}
                  </span>
                </button>
                <button
                  type="button"
                  aria-pressed={queueTier === "priority"}
                  onClick={() =>
                    setQueueTier((current) =>
                      current === "priority" ? "standard" : "priority",
                    )
                  }
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${
                    queueTier === "priority"
                      ? "border-[#236654] bg-[#EDF7F2]"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <span>
                    <span className="block text-sm font-black">极速处理</span>
                    <span className="mt-1 block text-xs text-slate-500">
                      进入独立优先队列，不影响真实队列统计
                    </span>
                  </span>
                  <span className="text-sm font-black text-[#236654]">
                    +¥{(prices.priorityAddonCents / 100).toFixed(1)}
                  </span>
                </button>
              </div>
              {!signedIn ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/login?returnTo=${encodeURIComponent("/toolbox/motion-effects")}`,
                    )
                  }
                  className="mt-4 w-full rounded-2xl border border-[#DCCFC5] bg-white px-4 py-3 text-sm font-black text-slate-800"
                >
                  注册并领取一次 720p 免费下载
                </button>
              ) : signupFreeAvailable ? (
                <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold leading-5 text-emerald-800">
                  你的注册赠送次数尚未使用：标准队列 720p 本次免费；高清和极速处理仍需付费。
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
                  注册赠送的免费下载已经使用，后续按所选规格付费。
                </div>
              )}
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="text-sm font-bold text-slate-600">本次预计</span>
                <span className="text-2xl font-black text-[#CF6D4E]">
                  {selectedPriceCents === 0
                    ? "免费"
                    : `¥${(selectedPriceCents / 100).toFixed(1)}`}
                </span>
              </div>
            </section>

            {checkout ? (
              <section className="rounded-[28px] border border-[#F1C7B8] bg-[#FFF7F2] p-5 shadow-sm">
                <div className="text-xs font-black text-[#A84A2E]">等待付款</div>
                <div className="mt-2 text-xl font-black">
                  ¥{checkout.order.totalAmountYuan.toFixed(2)}
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  支付成功后才会占用服务器算力开始生成；渲染失败不会吞掉注册赠送次数。
                </p>
                <div className="mt-4 grid gap-2">
                  <button
                    type="button"
                    onClick={openCheckoutPayment}
                    className="rounded-2xl bg-[#CF6D4E] px-4 py-3 text-sm font-black text-white"
                  >
                    前往支付宝付款
                  </button>
                  <button
                    type="button"
                    onClick={continueAfterPayment}
                    disabled={serverExporting}
                    className="rounded-2xl border border-[#DCCFC5] bg-white px-4 py-3 text-sm font-black text-slate-800 disabled:opacity-50"
                  >
                    我已支付，开始生成
                  </button>
                </div>
              </section>
            ) : null}

            <section className="rounded-[28px] border border-[#E5DDD7] bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-[#E8F4EF] p-3 text-[#236654]">
                  <Hand className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-black">识别状态</div>
                  <div className="mt-1 text-sm leading-6 text-slate-500">{statusDetail}</div>
                </div>
              </div>
              {(isExporting || serverExporting) && (
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#CF6D4E] transition-[width]"
                    style={{
                      width: `${Math.round(serverExporting ? exportProgress : exportProgress * 100)}%`,
                    }}
                  />
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-[#E5DDD7] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-black">实时分析</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                  {stats.analyzedFrames} 帧
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-emerald-50 p-4">
                  <div className="text-xs font-bold text-emerald-700">当前双手</div>
                  <div className="mt-1 text-3xl font-black text-emerald-950">
                    {stats.currentHands}
                  </div>
                  <div className="mt-1 text-xs text-emerald-700">
                    {stats.currentHands >= 2 ? "已完成同名配对" : "需要双手入镜"}
                  </div>
                </div>
                <div className="rounded-2xl bg-orange-50 p-4">
                  <div className="text-xs font-bold text-orange-700">有效指尖对</div>
                  <div className="mt-1 text-3xl font-black text-orange-950">
                    {stats.currentPairs}
                  </div>
                  <div className="mt-1 text-xs text-orange-700">峰值 {stats.peakPairs} 对</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs font-bold text-slate-500">手部覆盖率</div>
                  <div className="mt-1 text-2xl font-black">{handCoverage}%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-xs font-bold text-slate-500">当前结构</div>
                  <div className="mt-1 text-lg font-black">
                    {stats.currentPairs === 0
                      ? "待激活"
                      : stats.currentPairs === 1
                        ? "连接线"
                        : stats.currentPairs === 2
                          ? "动态膜面"
                          : "封闭立体"}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#D8E7E0] bg-[#EDF7F2] p-5">
              <h2 className="text-base font-black text-[#17352B]">它为什么算“手指运动”</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#43635A]">
                <li>· 判断的是手指主动伸展、弯曲与持续状态，不是静态贴纸。</li>
                <li>· 左右手同名手指严格配对，大拇指只连接大拇指。</li>
                <li>· 手掌距离控制显隐，靠近消失，拉开后平滑渐显。</li>
                <li>· 两对指尖交叉时拆成两只三角形，不再错误补成整块凸面。</li>
                <li>· 2 帧确认伸展、3 帧确认收回，减少遮挡造成的闪烁。</li>
                <li>· 颜色随时间缓慢流动，边缘与膜面带有移动光带。</li>
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
