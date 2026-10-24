"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { ArrowLeft, Download, Loader2, Play, Upload, Wand2 } from "lucide-react";
import { useToastContext } from "@/context/ToastContext";
import type {
  CreatePowerAnalysisUploadUrlResponseDto,
  PowerAnalysisDownloadUrlResponseDto,
  PowerAnalysisJobDto,
  PowerAnalysisMode,
} from "@/app/api/toolbox/power-analysis/types";
import {
  isBarbellPowerAnalysisMode,
  isCustomPowerAnalysisMode,
  isValidPlateDiameterCm,
  isValidPowerAnalysisLoadKg,
  parsePowerAnalysisCustomActionName,
  POWER_ANALYSIS_BARBELL_SHOOTING_TIP,
  POWER_ANALYSIS_CUSTOM_ACTION_NAME_MAX_LENGTH,
  POWER_ANALYSIS_CUSTOM_SHOOTING_TIP,
  POWER_ANALYSIS_DEFAULT_BARBELL_MASS_KG,
  POWER_ANALYSIS_DEFAULT_PLATE_DIAMETER_CM,
  POWER_ANALYSIS_MODE_OPTIONS as MODE_OPTIONS,
  type PowerAnalysisSubject,
} from "@coachlink/core/src/powerAnalysisModes";
import { buildProfileBodyMetricsPatch } from "@coachlink/core/src/bodyMetrics";
import { useMyBodyMetrics } from "@/hooks/useMyBodyMetrics";
import AssessmentCard from "./AssessmentCard";
import BodyMetricsField from "./BodyMetricsField";
import CustomResult from "./CustomResult";
import PowerCurves from "./PowerCurves";

type UploadPhase = "idle" | "creating" | "uploading" | "uploaded" | "enqueueing" | "queued" | "done";

const ACTIVE_JOB_STORAGE_KEY = "coachlink:power-analysis:active-job";
const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm outline-none focus:border-[#CF6D4E]";

function formatMetric(value: number | undefined, digits = 1) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return n.toFixed(digits);
}

function formatFileSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function summaryTiles(metrics: NonNullable<PowerAnalysisJobDto["metrics"]>, barbell: boolean) {
  const { summary } = metrics;
  if (barbell) {
    const loss = summary.velocityLossPct;
    return [
      { label: "有效次数", value: String(metrics.repCount), accent: false },
      { label: "最佳平均速度", value: `${formatMetric(summary.bestMeanVelocityMps, 2)} m/s`, accent: true },
      { label: "组内速度下降", value: typeof loss === "number" ? `${formatMetric(loss, 0)}%` : "-", accent: false },
      { label: "杠铃抬升功率", value: `${formatMetric(summary.bestPowerW, 0)} W`, accent: false },
    ];
  }
  return [
    { label: "有效次数", value: String(metrics.repCount), accent: false },
    { label: "最高功率", value: `${formatMetric(summary.bestPowerW, 0)} W`, accent: false },
    { label: "最高马力", value: `${formatMetric(summary.bestHorsepowerHp, 2)} hp`, accent: true },
    { label: "最快速度", value: `${formatMetric(summary.bestVelocityMps, 2)} m/s`, accent: false },
  ];
}

async function readApi<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.message || `请求失败（${response.status}）`);
  }
  return data.data as T;
}

function putFile(uploadUrl: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / Math.max(event.total, 1)) * 100);
      onProgress(Math.max(1, Math.min(99, pct)));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve();
        return;
      }
      reject(new Error(xhr.responseText || `上传失败（${xhr.status}）`));
    };
    xhr.onerror = () => reject(new Error("上传中断，请检查网络"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.send(file);
  });
}

