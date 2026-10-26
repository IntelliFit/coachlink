import type { BojiSex } from '@coachlink/core/src/bojiDetector';
import { bojiStrengths } from '@coachlink/core/src/bojiDisplay';
import type { BojiMetricScores, BojiPercentile } from '@coachlink/core/src/bojiInsights';
import { ScoreRing } from './BojiCharts';

/** 结果页第一屏：环形综合分 + 超越比例 + 长板短板（2026-10-26 改版） */
export default function ResultHero({
  total,
  percentile,
  scores,
  sex,
  packCount,
}: {
  total: number | null;
  percentile: BojiPercentile | null;
  scores: BojiMetricScores;
  sex: BojiSex;
  packCount: number | null;
}) {
  const strengths = bojiStrengths(scores, sex);
  const chips: string[] = [];
  if (strengths) {
    chips.push(`长板 · ${strengths.best.label} ${strengths.best.score}`);
    chips.push(`短板 · ${strengths.weakest.label} ${strengths.weakest.score}`);
  }
  if (sex === 'male' && packCount !== null && packCount > 0) chips.push(`腹肌 ${packCount} 块`);

  return (
    <section className="flex flex-col gap-4 rounded-[32px] bg-[#1E1C1A] p-6 text-[#F5F2ED] md:p-8">
      <div className="flex items-center gap-6">
        <ScoreRing total={total} />
        <div className="flex flex-col">
          <span className="text-sm text-[#C9C2B8]">{sex === 'female' ? '你的线条' : '你的薄肌'}</span>
          {percentile ? (
            <>
              <span className="mt-1 text-lg font-black">超越了约</span>
              <span className="text-5xl font-black leading-none tabular-nums text-[#F0A285]">{percentile.value}%</span>
              <span className="text-lg font-black">的人</span>
            </>
          ) : (
            <span className="mt-1 text-sm leading-6 text-[#C9C2B8]">
              {total === null ? '这张照片能测的项目太少，不给综合分。按拍摄建议换一张再试。' : '综合分'}
            </span>
          )}
        </div>
      </div>
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-[#3A3631] px-3 py-1 text-xs">
              {chip}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
