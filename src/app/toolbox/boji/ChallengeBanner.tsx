import { Swords } from 'lucide-react';
import {
  BOJI_DUEL_LABELS,
  bojiDuelMetricLabel,
  bojiLookalikeText,
  type BojiChallengeView,
  type BojiMetricScores,
} from '@coachlink/core/src/bojiInsights';
import { BOJI_SEX_LABELS, bojiMetricOrder, type BojiMetricKey } from '@coachlink/core/src/bojiDetector';
import { OpponentAvatar } from './BojiInsightsPanel';

function formatScore(scores: BojiMetricScores, key: BojiMetricKey): string | number {
  const value = scores[key as keyof BojiMetricScores];
  return typeof value === 'number' ? Math.round(value) : '—';
}

/** 打开 PK 链接时：好友看到对手的分数卡；发起人自己看到应战记录。 */
export default function ChallengeBanner({ view }: { view: BojiChallengeView }) {
  const { card, isOwner, responses } = view;
  return (
    <section className="mb-6 rounded-[32px] bg-[#18231F] p-6 text-white md:p-8">
      <div className="flex items-center gap-2 text-xs font-bold text-[#F0C5B7]">
        <Swords className="h-4 w-4" />
        {isOwner ? '你发起的薄肌 PK' : '有人向你发起薄肌 PK'}
      </div>
      <div className="mt-4 flex items-center gap-4">
        <OpponentAvatar url={card.avatarUrl} name={card.nickname} />
        <div className="min-w-0">
          <div className="truncate text-lg font-black">{card.nickname}</div>
          <div className="text-xs text-slate-300">
            {BOJI_SEX_LABELS[card.sex]}
            {card.lookalike ? ` · ${bojiLookalikeText(card.lookalike)}` : ''}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-xs text-slate-400">综合分</div>
          <div className="text-4xl font-black">{card.total === null ? '—' : Math.round(card.total)}</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {bojiMetricOrder(card.sex).map((key) => (
          <div key={key} className="rounded-2xl bg-white/10 px-3 py-2">
            <div className="text-xs text-slate-300">{bojiDuelMetricLabel(key, card.sex)}</div>
            <div className="text-xl font-black">{formatScore(card.scores, key)}</div>
          </div>
        ))}
      </div>
      {isOwner ? (
        <div className="mt-5">
          <div className="text-sm font-bold">应战记录</div>
          {responses.length === 0 ? (
            <p className="mt-2 text-xs text-slate-300">还没有人应战，把链接发给好友吧。</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/10">
              {responses.map((r, index) => (
                <li key={`${r.createdAt}-${index}`} className="flex items-center gap-3 py-2 text-sm">
                  <span className="truncate">{r.nickname}</span>
                  <span className="ml-auto text-slate-300">{r.total === null ? '—' : Math.round(r.total)} 分</span>
                  <span className="w-14 text-right font-bold text-[#F0C5B7]">你{BOJI_DUEL_LABELS[r.overall]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-300">上传你的正面照，测完自动和 TA 逐项比输赢。对方看不到你的照片。</p>
      )}
    </section>
  );
}