export default function PowerAnalysisToolPage() {
  const router = useRouter();
  const { showToast } = useToastContext();
  const pollTimerRef = useRef<number | null>(null);
  const llmRequestedRef = useRef<string | null>(null);
  const pollFailuresRef = useRef(0);
  const pollWarningShownRef = useRef(false);

  const [mode, setMode] = useState<PowerAnalysisMode>("pullup");
  const bodyMetrics = useMyBodyMetrics();
  const [subject, setSubject] = useState<PowerAnalysisSubject>("self");
  // No made-up 175 cm / 70 kg: empty until the profile or this device's last values fill it in.
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [editingBody, setEditingBody] = useState(false);
  const bodyTouchedRef = useRef(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [externalLoadKg, setExternalLoadKg] = useState("0");
  const [barbellKg, setBarbellKg] = useState(String(POWER_ANALYSIS_DEFAULT_BARBELL_MASS_KG));
  const [plateDiameterCm, setPlateDiameterCm] = useState(String(POWER_ANALYSIS_DEFAULT_PLATE_DIAMETER_CM));
  const [customActionName, setCustomActionName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [job, setJob] = useState<PowerAnalysisJobDto | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const resultModeValue = job?.mode ?? mode;
  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((item) => item.value === resultModeValue) || MODE_OPTIONS[0],
    [resultModeValue],
  );

  const metrics = job?.metrics || null;
  const isBarbell = isBarbellPowerAnalysisMode(mode);
  const isCustom = isCustomPowerAnalysisMode(mode);
  const resultIsBarbell = isBarbellPowerAnalysisMode(metrics?.mode);
  const resultIsCustom = isCustomPowerAnalysisMode(metrics?.mode);
  const resultLabel = isCustomPowerAnalysisMode(job?.mode) && job?.customActionName
    ? `其他动作 · ${job.customActionName}`
    : selectedMode.label;
  const loadValue = isBarbell ? barbellKg : externalLoadKg;
  const formReady =
    Number(heightCm) >= 100 &&
    Number(heightCm) <= 250 &&
    Number(weightKg) >= 30 &&
    Number(weightKg) <= 250 &&
    isValidPowerAnalysisLoadKg(mode, loadValue) &&
    (!isBarbell || isValidPlateDiameterCm(plateDiameterCm)) &&
    (!isCustom || parsePowerAnalysisCustomActionName(customActionName).ok);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isUploading = ["creating", "uploading"].includes(phase);
  const isAnalyzing = ["enqueueing", "queued"].includes(phase) || job?.status === "queued" || job?.status === "processing";
  const settingsLocked = isUploading || isAnalyzing || phase === "uploaded";
  const canSubmit =
    formReady &&
    phase === "uploaded" &&
    job?.status === "awaiting_upload";

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!bodyMetrics.loaded || subject !== "self" || bodyTouchedRef.current) return;
    setHeightCm(bodyMetrics.defaults.heightCm);
    setWeightKg(bodyMetrics.defaults.weightKg);
  }, [bodyMetrics.loaded, bodyMetrics.defaults, subject]);

  const bodyCollapsed = subject === "self" && bodyMetrics.defaults.fromProfile && !editingBody;
  const profilePatch = useMemo(
    () => (subject === "self" ? buildProfileBodyMetricsPatch({ heightCm, weightKg }, bodyMetrics.profile) : null),
    [subject, heightCm, weightKg, bodyMetrics.profile],
  );

  const changeHeight = (value: string) => {
    bodyTouchedRef.current = true;
    setHeightCm(value);
  };
  const changeWeight = (value: string) => {
    bodyTouchedRef.current = true;
    setWeightKg(value);
  };

  const changeSubject = (next: PowerAnalysisSubject) => {
    setSubject(next);
    setEditingBody(false);
    if (next === "other") {
      bodyTouchedRef.current = true;
      setHeightCm("");
      setWeightKg("");
      return;
    }
    bodyTouchedRef.current = false;
    setHeightCm(bodyMetrics.defaults.heightCm);
    setWeightKg(bodyMetrics.defaults.weightKg);
  };

  const saveBodyToProfile = async () => {
    if (!profilePatch) return;
    setSavingProfile(true);
    try {
      await bodyMetrics.saveToProfile(profilePatch);
      showToast({ severity: "success", summary: "已更新个人资料", detail: "下次会自动填好身高体重。" });
    } catch (error: any) {
      showToast({ severity: "error", summary: "保存失败", detail: error?.message || "请稍后重试" });
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const seekPreview = (timeS: number) => {
    const player = previewRef.current;
    if (!player) return;
    player.currentTime = Math.max(0, timeS - 0.5);
    player.scrollIntoView({ behavior: "smooth", block: "center" });
    void player.play().catch(() => undefined);
  };

  useEffect(() => {
    const restoreJob = async () => {
      const raw = window.sessionStorage.getItem(ACTIVE_JOB_STORAGE_KEY);
      if (!raw) return;

      let jobId = "";
      try {
        const parsed = JSON.parse(raw);
        jobId = String(parsed?.jobId || "");
      } catch {
        window.sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
        return;
      }
      if (!jobId) return;

      try {
        const restored = await readApi<PowerAnalysisJobDto>(
          await fetch(`/api/toolbox/power-analysis/jobs/${jobId}`, { method: "GET" }),
        );
        setJob(restored);
        if (restored.status === "awaiting_upload") setPhase("uploaded");
        else if (restored.status === "queued" || restored.status === "processing") {
          setPhase("queued");
          pollJob(restored.id);
        } else if (["done", "failed", "expired"].includes(restored.status)) {
          setPhase("done");
        }
      } catch {
        window.sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
      }
    };

    void restoreJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!job?.id) return;
    window.sessionStorage.setItem(
      ACTIVE_JOB_STORAGE_KEY,
      JSON.stringify({ jobId: job.id, updatedAt: Date.now() }),
    );
  }, [job?.id, job?.status]);

  useEffect(() => {
    if (!job?.id || job.status !== "done" || job.llmSummary || llmRequestedRef.current === job.id) return;
    llmRequestedRef.current = job.id;
    void generateSummary(job.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status, job?.llmSummary]);

  const pollJob = (jobId: string) => {
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollFailuresRef.current = 0;
    pollWarningShownRef.current = false;
    pollTimerRef.current = window.setInterval(async () => {
      try {
        const next = await readApi<PowerAnalysisJobDto>(
          await fetch(`/api/toolbox/power-analysis/jobs/${jobId}`, { method: "GET" }),
        );
        pollFailuresRef.current = 0;
        pollWarningShownRef.current = false;
        setJob(next);
        if (["done", "failed", "expired"].includes(next.status)) {
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          setPhase("done");
        }
      } catch (error: any) {
        pollFailuresRef.current += 1;
        if (pollFailuresRef.current < 4) return;
        if (pollWarningShownRef.current) return;
        pollWarningShownRef.current = true;
        showToast({
          severity: "warn",
          summary: "状态刷新暂时失败",
          detail: error?.message || "后台任务可能仍在处理，页面会继续尝试刷新。",
        });
      }
    }, 1800);
  };

  const generateSummary = async (jobId: string) => {
    setLlmLoading(true);
    try {
      const next = await readApi<PowerAnalysisJobDto>(
        await fetch(`/api/toolbox/power-analysis/jobs/${jobId}/llm-summary`, {
          method: "POST",
        }),
      );
      setJob(next);
    } catch (error: any) {
      showToast({ severity: "warn", summary: "AI 解读未生成", detail: error?.message || "指标结果仍可查看和下载" });
    } finally {
      setLlmLoading(false);
    }
  };

  const prepareUpload = async (nextFile: File) => {
    if (!formReady) {
      showToast({
        severity: "warn",
        summary: "参数不完整",
        detail: isBarbell
          ? "请先填写有效的身高、体重、杠铃总重和杠铃片直径。"
          : isCustom
            ? "请先填写动作名称和有效的身高、体重、负重。"
            : "请先填写有效的身高、体重和额外负重。",
      });
      return;
    }

    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
    setFile(nextFile);
    setUploadProgress(0);
    setJob(null);
    llmRequestedRef.current = null;

    try {
      setPhase("creating");
      const created = await readApi<CreatePowerAnalysisUploadUrlResponseDto>(
        await fetch("/api/toolbox/power-analysis/create-upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            heightCm: Number(heightCm),
            weightKg: Number(weightKg),
            subject,
            externalLoadKg: Number(loadValue),
            ...(isBarbell ? { plateDiameterCm: Number(plateDiameterCm) } : {}),
            ...(isCustom ? { customActionName: customActionName.trim() } : {}),
            originalFilename: nextFile.name,
            contentType: nextFile.type || "video/mp4",
            fileSizeBytes: nextFile.size,
          }),
        }),
      );
      setJob(created.job);
      if (subject === "self") bodyMetrics.remember({ heightCm, weightKg });

      setPhase("uploading");
      await putFile(created.upload.uploadUrl, nextFile, setUploadProgress);
      setPhase("uploaded");
      showToast({ severity: "success", summary: "视频已上传", detail: "现在可以点击开始分析。" });
    } catch (error: any) {
      setPhase("idle");
      setJob(null);
      setUploadProgress(0);
      showToast({ severity: "error", summary: "上传失败", detail: error?.message || "请稍后重试" });
    }
  };

  const handleFileChange = (nextFile: File | null) => {
    if (!nextFile) {
      resetForm();
      return;
    }
    void prepareUpload(nextFile);
  };

  const handleStart = async () => {
    if (!canSubmit || !job?.id) {
      showToast({ severity: "warn", summary: "请先上传视频", detail: "选择视频后会自动上传，上传完成后再开始分析。" });
      return;
    }
    llmRequestedRef.current = null;

    try {
      setPhase("enqueueing");

      const queued = await readApi<PowerAnalysisJobDto>(
        await fetch(`/api/toolbox/power-analysis/jobs/${job.id}/enqueue`, {
          method: "POST",
        }),
      );
      setJob(queued);
      setPhase("queued");
      pollJob(queued.id);
      showToast({ severity: "success", summary: "已开始分析", detail: "视频会作为临时任务处理，完成后可下载。" });
    } catch (error: any) {
      setPhase("uploaded");
      showToast({ severity: "error", summary: "提交分析失败", detail: error?.message || "请稍后重试" });
    }
  };

  const handleDownload = async () => {
    if (!job?.id) return;
    setDownloading(true);
    try {
      const data = await readApi<PowerAnalysisDownloadUrlResponseDto>(
        await fetch(`/api/toolbox/power-analysis/jobs/${job.id}/download-url`, {
          method: "POST",
        }),
      );
      const a = document.createElement("a");
      a.href = data.proxyUrl || data.signedUrl || data.url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error: any) {
      showToast({ severity: "error", summary: "下载失败", detail: error?.message || "请稍后重试" });
    } finally {
      setDownloading(false);
    }
  };

  const resetForm = () => {
    setFile(null);
    setPhase("idle");
    setUploadProgress(0);
    setJob(null);
    llmRequestedRef.current = null;
    pollFailuresRef.current = 0;
    pollWarningShownRef.current = false;
    window.sessionStorage.removeItem(ACTIVE_JOB_STORAGE_KEY);
    if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  const statusText = (() => {
    if (phase === "creating") return "正在创建临时上传任务";
    if (phase === "uploading") return `正在上传 ${uploadProgress}%`;
    if (phase === "uploaded") return "视频已上传，点击开始分析";
    if (phase === "enqueueing") return "正在提交分析任务";
    if (job?.status === "queued") return "排队中";
    if (job?.status === "processing") return `分析中 ${job.progress}%`;
    if (job?.status === "done") return "分析完成";
    if (job?.status === "failed") return "分析失败";
    if (job?.status === "expired") return "任务已过期";
    return "选择视频后会自动上传";
  })();

  const progressValue = (() => {
    if (job?.status === "done") return 100;
    if (job?.status === "processing" || job?.status === "queued") return Math.max(5, job.progress || 5);
    if (phase === "uploaded") return 100;
    if (phase === "enqueueing") return 100;
    if (phase === "uploading") return uploadProgress;
    if (phase === "creating") return 5;
    return 0;
  })();
  const queueStatusText = (() => {
    const queueInfo = job?.queueInfo;
    if (!queueInfo || (job?.status !== "queued" && job?.status !== "processing")) return "";
    if (job.status === "processing") return `正在分析你的视频，后面还有 ${queueInfo.totalQueued} 个任务等待`;
    if (queueInfo.jobsAhead <= 0) return "你排在最前面，马上开始分析";
    return `前面还有 ${queueInfo.jobsAhead} 个任务，其中 ${queueInfo.processingAhead} 个正在分析、${queueInfo.queuedAhead} 个在等待`;
  })();

  return (
    <main className="min-h-screen bg-surface-50 px-4 py-6 md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Button
            icon={<ArrowLeft className="h-4 w-4" />}
            text
            rounded
            aria-label="返回"
            onClick={() => router.back()}
            className="text-surface-700"
          />
          <div className="rounded-full border border-surface-200 bg-surface-0 px-3 py-1 text-xs font-semibold text-surface-600">
            临时视频最多保留 24 小时
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
          <section className="rounded-2xl border border-surface-200 bg-surface-0 p-5 shadow-sm">
            <div className="mb-5">
              <h1 className="text-2xl font-black tracking-tight text-surface-900">功率与动作分析</h1>
              <p className="mt-2 text-sm leading-6 text-surface-600">
                上传自重动作或三大项视频，得到速度、功率和动作评估，并可下载带实时标注的视频。
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-2 text-sm font-bold text-surface-800">动作类型</div>
                <div className="grid grid-cols-2 gap-2">
                  {MODE_OPTIONS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      disabled={settingsLocked}
                      onClick={() => !settingsLocked && setMode(item.value)}
                      className={[
                        "rounded-xl border px-3 py-3 text-left transition-colors",
                        item.value === "custom" ? "col-span-2" : "",
                        mode === item.value
                          ? "border-[#1D1A16] bg-[#1D1A16] text-white"
                          : "border-surface-200 bg-surface-0 text-surface-800 hover:border-[#CF6D4E]",
                      ].join(" ")}
                    >
                      <div className="text-sm font-black">{item.label}</div>
                      <div className={mode === item.value ? "mt-1 text-xs text-white/80" : "mt-1 text-xs text-surface-500"}>
                        {item.hint}
                      </div>
                    </button>
                  ))}
                </div>
                {(isBarbell || isCustom) && (
                  <div className="mt-2 rounded-xl border border-[#F0C6B9] bg-[#FDF2EC] px-3 py-2 text-xs leading-5 text-[#8F432D]">
                    {isCustom ? POWER_ANALYSIS_CUSTOM_SHOOTING_TIP : POWER_ANALYSIS_BARBELL_SHOOTING_TIP}
                  </div>
                )}
              </div>

              {isCustom && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-surface-800">动作名称</span>
                  <input
                    value={customActionName}
                    onChange={(e) => setCustomActionName(e.target.value)}
                    disabled={settingsLocked}
                    maxLength={POWER_ANALYSIS_CUSTOM_ACTION_NAME_MAX_LENGTH}
                    placeholder="例如：哑铃弯举、保加利亚分腿蹲"
                    className={INPUT_CLASS}
                  />
                </label>
              )}

              <BodyMetricsField
                subject={subject}
                onSubjectChange={changeSubject}
                heightCm={heightCm}
                weightKg={weightKg}
                onHeightChange={changeHeight}
                onWeightChange={changeWeight}
                collapsed={bodyCollapsed}
                onEdit={() => setEditingBody(true)}
                profile={bodyMetrics.profile}
                signedIn={bodyMetrics.signedIn}
                profilePatch={profilePatch}
                savingProfile={savingProfile}
                onSaveToProfile={() => void saveBodyToProfile()}
                locked={settingsLocked}
              />

              <div className={isBarbell ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                {isBarbell ? (
                  <>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-bold text-surface-800">杠铃总重 kg</span>
                      <input
                        value={barbellKg}
                        onChange={(e) => setBarbellKg(e.target.value)}
                        disabled={settingsLocked}
                        inputMode="decimal"
                        className={INPUT_CLASS}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-bold text-surface-800">杠铃片直径 cm</span>
                      <input
                        value={plateDiameterCm}
                        onChange={(e) => setPlateDiameterCm(e.target.value)}
                        disabled={settingsLocked}
                        inputMode="decimal"
                        className={INPUT_CLASS}
                      />
                    </label>
                  </>
                ) : (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-surface-800">
                      {isCustom ? "负重 kg（选填）" : "额外负重 kg"}
                    </span>
                    <input
                      value={externalLoadKg}
                      onChange={(e) => setExternalLoadKg(e.target.value)}
                      disabled={settingsLocked}
                      inputMode="decimal"
                      className={INPUT_CLASS}
                    />
                  </label>
                )}
              </div>
              {isBarbell && (
                <div className="-mt-2 text-xs text-surface-500">
                  杠铃总重含杠铃杆和杠铃片；标准片直径 45 cm，请填写杠上最大那片的直径。
                </div>
              )}

              <label className="block rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-4">
                <span className="mb-2 flex items-center gap-2 text-sm font-bold text-surface-800">
                  <Upload className="h-4 w-4" />
                  上传视频
                </span>
                <input
                  type="file"
                  accept="video/*"
                  disabled={isUploading || isAnalyzing}
                  className="block w-full text-sm text-surface-700 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-900 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                  onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                />
                {file && (
                  <div className="mt-3 rounded-xl border border-surface-200 bg-surface-0 px-3 py-2 text-xs text-surface-600">
                    {file.name} · {formatFileSize(file.size)}
                  </div>
                )}
              </label>

              <div className="rounded-xl border border-surface-200 bg-surface-50 p-3">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-bold text-surface-800">{statusText}</span>
                  <span className="text-surface-500">{progressValue}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-surface-200">
                  <div
                    className="h-full rounded-full bg-[#CF6D4E] transition-all"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>
                {queueStatusText && (
                  <div className="mt-3 rounded-lg border border-[#F0C6B9] bg-[#FDF2EC] px-3 py-2 text-xs font-semibold text-[#8F432D]">
                    {queueStatusText}
                  </div>
                )}
              </div>

              {job?.errorMessage && (
                <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
                  {job.errorMessage}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  label={isUploading ? "正在上传" : isAnalyzing ? "处理中" : "开始分析"}
                  icon={
                    isUploading || isAnalyzing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="mr-2 h-4 w-4" />
                    )
                  }
                  disabled={!canSubmit}
                  onClick={handleStart}
                  className="h-11 flex-1 rounded-xl border-[#B4553A] bg-[#B4553A] text-sm font-black text-white hover:border-[#9A4630] hover:bg-[#9A4630]"
                />
                <Button
                  label="重置"
                  outlined
                  severity="secondary"
                  onClick={resetForm}
                  className="h-11 rounded-xl border-surface-200 text-sm font-black text-surface-800"
                />
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-2xl border border-surface-200 bg-surface-0 p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#CF6D4E]">{resultLabel}</div>
                  <h2 className="mt-1 text-xl font-black text-surface-900">分析结果</h2>
                </div>
                <Button
                  label={downloading ? "生成链接中" : "下载分析视频"}
                  icon={downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  disabled={!job?.canDownload || downloading}
                  onClick={handleDownload}
                  className="h-10 rounded-xl border-surface-900 bg-surface-900 text-sm font-black text-white hover:border-surface-800 hover:bg-surface-800"
                />
              </div>

              {!metrics ? (
                <div className="rounded-xl border border-surface-200 bg-surface-50 p-5 text-sm text-surface-600">
                  提交视频后，速度、功率、逐次数据和动作评估会显示在这里。
                </div>
              ) : (
                <div className="space-y-4">
                  {resultIsCustom && <CustomResult metrics={metrics} />}
                  {!resultIsCustom && (
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {summaryTiles(metrics, resultIsBarbell).map((tile) => (
                      <div key={tile.label} className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                        <div className="text-xs text-surface-500">{tile.label}</div>
                        <div className={`mt-1 text-2xl font-black ${tile.accent ? "text-[#CF6D4E]" : "text-surface-900"}`}>
                          {tile.value}
                        </div>
                      </div>
                    ))}
                  </div>
                  )}

                  {previewUrl && (
                    <video
                      ref={previewRef}
                      src={previewUrl}
                      controls
                      muted
                      playsInline
                      className="max-h-80 w-full rounded-xl border border-surface-200 bg-surface-900"
                    />
                  )}

                  {!resultIsCustom && <PowerCurves points={metrics.timeSeries} />}

                  {!resultIsCustom && (
                  <div className="overflow-hidden rounded-xl border border-surface-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-50 text-left text-xs text-surface-500">
                        <tr>
                          <th className="px-3 py-3">次数</th>
                          <th className="px-3 py-3">位移</th>
                          <th className="px-3 py-3">上升时间</th>
                          <th className="px-3 py-3">平均速度</th>
                          <th className="px-3 py-3">最大速度</th>
                          <th className="px-3 py-3">功率</th>
                          {!resultIsBarbell && <th className="px-3 py-3">马力</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.reps.map((rep) => (
                          <tr key={rep.repIndex} className="border-t border-surface-100">
                            <td className="px-3 py-2 font-bold text-surface-900">#{rep.repIndex}</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.displacementM, 2)} m</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.ascentTimeS, 2)} s</td>
                            <td className="px-3 py-2 text-surface-700">
                              {rep.meanVelocityMps === undefined ? "-" : `${formatMetric(rep.meanVelocityMps, 2)} m/s`}
                            </td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.maxVelocityMps, 2)} m/s</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.avgPowerW, 0)} W</td>
                            {!resultIsBarbell && (
                              <td className="px-3 py-2 text-surface-700">{formatMetric(rep.horsepowerHp, 2)} hp</td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  )}
                  {resultIsBarbell && (
                    <div className="text-xs leading-5 text-surface-500">
                      功率为杠铃抬升功率（杠铃总重 × g × 杠铃上升高度 ÷ 上升时间），只用来和自己同重量的记录比较，不代表力量水平。
                    </div>
                  )}
                </div>
              )}
            </div>

            <AssessmentCard
              assessment={metrics?.assessment}
              measurement={metrics?.measurement}
              onSeek={previewUrl ? seekPreview : undefined}
            />

            <div className="rounded-2xl border border-surface-200 bg-surface-0 p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-black text-surface-900">AI 解读</h2>
                {llmLoading && <Loader2 className="h-4 w-4 animate-spin text-[#CF6D4E]" />}
                {!llmLoading && job?.status === "done" && (
                  <Button
                    label="重新生成"
                    icon={<Wand2 className="mr-2 h-4 w-4" />}
                    outlined
                    size="small"
                    disabled={!job?.id}
                    onClick={() => job?.id && generateSummary(job.id)}
                    className="h-9 rounded-xl border-surface-200 text-sm font-bold text-surface-800"
                  />
                )}
              </div>
              <div className="whitespace-pre-line rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm leading-7 text-surface-700">
                {job?.llmSummary ||
                  (llmLoading
                    ? "正在根据结构化指标生成解读..."
                    : "分析完成后，这里会生成一段训练建议。")}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
