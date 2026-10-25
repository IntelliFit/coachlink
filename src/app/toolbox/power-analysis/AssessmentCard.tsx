"use client";

import type {
  PowerAnalysisAssessment,
  PowerAnalysisCheckStatus,
  PowerAnalysisMeasurement,
} from "@/app/api/toolbox/power-analysis/types";
import { describeMeasurementZh } from "@/lib/powerAnalysisAssessment";

const STATUS_STYLE: Record<PowerAnalysisCheckStatus, { label: string; chip: string }> = {
  issue: { label: "问题", chip: "border-red-200 dark:border-[#5A2E28] bg-red-50 dark:bg-[#3A2220] text-red-700 dark:text-[#E07A6A]" },
  warn: { label: "注意", chip: "border-amber-200 dark:border-[#5A4626] bg-amber-50 dark:bg-[#3A2E1A] text-amber-700 dark:text-[#E8B866]" },
  info: { label: "信息", chip: "border-sky-200 dark:border-[#2E4250] bg-sky-50 dark:bg-[#1E2A33] text-sky-700 dark:text-[#7DB8E0]" },
  good: { label: "良好", chip: "border-emerald-200 dark:border-[#2E4A3B] bg-emerald-50 dark:bg-[#1F3329] text-emerald-700 dark:text-[#5DBB8E]" },
  unavailable: { label: "无法评估", chip: "border-surface-200 bg-surface-50 dark:bg-[#2A2622] text-surface-500" },
};

interface AssessmentCardProps {
  assessment?: PowerAnalysisAssessment;
  measurement?: PowerAnalysisMeasurement;
  onSeek?: (timeS: number) => void;
}

function formatTime(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

export default function AssessmentCard({ assessment, measurement, onSeek }: AssessmentCardProps) {
  if (!assessment) return null;
  const { counts } = assessment;
  const measurementText = describeMeasurementZh(measurement);

  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-0 dark:bg-[#211E1B] p-5 shadow-sm">
      <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <h2 className="text-lg font-black text-surface-900">动作评估</h2>
        <div className="text-xs text-surface-500">
          机位：{assessment.viewLabelZh}（推荐{assessment.recommendedViewZh}）
        </div>
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
        {(["issue", "warn", "info", "good", "unavailable"] as PowerAnalysisCheckStatus[])
          .filter((status) => status !== "info" || (counts.info ?? 0) > 0)
          .map((status) => (
          <span key={status} className={`rounded-full border px-2.5 py-1 ${STATUS_STYLE[status].chip}`}>
            {STATUS_STYLE[status].label} {counts[status] ?? 0}
          </span>
        ))}
      </div>
      {measurementText && <div className="mb-2 text-xs text-surface-500">{measurementText}</div>}
      {measurement?.warningsZh?.map((warning) => (
        <div key={warning} className="mb-2 rounded-lg border border-amber-200 dark:border-[#5A4626] bg-amber-50 dark:bg-[#3A2E1A] px-3 py-2 text-xs text-amber-800 dark:text-[#E8B866]">
          {warning}
        </div>
      ))}
      {assessment.checks.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-surface-50 dark:bg-[#2A2622] p-4 text-sm text-surface-600">
          没有识别到完整动作，暂时无法评估姿态。
        </div>
      ) : (
        <ul className="divide-y divide-surface-100 rounded-xl border border-surface-200">
          {assessment.checks.map((check, checkIndex) => (
            <li key={`${check.code}-${checkIndex}`} className="flex gap-3 px-3 py-3">
              <span
                className={`mt-0.5 h-fit shrink-0 rounded-full border px-2 py-0.5 text-xs font-bold ${STATUS_STYLE[check.status].chip}`}
              >
                {STATUS_STYLE[check.status].label}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-surface-900">{check.titleZh}</div>
                <div className="mt-0.5 text-sm leading-6 text-surface-600">{check.detailZh}</div>
                {check.timesS.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {check.timesS.map((time, index) => (
                      <button
                        key={`${check.code}-${time}-${index}`}
                        type="button"
                        disabled={!onSeek}
                        onClick={() => onSeek?.(time)}
                        className="rounded-md border border-surface-200 bg-surface-50 dark:bg-[#2A2622] px-2 py-0.5 text-xs text-surface-700 enabled:hover:border-[#CF6D4E] dark:enabled:hover:border-[#E08A6C] enabled:hover:text-[#CF6D4E] dark:enabled:hover:text-[#E08A6C] disabled:cursor-default"
                      >
                        第 {check.repIndexes[index] ?? index + 1} 次 · {formatTime(time)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 text-xs leading-5 text-surface-500">
        评估基于视频关键点自动估算，阈值为通用训练参考，不是比赛判罚或医学诊断。
      </div>
    </div>
  );
}
