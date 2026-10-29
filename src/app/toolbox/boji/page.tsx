'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLoginModal } from '@/components/auth/LoginModalContext';
import { ArrowLeft, Camera, ChevronDown, Eye, EyeOff, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import {
  BOJI_FEMALE_HEALTH_NOTE,
  BOJI_SEX_LABELS,
  bojiPhotoTips,
  bojiReportSex,
  isBojiSex,
  type BojiSex,
  bojiMetricCards,
  bojiQualityNotes,
  bojiTotalScore,
  type BojiAnalysisDto,
} from '@coachlink/core/src/bojiDetector';
import { bojiStrengths, bojiTrainingTip } from '@coachlink/core/src/bojiDisplay';
import { bojiScoreSnapshot, type BojiChallengeView } from '@coachlink/core/src/bojiInsights';
import {
  analyzeBojiPhoto,
  BojiRequestError,
  fetchBojiChallenge,
  preparePhoto,
  type PreparedPhoto,
} from '@/app/service/bojiDetectorService';
import { RadarChart } from './BojiCharts';
import { DuelSection, InviteCard, LookalikeCard } from './BojiInsightsPanel';
import BojiOverlay from './BojiOverlay';
import ChallengeBanner from './ChallengeBanner';
import { overlayLegend } from './overlayLegend';
import MetricCard from './MetricCard';
import ResultHero from './ResultHero';

type Phase = 'idle' | 'working' | 'done' | 'error';

const SEX_STORAGE_KEY = 'coachlink.boji.sex';
const SEXES: BojiSex[] = ['male', 'female'];

const HEADLINES: Record<BojiSex, { title: string; desc: string }> = {
  male: {
    title: '一张正面照，测出你的薄肌等级',
    desc: '量腹肌分块、倒三角、手臂和左右对称，看看你超越了多少人、身材最像哪位明星，再拉好友 PK。',
  },
  female: {
    title: '一张正面照，测出你的马甲线和曲线',
    desc: '量马甲线、腰臀比、肩腰比和左右对称，看看你超越了多少人、身材最像哪位明星，再拉闺蜜 PK。',
  },
};

const METHOD_TEXT: Record<BojiSex, string> = {
  male: '先用 MediaPipe 找到关节和人体轮廓，再量轮廓宽度（倒三角、手臂、对称），最后在腹部找腹白线和每条横沟，逐块计算被沟围住的比例。腹肌数值依赖阴影：同一个人，光越柔和数值越低，所以前后对比请用同一地点和光线。',
  female: '先用 MediaPipe 找到关节和人体轮廓，量出最窄腰宽和髋部最宽处（腰臀比）、肩宽（肩腰比）和左右对称；马甲线不数块，只看腹白线和腹部两侧竖线有多清楚。线条数值依赖阴影：光越柔和数值越低，前后对比请用同一地点和光线。',
};

const CARD = 'rounded-[32px] border border-slate-200 bg-white dark:border-[#37312B] dark:bg-[#211E1B]';
const SECONDARY_BTN =
  'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-300 hover:text-slate-950 dark:border-[#37312B] dark:bg-[#211E1B] dark:text-[#CBC3B8] dark:hover:text-[#F2EEE8]';

function readStoredSex(): BojiSex {
  try {
    const value = window.localStorage.getItem(SEX_STORAGE_KEY);
    return isBojiSex(value) ? value : 'male';
  } catch {
    return 'male';
  }
}

export default function BojiDetectorPage() {
  const router = useRouter();
  const { status: sessionStatus } = useSession();
  const { openLoginModal } = useLoginModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [analysis, setAnalysis] = useState<BojiAnalysisDto | null>(null);
  const [error, setError] = useState<{ message: string; needsLogin: boolean } | null>(null);
  const [showMarks, setShowMarks] = useState(true);
  const [showTips, setShowTips] = useState(false);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<BojiChallengeView | null>(null);
  const [sex, setSex] = useState<BojiSex>('male');

  useEffect(() => {
    setSex(readStoredSex());
  }, []);

  const chooseSex = (next: BojiSex) => {
    setSex(next);
    try {
      window.localStorage.setItem(SEX_STORAGE_KEY, next);
    } catch {
      // 存不了只影响下次默认值
    }
  };

  // PK 链接 ?challenge=<成绩 id>：不用 useSearchParams，免得整页失去静态渲染
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('challenge');
    if (!id) return;
    setChallengeId(id);
    fetchBojiChallenge(id)
      .then(setChallenge)
      .catch(() => setChallenge(null));
  }, [sessionStatus]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const cards = useMemo(() => (analysis ? bojiMetricCards(analysis) : []), [analysis]);
  const snapshot = useMemo(() => (analysis ? bojiScoreSnapshot(analysis.report) : null), [analysis]);
  const total = analysis ? bojiTotalScore(analysis) : null;
  const notes = analysis ? bojiQualityNotes(analysis) : [];
  const resultSex = analysis ? bojiReportSex(analysis.report) : sex;
  const loggedOut = sessionStatus === 'unauthenticated';
  const strengths = snapshot ? bojiStrengths(snapshot.scores, snapshot.sex) : null;
  const copy = HEADLINES[sex];

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setAnalysis(null);
    setPhase('working');
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      // 自己打开自己的 PK 链接时不算应战
      setAnalysis(await analyzeBojiPhoto(prepared.blob, challenge?.isOwner ? null : challengeId, sex));
      setPhase('done');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const status = err instanceof BojiRequestError ? err.status : 0;
      setError({
        message: err instanceof Error ? err.message : '检测失败，请稍后再试',
        needsLogin: status === 401,
      });
      setPhase('error');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const uploadButton =
    phase === 'working' ? (
      <div className="flex h-12 items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-[#CBC3B8]">
        <Loader2 className="h-5 w-5 animate-spin text-[#CF6D4E]" />
        正在检测，通常几秒钟…
      </div>
    ) : loggedOut ? (
      <button
        type="button"
        onClick={openLoginModal}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B4553A] px-6 text-base font-bold text-white transition hover:opacity-90"
      >
        <LogIn className="h-4 w-4" />
        登录后测测我的薄肌
      </button>
    ) : (
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#B4553A] px-6 text-base font-bold text-white transition hover:opacity-90"
      >
        <Camera className="h-4 w-4" />
        {analysis ? '换一张照片再测' : '选一张正面照，测测我的薄肌'}
      </button>
    );

  const errorBox = error && (
    <div className="rounded-2xl border border-[#CF6D4E]/20 bg-[#FFF7F3] p-4 text-sm text-slate-700 dark:bg-[#3A2820] dark:text-[#CBC3B8]">
      {error.message}
      {error.needsLogin && (
        <button type="button" onClick={openLoginModal} className="ml-2 font-bold text-[#CF6D4E] underline-offset-2 hover:underline">
          去登录
        </button>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-slate-950 dark:bg-[#161412] dark:text-[#F2EEE8]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 md:px-8 md:py-12">
        <button type="button" onClick={() => router.push('/toolbox')} className={`${SECONDARY_BTN} w-fit rounded-full`}>
          <ArrowLeft className="h-4 w-4" />
          返回工具箱
        </button>

        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFile(event.target.files?.[0])} />

        {challenge && !analysis && <ChallengeBanner view={challenge} />}

        {!analysis || !snapshot ? (
          <section className="grid gap-6 md:grid-cols-[1fr_1fr] md:items-center">
            {/* 男女同框示例图，图上已有「男生 · 腹肌」「女生 · 腰臀比」标签 */}
            <div className="relative overflow-hidden rounded-[32px] bg-[#1E1C1A]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/boji/sample-result.webp"
                alt="示例：检测器在正面照上标出肩线、腰线、臀线和腹肌分块"
                className="aspect-[4/3] w-full object-cover"
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-[#1E1C1A]/75 px-3 py-1 text-xs text-[#F5F2ED]">示例结果</span>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">{copy.title}</h1>
                <p className="mt-3 text-sm leading-7 text-slate-600 dark:text-[#CBC3B8] md:text-base">{copy.desc}</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {['超越比例', '明星同款', '好友 PK'].map((name) => (
                  <span key={name} className={`${CARD} rounded-2xl py-3 text-center text-sm font-semibold text-[#B4553A] dark:text-[#F0A285]`}>{name}</span>
                ))}
              </div>
              <div className="inline-flex w-fit rounded-full border border-slate-200 p-1 dark:border-[#37312B]" role="radiogroup" aria-label="打分标准">
                {SEXES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={sex === option}
                    disabled={phase === 'working'}
                    onClick={() => chooseSex(option)}
                    className={`h-9 rounded-full px-5 text-sm font-bold transition ${
                      sex === option
                        ? 'bg-slate-900 text-white dark:bg-[#F2EEE8] dark:text-[#161412]'
                        : 'text-slate-600 hover:text-slate-950 dark:text-[#CBC3B8] dark:hover:text-[#F2EEE8]'
                    }`}
                  >
                    {BOJI_SEX_LABELS[option]}
                  </button>
                ))}
              </div>
              {uploadButton}
              {errorBox}
            </div>
          </section>
        ) : (
          <>
            {analysis.insights?.challenge && (
              <DuelSection challenge={analysis.insights.challenge} myTotal={total} sex={resultSex} />
            )}
            <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
              <div className="flex flex-col gap-4">
                <ResultHero
                  total={total}
                  percentile={analysis.insights?.percentile ?? null}
                  scores={snapshot.scores}
                  sex={resultSex}
                  packCount={snapshot.absPackCount}
                />
                {resultSex === 'female' && (
                  <p className="rounded-2xl bg-[#EFEAE2] p-3 text-xs leading-5 text-slate-700 dark:bg-[#2A2622] dark:text-[#CBC3B8]">{BOJI_FEMALE_HEALTH_NOTE}</p>
                )}
                <LookalikeCard insights={analysis.insights} />
                <InviteCard insights={analysis.insights} total={total} />
                <div className={`${CARD} p-5 md:p-6`}>
                  <div className="text-base font-black">{resultSex === 'female' ? '四项线条' : '四项得分'}</div>
                  <RadarChart scores={snapshot.scores} sex={resultSex} />
                  {strengths && <p className="text-sm leading-6 text-slate-600 dark:text-[#CBC3B8]">{bojiTrainingTip(strengths, resultSex)}</p>}
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className={`${CARD} p-4 md:p-6`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-base font-black">测量位置</div>
                    <button type="button" onClick={() => setShowMarks((v) => !v)} className={`${SECONDARY_BTN} h-9 rounded-full px-3 text-xs`}>
                      {showMarks ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showMarks ? '隐藏标注' : '显示标注'}
                    </button>
                  </div>
                  {photo && (
                    <BojiOverlay photoUrl={photo.url} width={photo.width} height={photo.height} report={analysis.report} showMarks={showMarks} />
                  )}
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-[#CBC3B8]">
                    {overlayLegend(resultSex).map((item) => (
                      <span key={item.label} className="inline-flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>

                <details className={`${CARD} group p-5`}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="text-base font-semibold">查看详细数据</span>
                    <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 flex flex-col gap-4">
                    {notes.length > 0 && (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800 dark:border-[#5A4626] dark:bg-[#3A2E1A] dark:text-[#E8B866]">
                        {notes.map((note) => (
                          <div key={note}>· {note}</div>
                        ))}
                      </div>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {cards.map((card) => (
                        <MetricCard key={card.key} card={card} />
                      ))}
                    </div>
                  </div>
                </details>

                {uploadButton}
                {errorBox}
              </div>
            </section>
          </>
        )}

        <section className={`${CARD} p-5 text-sm leading-7 text-slate-600 dark:text-[#CBC3B8] md:p-6`}>
          <button type="button" onClick={() => setShowTips((v) => !v)} className="flex w-full items-center justify-between text-base font-black text-slate-950 dark:text-[#F2EEE8]">
            怎么拍更准 · 它是怎么测的
            <ChevronDown className={`h-4 w-4 transition ${showTips ? 'rotate-180' : ''}`} />
          </button>
          {showTips && (
            <div className="mt-3 flex flex-col gap-3">
              <ul className="space-y-2">
                {bojiPhotoTips(analysis ? resultSex : sex).map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CF6D4E]" />
                    {tip}
                  </li>
                ))}
              </ul>
              <p>{METHOD_TEXT[analysis ? resultSex : sex]}</p>
              <p>
                算法开源：
                <a href="https://github.com/SmallHorseBrother/boji-detector" target="_blank" rel="noreferrer" className="font-semibold text-[#CF6D4E] hover:underline">
                  boji-detector
                </a>
                。
              </p>
            </div>
          )}
        </section>

        <div className="flex flex-col items-center gap-1 text-center text-xs leading-5 text-slate-500 dark:text-[#A0978B]">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-[#3F7C6B]" />
            照片只用于这一次检测，不保存；腹部区域可能交给 AI 模型复核腹肌（不含脸，也不保存）；只记录分数，用于排名和 PK。
          </span>
          {analysis && <span>测试版：分数供自测和好友 PK 娱乐，不是医疗诊断。</span>}
          {analysis?.insights?.lookalike?.photoCredit && (
            <span className="text-slate-400">
              人物照片：{analysis.insights.lookalike.name}，{analysis.insights.lookalike.photoCredit}
            </span>
          )}
        </div>
      </div>
    </main>
  );
}
