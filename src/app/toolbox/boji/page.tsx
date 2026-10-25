'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useLoginModal } from '@/components/auth/LoginModalContext';
import { ArrowLeft, Camera, Eye, EyeOff, Loader2, LogIn, RotateCcw, ShieldCheck, Sparkles } from 'lucide-react';
import {
  BOJI_PHOTO_TIPS,
  bojiMetricCards,
  bojiQualityNotes,
  bojiTotalScore,
  type BojiAnalysisDto,
} from '@coachlink/core/src/bojiDetector';
import { bojiPercentileText, type BojiChallengeView } from '@coachlink/core/src/bojiInsights';
import {
  analyzeBojiPhoto,
  BojiRequestError,
  fetchBojiChallenge,
  preparePhoto,
  type PreparedPhoto,
} from '@/app/service/bojiDetectorService';
import BojiInsightsPanel from './BojiInsightsPanel';
import BojiOverlay from './BojiOverlay';
import ChallengeBanner from './ChallengeBanner';
import { OVERLAY_LEGEND } from './overlayLegend';
import MetricCard from './MetricCard';

type Phase = 'idle' | 'working' | 'done' | 'error';

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
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<BojiChallengeView | null>(null);

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
  const total = analysis ? bojiTotalScore(analysis) : null;
  const notes = analysis ? bojiQualityNotes(analysis) : [];
  const loggedOut = sessionStatus === 'unauthenticated';

  const reset = () => {
    setPhoto(null);
    setAnalysis(null);
    setError(null);
    setPhase('idle');
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setAnalysis(null);
    setPhase('working');
    try {
      const prepared = await preparePhoto(file);
      setPhoto(prepared);
      // 自己打开自己的 PK 链接时不算应战
      setAnalysis(await analyzeBojiPhoto(prepared.blob, challenge?.isOwner ? null : challengeId));
      setPhase('done');
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

  return (
    <main className="min-h-screen bg-[#F7F4EF] dark:bg-[#161412] text-slate-950 dark:text-[#F2EEE8]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-16">
        <button
          type="button"
          onClick={() => router.push('/toolbox')}
          className="mb-8 inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] px-4 text-sm font-semibold text-slate-700 dark:text-[#CBC3B8] transition hover:border-slate-300 dark:hover:border-[#4A423A] hover:text-slate-950 dark:hover:text-[#F2EEE8]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回工具箱
        </button>

        {challenge && <ChallengeBanner view={challenge} />}

        <section className="overflow-hidden rounded-[32px] border border-slate-200 dark:border-[#37312B] bg-[#18231F] text-white shadow-[0_24px_80px_rgba(24,35,31,0.14)]">
          <div className="grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-12">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold tracking-wide text-[#F0C5B7]">
                  <Sparkles className="h-4 w-4" />
                  测试版 · 照片不保存
                </div>
                <h1 className="text-3xl font-black leading-tight tracking-tight md:text-5xl">薄肌检测器</h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
                  上传一张正面照，量出腹肌分块、倒三角、手臂围度和左右对称。每个数字都会在照片上标出是在哪里量的。
                </p>
              </div>
              <div>
                <div className="mb-3 text-xs font-bold text-[#F0C5B7]">拍摄建议</div>
                <ul className="space-y-2 text-sm leading-6 text-slate-300">
                  {BOJI_PHOTO_TIPS.map((tip) => (
                    <li key={tip} className="flex gap-2">
                      <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CF6D4E]" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-3xl bg-white dark:bg-[#211E1B] p-5 text-slate-950 dark:text-[#F2EEE8] md:p-8">
              <div>
                <div className="text-lg font-black">上传正面照</div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-[#A0978B]">
                  JPG / PNG 均可，会先在你的浏览器里压缩再上传。
                </div>
              </div>

              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />

              <div className="my-8 flex flex-col items-center gap-4 text-center">
                {phase === 'working' ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-[#CF6D4E] dark:text-[#E08A6C]" />
                    <div className="text-sm font-semibold text-slate-600 dark:text-[#CBC3B8]">正在检测，通常几秒钟…</div>
                  </>
                ) : loggedOut ? (
                  <button
                    type="button"
                    onClick={openLoginModal}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-[#CF6D4E] px-6 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    <LogIn className="h-4 w-4" />
                    登录后检测
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="inline-flex h-12 items-center gap-2 rounded-full bg-[#CF6D4E] px-6 text-sm font-bold text-white transition hover:opacity-90"
                  >
                    <Camera className="h-4 w-4" />
                    {phase === 'done' ? '换一张照片' : '选择照片'}
                  </button>
                )}
                {error && (
                  <div className="w-full rounded-2xl border border-[#CF6D4E]/20 bg-[#FFF7F3] dark:bg-[#3A2820] p-4 text-sm text-slate-700 dark:text-[#CBC3B8]">
                    {error.message}
                    {error.needsLogin && (
                      <button
                        type="button"
                        onClick={openLoginModal}
                        className="ml-2 font-bold text-[#CF6D4E] dark:text-[#E08A6C] underline-offset-2 hover:underline"
                      >
                        去登录
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 rounded-2xl bg-[#F7F4EF] dark:bg-[#2A2622] p-4 text-xs leading-5 text-slate-600 dark:text-[#CBC3B8]">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#3F7C6B] dark:text-[#5DBB8E]" />
                照片只用于这一次检测，不保存；只记录分数，用于排名和 PK。结果只是自测参考，不是医疗诊断。
              </div>
            </div>
          </div>
        </section>

        {analysis && photo && (
          <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div className="rounded-[32px] border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] p-4 md:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-lg font-black">测量位置</div>
                <button
                  type="button"
                  onClick={() => setShowMarks((v) => !v)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-200 dark:border-[#37312B] px-3 text-xs font-semibold text-slate-600 dark:text-[#CBC3B8] hover:text-slate-950 dark:hover:text-[#F2EEE8]"
                >
                  {showMarks ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showMarks ? '隐藏标注' : '显示标注'}
                </button>
              </div>
              <BojiOverlay
                photoUrl={photo.url}
                width={photo.width}
                height={photo.height}
                report={analysis.report}
                showMarks={showMarks}
              />
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-[#CBC3B8]">
                {OVERLAY_LEGEND.map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-[32px] bg-[#CF6D4E] p-6 text-white md:p-8">
                <div className="text-sm font-bold text-[#FFE5DC]">综合分</div>
                <div className="mt-2 text-5xl font-black tracking-tight">{total ?? '—'}</div>
                {analysis.insights?.percentile && (
                  <div className="mt-2 text-lg font-black">{bojiPercentileText(analysis.insights.percentile)}</div>
                )}
                <p className="mt-3 text-xs leading-5 text-[#FFF0EA]">
                  {total === null
                    ? '这张照片能测的项目太少，不给综合分。按拍摄建议换一张再试。'
                    : '测试版：分数还没有用真人评分校准，PK 图个乐；认真对比请看下面的原始数值和自己前后的变化。'}
                </p>
              </div>
              <BojiInsightsPanel insights={analysis.insights} total={total} />
              {notes.length > 0 && (
                <div className="rounded-3xl border border-amber-200 dark:border-[#5A4626] bg-amber-50 dark:bg-[#3A2E1A] p-4 text-xs leading-5 text-amber-800 dark:text-[#E8B866]">
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
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] px-5 text-sm font-semibold text-slate-700 dark:text-[#CBC3B8] hover:border-slate-300 dark:hover:border-[#4A423A] hover:text-slate-950 dark:hover:text-[#F2EEE8]"
              >
                <RotateCcw className="h-4 w-4" />
                重新开始
              </button>
            </div>
          </section>
        )}

        <section className="mt-8 rounded-[32px] border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] p-6 text-sm leading-7 text-slate-600 dark:text-[#CBC3B8] md:p-8">
          <div className="text-base font-black text-slate-950 dark:text-[#F2EEE8]">它是怎么测的</div>
          <p className="mt-2">
            先用 MediaPipe 找到关节和人体轮廓，再量轮廓宽度（倒三角、手臂、对称），最后在腹部找腹白线和每条横沟，逐块计算被沟围住的比例。
            腹肌数值依赖阴影：同一个人，光越柔和数值越低，所以前后对比请用同一地点和光线。
          </p>
          <p className="mt-2">
            算法开源：
            <a
              href="https://github.com/SmallHorseBrother/boji-detector"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#CF6D4E] dark:text-[#E08A6C] hover:underline"
            >
              boji-detector
            </a>
            。
          </p>
        </section>
      </div>
    </main>
  );
}
