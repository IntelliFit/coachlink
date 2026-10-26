'use client';

import { useState } from 'react';
import { Check, Copy, Share2, Swords, UserRound } from 'lucide-react';
import {
  BOJI_DUEL_LABELS,
  BOJI_DUEL_LIGHTING_TIP,
  BOJI_DUEL_METRIC_LABELS,
  bojiDuelHeadline,
  bojiLookalikeText,
  bojiShareTitle,
  type BojiInsights,
} from '@coachlink/core/src/bojiInsights';
import { bojiChallengeUrl } from '@/app/service/bojiDetectorService';

const OUTCOME_CLASS = {
  win: 'bg-[#3F7C6B]/10 text-[#2F6B5B]',
  lose: 'bg-[#CF6D4E]/10 text-[#B4553A]',
  tie: 'bg-slate-100 text-slate-600',
} as const;

function LookalikeCard({ insights }: { insights: BojiInsights }) {
  const match = insights.lookalike;
  if (!match) return null;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-500">
        <span>{match.groupLabel}</span>
        {match.similarity !== undefined && <span className="text-[#CF6D4E]">相似度 {match.similarity}%</span>}
      </div>
      <div className="mt-1 text-lg font-black text-slate-950">{bojiLookalikeText(match)}</div>
      <div className="mt-1 text-sm text-slate-600">{match.tagline}</div>
      {match.traits && match.traits.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {match.traits.map((trait) => (
            <span key={trait} className="rounded-full bg-[#F7F4EF] px-3 py-1 text-xs font-semibold text-slate-700">
              {trait}
            </span>
          ))}
        </div>
      )}
      {match.runnerUp && <div className="mt-3 text-xs text-slate-500">其次像：{match.runnerUp}</div>}
    </div>
  );
}

function DuelCard({ insights }: { insights: BojiInsights }) {
  const challenge = insights.challenge;
  if (!challenge) return null;
  const { opponent, duel } = challenge;
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <Swords className="h-4 w-4 text-[#CF6D4E]" />
        和 {opponent.nickname} 的 PK
      </div>
      <div className="mt-2 text-xl font-black text-slate-950">{bojiDuelHeadline(duel)}</div>
      <div className="mt-4 grid grid-cols-[1fr_auto_auto_auto] items-center gap-x-4 gap-y-2 text-sm">
        <span className="text-xs text-slate-400">项目</span>
        <span className="text-right text-xs text-slate-400">你</span>
        <span className="text-right text-xs text-slate-400">TA</span>
        <span />
        {duel.lines.map((line) => (
          <div key={line.key} className="contents">
            <span className="font-semibold text-slate-700">{BOJI_DUEL_METRIC_LABELS[line.key]}</span>
            <span className="text-right font-black text-slate-950">{line.mine === null ? '—' : Math.round(line.mine)}</span>
            <span className="text-right text-slate-600">{line.theirs === null ? '—' : Math.round(line.theirs)}</span>
            <span className={`rounded-full px-2 py-0.5 text-center text-xs font-bold ${line.outcome ? OUTCOME_CLASS[line.outcome] : 'text-slate-400'}`}>
              {line.outcome ? BOJI_DUEL_LABELS[line.outcome] : '不计'}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">{BOJI_DUEL_LIGHTING_TIP}</p>
    </div>
  );
}

function InviteCard({ insights, total }: { insights: BojiInsights; total: number | null }) {
  const [copied, setCopied] = useState(false);
  if (!insights.scoreId) return null;
  const url = bojiChallengeUrl(insights.scoreId);
  const title = bojiShareTitle(total, insights.percentile);

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text: title, url });
        return;
      } catch {
        // 用户取消或浏览器拒绝时退回复制链接
      }
    }
    try {
      await navigator.clipboard.writeText(`${title} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('复制这个链接发给好友', url);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="text-sm font-black text-slate-950">叫上好友 PK 薄肌</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        好友打开链接自己测一次，就能逐项比出输赢。对方只会看到你的昵称和分数，看不到照片。
      </p>
      <button
        type="button"
        onClick={share}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#CF6D4E] px-5 text-sm font-bold text-white transition hover:opacity-90"
      >
        {copied ? <Check className="h-4 w-4" /> : typeof navigator !== 'undefined' && 'share' in navigator ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? '链接已复制' : '邀请好友 PK'}
      </button>
    </div>
  );
}

/** 检测结果下方：最像谁、PK 结果、邀请好友 */
export default function BojiInsightsPanel({ insights, total }: { insights: BojiInsights | undefined; total: number | null }) {
  if (!insights) return null;
  return (
    <>
      <DuelCard insights={insights} />
      <LookalikeCard insights={insights} />
      <InviteCard insights={insights} total={total} />
    </>
  );
}

export function OpponentAvatar({ url, name }: { url: string; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-12 w-12 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15">
      <UserRound className="h-6 w-6" />
    </span>
  );
}
