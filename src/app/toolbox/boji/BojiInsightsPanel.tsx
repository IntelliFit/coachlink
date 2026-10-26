'use client';

import { useState } from 'react';
import { Check, Copy, Share2, Swords, UserRound } from 'lucide-react';
import {
  BOJI_DUEL_LIGHTING_TIP,
  BOJI_DUEL_MIXED_TIP,
  bojiDuelHeadline,
  bojiShareTitle,
  type BojiChallengeOutcome,
  type BojiInsights,
} from '@coachlink/core/src/bojiInsights';
import type { BojiSex } from '@coachlink/core/src/bojiDetector';
import { bojiChallengeUrl } from '@/app/service/bojiDetectorService';
import { DuelBars } from './BojiCharts';

function fmt(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

/** 应战完成：你 VS 对方 + 逐项对比条（2026-10-26 改版） */
export function DuelSection({ challenge, myTotal, sex }: { challenge: BojiChallengeOutcome; myTotal: number | null; sex: BojiSex }) {
  const { opponent, duel } = challenge;
  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[32px] bg-[#1E1C1A] px-6 pb-6 pt-8 text-[#F5F2ED]">
        <div className="grid grid-cols-[minmax(0,1fr)_64px_minmax(0,1fr)] items-center">
          <div className="flex flex-col items-center gap-2">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#CF6D4E] text-2xl font-black text-white">我</span>
            <span className="text-sm">你</span>
            <span className="text-5xl font-black tabular-nums text-[#F0A285]">{fmt(myTotal)}</span>
          </div>
          <span className="text-center text-3xl font-black text-[#8A847C]">VS</span>
          <div className="flex flex-col items-center gap-2">
            <OpponentAvatar url={opponent.avatarUrl} name={opponent.nickname} />
            <span className="max-w-full truncate text-sm">{opponent.nickname}</span>
            <span className="text-5xl font-black tabular-nums text-[#C9C2B8]">{fmt(opponent.total)}</span>
          </div>
        </div>
        <div className="mt-5 flex justify-center">
          <span className={`rounded-full px-5 py-2 text-base font-black ${duel.overall === 'win' ? 'bg-[#B4553A] text-white' : 'bg-white/10 text-[#F5F2ED]'}`}>
            {bojiDuelHeadline(duel)}
          </span>
        </div>
      </div>
      <div className="rounded-[32px] border border-slate-200 bg-white p-5 dark:border-[#37312B] dark:bg-[#211E1B] md:p-6">
        <div className="mb-4 flex items-center gap-2 text-base font-black">
          <Swords className="h-4 w-4 text-[#CF6D4E]" />
          逐项对比
        </div>
        <DuelBars duel={duel} sex={sex} />
        <p className="mt-4 rounded-2xl bg-[#F7F4EF] p-3 text-xs leading-5 text-slate-600 dark:bg-[#2A2622] dark:text-[#CBC3B8]">
          {challenge.mixedSex ? `${BOJI_DUEL_MIXED_TIP}${BOJI_DUEL_LIGHTING_TIP}` : BOJI_DUEL_LIGHTING_TIP}
        </p>
      </div>
    </section>
  );
}

/** 身材最像谁 */
export function LookalikeCard({ insights }: { insights: BojiInsights | undefined }) {
  const match = insights?.lookalike;
  if (!match) return null;
  return (
    <div className="flex flex-col gap-3 rounded-[32px] border border-slate-200 bg-white p-5 dark:border-[#37312B] dark:bg-[#211E1B]">
      <div className="flex items-center gap-4">
        {match.photoPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={match.photoPath} alt={match.name} className="h-[72px] w-[72px] shrink-0 rounded-full bg-[#F7F4EF] object-cover" />
        ) : (
          <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-[#CF6D4E] text-3xl font-black text-white">
            {match.name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-[#A0978B]">
            <span>{match.closeness === 'close' ? '你的身材最接近' : '照这个方向练，最可能成为'}</span>
            {match.similarity !== undefined && <span className="font-bold text-[#B4553A] dark:text-[#F0A285]">相似度 {match.similarity}%</span>}
          </div>
          <div className="text-2xl font-black">{match.name}</div>
          <div className="text-sm text-slate-600 dark:text-[#CBC3B8]">{match.tagline}</div>
          <span className="mt-2 inline-block rounded-full bg-[#F6E3DB] px-3 py-0.5 text-xs font-semibold text-[#8F4430] dark:bg-[#3A2820] dark:text-[#F0A285]">
            {match.groupLabel}
          </span>
        </div>
      </div>
      {match.traits && match.traits.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {match.traits.map((trait) => (
            <span key={trait} className="rounded-full bg-[#F7F4EF] px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-[#2A2622] dark:text-[#CBC3B8]">
              {trait}
            </span>
          ))}
        </div>
      )}
      {match.runnerUp && <div className="text-xs text-slate-500 dark:text-[#A0978B]">其次像：{match.runnerUp}</div>}
    </div>
  );
}

/** 邀请好友 PK：系统分享，不支持时复制链接 */
export function InviteCard({ insights, total }: { insights: BojiInsights | undefined; total: number | null }) {
  const [copied, setCopied] = useState(false);
  if (!insights?.scoreId) return null;
  const url = bojiChallengeUrl(insights.scoreId);
  const title = bojiShareTitle(total, insights.percentile);
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator;

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
    <button
      type="button"
      onClick={share}
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B4553A] px-5 text-base font-bold text-white transition hover:opacity-90"
    >
      {copied ? <Check className="h-4 w-4" /> : canShare ? <Share2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? '链接已复制，发给好友吧' : '找好友 PK（对方看不到你的照片）'}
    </button>
  );
}

export function OpponentAvatar({ url, name }: { url: string; name: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="h-16 w-16 rounded-full object-cover" />;
  }
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/15">
      <UserRound className="h-7 w-7" />
    </span>
  );
}
