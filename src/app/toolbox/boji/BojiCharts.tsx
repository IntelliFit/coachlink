import type { BojiSex } from '@coachlink/core/src/bojiDetector';
import { bojiRadarAxes, bojiRingArc, bojiShortMetricLabel } from '@coachlink/core/src/bojiDisplay';
import type { BojiDuel, BojiMetricScores } from '@coachlink/core/src/bojiInsights';

/** 薄肌检测器改版（2026-10-26）：环形综合分、四项雷达图、PK 逐项对比条。 */

export function ScoreRing({ total, size = 136 }: { total: number | null; size?: number }) {
  const stroke = 12;
  const r = size / 2 - stroke / 2;
  const { filled, circumference } = bojiRingArc(total, r);
  const label = total === null ? '没有综合分' : `综合分 ${Math.round(total)} 分，满分 100`;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#3A3631" strokeWidth={stroke} />
        {filled > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#CF6D4E"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-black leading-none tabular-nums">{total === null ? '—' : Math.round(total)}</span>
        <span className="mt-1 text-[11px] text-[#C9C2B8]">综合分</span>
      </div>
    </div>
  );
}

export function RadarChart({ scores, sex }: { scores: BojiMetricScores; sex: BojiSex }) {
  const cx = 130;
  const cy = 130;
  const radius = 100;
  const grid = [1, 0.75, 0.5, 0.25].map((level) =>
    bojiRadarAxes({ abs: 100 * level, v_taper: 100 * level, arms: 100 * level, symmetry: 100 * level, waist_hip: 100 * level }, cx, cy, radius, sex)
      .map((a) => a.point.join(','))
      .join(' '),
  );
  const axes = bojiRadarAxes(scores, cx, cy, radius, sex);
  const shape = axes.map((a) => a.point.join(',')).join(' ');
  const summary = axes.map((a) => `${a.label} ${a.score ?? '测不了'}`).join('，');
  return (
    <svg viewBox="-60 -24 380 308" className="mx-auto w-full max-w-[340px]" role="img" aria-label={`雷达图：${summary}`}>
      {grid.map((points) => (
        <polygon key={points} points={points} fill="none" className="stroke-[#E7E1D7] dark:stroke-white/10" strokeWidth={1} />
      ))}
      <line x1={cx} y1={cy - radius} x2={cx} y2={cy + radius} className="stroke-[#E7E1D7] dark:stroke-white/10" strokeWidth={1} />
      <line x1={cx - radius} y1={cy} x2={cx + radius} y2={cy} className="stroke-[#E7E1D7] dark:stroke-white/10" strokeWidth={1} />
      <polygon points={shape} fill="#CF6D4E" fillOpacity={0.22} stroke="#B4553A" strokeWidth={2.5} strokeLinejoin="round" />
      {axes.map((a) => {
        const [ex, ey] = a.end;
        const anchor = ex > cx + 1 ? 'start' : ex < cx - 1 ? 'end' : 'middle';
        const dx = ex > cx + 1 ? 10 : ex < cx - 1 ? -10 : 0;
        const dy = ey < cy - 1 ? -10 : ey > cy + 1 ? 22 : 5;
        return (
          <g key={a.key}>
            <circle cx={a.point[0]} cy={a.point[1]} r={4} fill="#B4553A" />
            <text x={ex + dx} y={ey + dy} textAnchor={anchor} fontSize={13} fontWeight={700} className="fill-slate-900 dark:fill-slate-100">
              {a.label} {a.score ?? '—'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** 左边是你、右边是对方，赢的一边高亮（你：陶土色，对方：绿色） */
export function DuelBars({ duel, sex }: { duel: BojiDuel; sex: BojiSex }) {
  return (
    <div className="flex flex-col gap-4">
      {duel.lines.map((line) => {
        const mineWins = line.outcome === 'win';
        const theirsWin = line.outcome === 'lose';
        const label = bojiShortMetricLabel(line.key, sex);
        return (
          <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center gap-2">
            <div className="flex items-center justify-end gap-2">
              <span className={`w-8 text-center text-xl font-black tabular-nums ${mineWins ? 'text-[#B4553A]' : 'text-slate-500'}`}>
                {line.mine === null ? '—' : Math.round(line.mine)}
              </span>
              <div className="flex h-3 flex-1 justify-end">
                <div
                  className={`h-3 rounded-full ${mineWins ? 'bg-[#CF6D4E]' : 'bg-slate-200 dark:bg-white/15'}`}
                  style={{ width: `${Math.min(100, Math.max(0, line.mine ?? 0))}%` }}
                />
              </div>
            </div>
            <span className="text-center text-sm font-semibold">{label}</span>
            <div className="flex items-center gap-2">
              <div className="flex h-3 flex-1">
                <div
                  className={`h-3 rounded-full ${theirsWin ? 'bg-[#3F7C6B]' : 'bg-slate-200 dark:bg-white/15'}`}
                  style={{ width: `${Math.min(100, Math.max(0, line.theirs ?? 0))}%` }}
                />
              </div>
              <span className={`w-8 text-center text-xl font-black tabular-nums ${theirsWin ? 'text-[#2F6B5B]' : 'text-slate-500'}`}>
                {line.theirs === null ? '—' : Math.round(line.theirs)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
