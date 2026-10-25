"use client";

import type { PowerAnalysisMetrics } from "@/app/api/toolbox/power-analysis/types";

function format(value: number | undefined, digits = 1) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(digits) : "0";
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, item) => sum + item, 0) / values.length : 0;
}

/** Result tiles and per-rep table for the custom (any movement) mode; no power or rating. */
export default function CustomResult({ metrics }: { metrics: PowerAnalysisMetrics }) {
  const custom = metrics.custom;
  const [first, second] = custom?.phaseLabelsZh ?? ["去程", "回程"];
  const hasJoint = metrics.reps.some((rep) => rep.jointMinDeg !== undefined);
  const tiles = [
    { label: "有效次数", value: String(metrics.repCount), accent: true },
    { label: "平均幅度", value: `${format(average(metrics.reps.map((rep) => rep.displacementM * 100)), 0)} cm`, accent: false },
    { label: `平均${first}`, value: `${format(average(metrics.reps.map((rep) => rep.phase1TimeS ?? 0)))} s`, accent: false },
    { label: `平均${second}`, value: `${format(average(metrics.reps.map((rep) => rep.phase2TimeS ?? 0)))} s`, accent: false },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-surface-200 bg-surface-50 dark:bg-[#2A2622] px-3 py-2 text-xs leading-5 text-surface-600">
        「{custom?.actionNameZh || "其他动作"}」按{custom?.primaryPartZh || "运动最大的部位"}计次
        {custom?.mainJointZh ? `，主要活动关节：${custom.mainJointZh}` : ""}。试验功能，不套用专项标准，不计算功率和评级。
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border border-surface-200 bg-surface-50 dark:bg-[#2A2622] p-4">
            <div className="text-xs text-surface-500">{tile.label}</div>
            <div className={`mt-1 text-2xl font-black ${tile.accent ? "text-[#CF6D4E] dark:text-[#E08A6C]" : "text-surface-900"}`}>
              {tile.value}
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-surface-200">
        <table className="min-w-full text-sm">
          <thead className="bg-surface-50 dark:bg-[#2A2622] text-left text-xs text-surface-500">
            <tr>
              <th className="px-3 py-3">次数</th>
              <th className="px-3 py-3">幅度</th>
              {hasJoint && <th className="px-3 py-3">{custom?.mainJointZh || "关节"}角度</th>}
              <th className="px-3 py-3">{first}</th>
              <th className="px-3 py-3">{second}</th>
              <th className="px-3 py-3">停留</th>
            </tr>
          </thead>
          <tbody>
            {metrics.reps.map((rep) => (
              <tr key={rep.repIndex} className="border-t border-surface-100">
                <td className="px-3 py-2 font-bold text-surface-900">#{rep.repIndex}</td>
                <td className="px-3 py-2 text-surface-700">{format(rep.displacementM * 100, 0)} cm</td>
                {hasJoint && (
                  <td className="px-3 py-2 text-surface-700">
                    {rep.jointMinDeg === undefined ? "-" : `${format(rep.jointMinDeg, 0)}°～${format(rep.jointMaxDeg, 0)}°`}
                  </td>
                )}
                <td className="px-3 py-2 text-surface-700">{format(rep.phase1TimeS, 2)} s</td>
                <td className="px-3 py-2 text-surface-700">{format(rep.phase2TimeS, 2)} s</td>
                <td className="px-3 py-2 text-surface-700">{format(rep.holdTimeS, 2)} s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
