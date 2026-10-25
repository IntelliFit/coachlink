"use client";

import { useMemo, useState } from "react";
import type { PowerAnalysisTimeSeriesPoint } from "@/app/api/toolbox/power-analysis/types";

type CurveMetric = "velocityMps" | "powerW" | "displacementM";

const METRICS: Array<{ key: CurveMetric; label: string; unit: string; color: string; peakLabel: string }> = [
  { key: "velocityMps", label: "速度", unit: "m/s", color: "#2563EB", peakLabel: "瞬时峰值" },
  { key: "powerW", label: "功率", unit: "W", color: "#D97706", peakLabel: "瞬时峰值" },
  // Displacement is measured from each rep's start, so the curve rises once per rep.
  { key: "displacementM", label: "位移", unit: "m", color: "#059669", peakLabel: "最大位移" },
];

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { left: 52, right: 16, top: 16, bottom: 30 };

function formatValue(value: number) {
  return value >= 100 ? value.toFixed(0) : value.toFixed(2);
}

export default function PowerCurves({ points }: { points?: PowerAnalysisTimeSeriesPoint[] }) {
  const [metric, setMetric] = useState<CurveMetric>("velocityMps");
  const config = METRICS.find((item) => item.key === metric) ?? METRICS[0];

  const chart = useMemo(() => {
    const valid = (points ?? []).filter(
      (point) => Number.isFinite(point.timeS) && Number.isFinite(point[metric]),
    );
    if (valid.length < 2) return null;
    const maxTime = Math.max(valid[valid.length - 1].timeS, 1);
    const peak = Math.max(...valid.map((point) => Math.max(0, point[metric])), 0);
    const maxValue = Math.max(peak, metric === "powerW" ? 1 : 0.01) * 1.08;
    const plotWidth = WIDTH - PAD.left - PAD.right;
    const plotHeight = HEIGHT - PAD.top - PAD.bottom;
    const path = valid
      .map((point, index) => {
        const x = PAD.left + (Math.max(0, point.timeS) / maxTime) * plotWidth;
        const y = PAD.top + plotHeight - (Math.max(0, point[metric]) / maxValue) * plotHeight;
        return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const grid = [0, 1, 2, 3, 4].map((step) => ({
      y: PAD.top + (plotHeight * step) / 4,
      label: formatValue(maxValue * (1 - step / 4)),
    }));
    return { path, grid, maxTime, peak };
  }, [metric, points]);

  if (!points || points.length < 2) return null;

  return (
    <div className="rounded-xl border border-surface-200 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-black text-surface-900">整段行程曲线</div>
          <div className="text-xs text-surface-500">覆盖完整视频时间轴</div>
        </div>
        <div className="flex gap-1 rounded-lg bg-surface-100 p-1">
          {METRICS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMetric(item.key)}
              className={[
                "rounded-md px-3 py-1 text-xs font-bold transition-colors",
                metric === item.key ? "bg-surface-0 dark:bg-[#211E1B] text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {chart ? (
        <>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="h-auto w-full"
            role="img"
            aria-label={`${config.label}曲线`}
          >
            {chart.grid.map((line) => (
              <g key={line.y}>
                <line x1={PAD.left} x2={WIDTH - PAD.right} y1={line.y} y2={line.y} strokeWidth={1} className="stroke-[#E5E7EB] dark:stroke-[#37312B]" />
                <text x={PAD.left - 6} y={line.y + 4} textAnchor="end" fontSize={11} fill="#9CA3AF">
                  {line.label}
                </text>
              </g>
            ))}
            <path d={chart.path} fill="none" stroke={config.color} strokeWidth={2.5} strokeLinejoin="round" />
            <text x={PAD.left} y={HEIGHT - 8} fontSize={11} fill="#9CA3AF">0s</text>
            <text x={WIDTH - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="#9CA3AF">
              {chart.maxTime.toFixed(1)}s
            </text>
          </svg>
          <div className="mt-1 text-xs text-surface-500">
            {config.peakLabel} {formatValue(chart.peak)} {config.unit}
          </div>
        </>
      ) : (
        <div className="text-sm text-surface-500">这项数据不足，无法画出曲线。</div>
      )}
    </div>
  );
}
