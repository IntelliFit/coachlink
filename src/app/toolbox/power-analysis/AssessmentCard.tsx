"use client";

import type {
  PowerAnalysisAssessment,
  PowerAnalysisCheckStatus,
  PowerAnalysisMeasurement,
} from "@/app/api/toolbox/power-analysis/types";
import { describeMeasurementZh } from "@/lib/powerAnalysisAssessment";

const STATUS_STYLE: Record<PowerAnalysisCheckStatus, { label: string; chip: string }> = {
  issue: { label: "问题", chip: "border-red-200 bg-red-50 text-red-700" },
  warn: { label: "注意", chip: "border-amber-200 bg-amber-50 text-amber-700" },
  info: { label: "信息", chip: "border-sky-200 bg-sky-50 text-sky-700" },
  good: { label: "良好", chip: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  unavailable: { label: "无法评估", chip: "border-surface-200 bg-surface-50 text-surface-500" },
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
    <div className="rounded-2xl border border-surface-200 bg-surface-0 p-5 shadow-sm">
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
        <div key={warning} className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {warning}
        </div>
      ))}
      {assessment.checks.length === 0 ? (
        <div className="rounded-xl border border-surface-200 bg-surface-50 p-4 text-sm text-surface-600">
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
                        className="rounded-md border border-surface-200 bg-surface-50 px-2 py-0.5 text-xs text-surface-700 enabled:hover:border-[#CF6D4E] enabled:hover:text-[#CF6D4E] disabled:cursor-default"
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
