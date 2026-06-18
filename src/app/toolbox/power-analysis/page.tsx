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

type UploadPhase = "idle" | "creating" | "uploading" | "uploaded" | "enqueueing" | "queued" | "done";

const ACTIVE_JOB_STORAGE_KEY = "coachlink:power-analysis:active-job";

const MODE_OPTIONS: Array<{ label: string; value: PowerAnalysisMode; hint: string }> = [
  { label: "引体向上", value: "pullup", hint: "适合连续引体、爆发引体、停顿引体测试" },
  { label: "双力臂", value: "muscleup", hint: "适合双力臂上升阶段爆发力测试" },
];

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
  const [heightCm, setHeightCm] = useState("175");
  const [weightKg, setWeightKg] = useState("70");
  const [externalLoadKg, setExternalLoadKg] = useState("0");
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [job, setJob] = useState<PowerAnalysisJobDto | null>(null);
  const [llmLoading, setLlmLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const selectedMode = useMemo(
    () => MODE_OPTIONS.find((item) => item.value === mode) || MODE_OPTIONS[0],
    [mode],
  );

  const metrics = job?.metrics || null;
  const formReady =
    Number(heightCm) >= 100 &&
    Number(heightCm) <= 250 &&
    Number(weightKg) >= 30 &&
    Number(weightKg) <= 250 &&
    Number(externalLoadKg) >= 0 &&
    Number(externalLoadKg) <= 250;
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
      showToast({ severity: "warn", summary: "参数不完整", detail: "请先填写有效的身高、体重和额外负重。" });
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
            externalLoadKg: Number(externalLoadKg),
            originalFilename: nextFile.name,
            contentType: nextFile.type || "video/mp4",
            fileSizeBytes: nextFile.size,
          }),
        }),
      );
      setJob(created.job);

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
      a.href = data.proxyUrl || data.url;
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
              <h1 className="text-2xl font-black tracking-tight text-surface-900">功率与速度测试</h1>
              <p className="mt-2 text-sm leading-6 text-surface-600">
                上传引体或双力臂视频，分析完成后可下载带标注的视频。
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
                        mode === item.value
                          ? "border-[#CF6D4E] bg-[#CF6D4E] text-white"
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
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-surface-800">身高 cm</span>
                  <input
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    disabled={settingsLocked}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm outline-none focus:border-[#CF6D4E]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-surface-800">体重 kg</span>
                  <input
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    disabled={settingsLocked}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm outline-none focus:border-[#CF6D4E]"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-surface-800">额外负重 kg</span>
                  <input
                    value={externalLoadKg}
                    onChange={(e) => setExternalLoadKg(e.target.value)}
                    disabled={settingsLocked}
                    inputMode="decimal"
                    className="h-11 w-full rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm outline-none focus:border-[#CF6D4E]"
                  />
                </label>
              </div>

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
                  className="h-11 flex-1 rounded-xl border-[#CF6D4E] bg-[#CF6D4E] text-sm font-black text-white hover:border-[#b85f44] hover:bg-[#b85f44]"
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
                  <div className="text-sm font-semibold text-[#CF6D4E]">{selectedMode.label}</div>
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
                  提交视频后，功率、马力、最大速度和逐次数据会显示在这里。
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                      <div className="text-xs text-surface-500">有效次数</div>
                      <div className="mt-1 text-2xl font-black text-surface-900">{metrics.repCount}</div>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                      <div className="text-xs text-surface-500">最高功率</div>
                      <div className="mt-1 text-2xl font-black text-surface-900">{formatMetric(metrics.summary.bestPowerW, 0)} W</div>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                      <div className="text-xs text-surface-500">最高马力</div>
                      <div className="mt-1 text-2xl font-black text-[#CF6D4E]">{formatMetric(metrics.summary.bestHorsepowerHp, 2)} hp</div>
                    </div>
                    <div className="rounded-xl border border-surface-200 bg-surface-50 p-4">
                      <div className="text-xs text-surface-500">最快速度</div>
                      <div className="mt-1 text-2xl font-black text-surface-900">{formatMetric(metrics.summary.bestVelocityMps, 2)} m/s</div>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-xl border border-surface-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-surface-50 text-left text-xs text-surface-500">
                        <tr>
                          <th className="px-3 py-3">次数</th>
                          <th className="px-3 py-3">位移</th>
                          <th className="px-3 py-3">上升时间</th>
                          <th className="px-3 py-3">功率</th>
                          <th className="px-3 py-3">马力</th>
                          <th className="px-3 py-3">最大速度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.reps.map((rep) => (
                          <tr key={rep.repIndex} className="border-t border-surface-100">
                            <td className="px-3 py-2 font-bold text-surface-900">#{rep.repIndex}</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.displacementM, 2)} m</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.ascentTimeS, 2)} s</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.avgPowerW, 0)} W</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.horsepowerHp, 2)} hp</td>
                            <td className="px-3 py-2 text-surface-700">{formatMetric(rep.maxVelocityMps, 2)} m/s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

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
