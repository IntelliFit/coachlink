'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildProfileBodyMetricsPatch } from '@coachlink/core/src/bodyMetrics';
import { useMyBodyMetrics } from '@/hooks/useMyBodyMetrics';
import SaveBodyToProfileLink from '@/components/toolbox/SaveBodyToProfileLink';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  ChevronDown,
  Dumbbell,
  Info,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';

type ReadinessLevel = {
  key: 'foundation' | 'strength' | 'bridge' | 'specific' | 'ready';
  name: string;
  summary: string;
  focus: string;
  accent: string;
  unilateralExercise: string;
};

const READINESS_LEVELS: ReadinessLevel[] = [
  {
    key: 'foundation',
    name: '基础力量期',
    summary: '先把双手引体的动作质量和基础拉力做扎实。',
    focus: '稳定完成 8–12 次严格自重引体',
    accent: '#64748B',
    unilateralExercise: '偏重引体或弓箭手引体 4 × 4/侧',
  },
  {
    key: 'strength',
    name: '负重积累期',
    summary: '你已经有不错基础，下一步是稳定提高最大拉力。',
    focus: '让负重 1RM 逐步接近 0.5 倍体重',
    accent: '#3F7C6B',
    unilateralExercise: '弓箭手引体 4 × 3/侧',
  },
  {
    key: 'bridge',
    name: '单侧过渡期',
    summary: '力量底子已经形成，可以增加单侧动作的比重。',
    focus: '同步提高负重力量与单侧控制',
    accent: '#B7793D',
    unilateralExercise: '弹力带辅助单手引体 5 × 3/侧',
  },
  {
    key: 'specific',
    name: '专项冲刺期',
    summary: '你离理论门槛已经很近，重点转向单手专项技术。',
    focus: '补齐起拉、顶端和抗旋转控制',
    accent: '#CF6D4E',
    unilateralExercise: '低辅助单手引体 + 5 秒离心 5 × 2/侧',
  },
  {
    key: 'ready',
    name: '理论门槛已达到',
    summary: '你的负重力量已达到经验门槛，可以安排高质量单手尝试。',
    focus: '把双手最大力量转化为单手动作能力',
    accent: '#9D4F3B',
    unilateralExercise: '标准单手引体尝试 4–6 次/侧，次间充分休息',
  },
];

function getReadinessLevel(additionalRatio: number): ReadinessLevel {
  if (additionalRatio >= 0.8) return READINESS_LEVELS[4];
  if (additionalRatio >= 0.68) return READINESS_LEVELS[3];
  if (additionalRatio >= 0.48) return READINESS_LEVELS[2];
  if (additionalRatio >= 0.25) return READINESS_LEVELS[1];
  return READINESS_LEVELS[0];
}

function formatKg(value: number) {
  return `${value.toFixed(1).replace(/\.0$/, '')} kg`;
}

function NumericField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>
      <span className="relative block">
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          type="number"
          min="0"
          step="0.5"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 pr-14 text-lg font-bold text-slate-950 outline-none transition focus:border-[#CF6D4E] focus:ring-4 focus:ring-[#CF6D4E]/10"
        />
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">
          kg
        </span>
      </span>
      <span className="mt-2 block text-xs leading-5 text-slate-500">{hint}</span>
    </label>
  );
}

export default function OneArmPullUpReadinessPage() {
  const router = useRouter();
  const bodyMetrics = useMyBodyMetrics();
  // 70 kg stays only as the example for visitors we know nothing about; signed-in users get their own weight.
  const exampleBodyWeight = bodyMetrics.defaults.weightKg || '70';
  const bodyWeightTouchedRef = useRef(false);
  const [bodyWeightInput, setBodyWeightInput] = useState('70');
  const [additionalWeightInput, setAdditionalWeightInput] = useState('40');
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    if (!bodyMetrics.loaded || bodyWeightTouchedRef.current || !bodyMetrics.defaults.weightKg) return;
    setBodyWeightInput(bodyMetrics.defaults.weightKg);
  }, [bodyMetrics.loaded, bodyMetrics.defaults.weightKg]);

  const changeBodyWeight = (value: string) => {
    bodyWeightTouchedRef.current = true;
    setBodyWeightInput(value);
  };
  const weightPatch = bodyMetrics.signedIn
    ? buildProfileBodyMetricsPatch({ weightKg: bodyWeightInput }, bodyMetrics.profile)
    : null;
  const bodyWeightFromProfile =
    bodyMetrics.profile.weightKg !== null && Number(bodyWeightInput) === bodyMetrics.profile.weightKg;

  const result = useMemo(() => {
    const bodyWeight = Number(bodyWeightInput);
    const additionalWeight = Number(additionalWeightInput);

    if (!Number.isFinite(bodyWeight) || bodyWeight <= 0 || !Number.isFinite(additionalWeight) || additionalWeight < 0) {
      return null;
    }

    const targetAdditionalWeight = bodyWeight * 0.8;
    const additionalRatio = additionalWeight / bodyWeight;
    const systemRatio = (bodyWeight + additionalWeight) / bodyWeight;
    const progress = (additionalWeight / targetAdditionalWeight) * 100;
    const gap = Math.max(0, targetAdditionalWeight - additionalWeight);
    const equivalentBodyWeight = (bodyWeight + additionalWeight) / 1.8;
    const equivalentDelta = equivalentBodyWeight - bodyWeight;
    const level = getReadinessLevel(additionalRatio);

    return {
      bodyWeight,
      additionalWeight,
      targetAdditionalWeight,
      additionalRatio,
      systemRatio,
      progress,
      gap,
      equivalentBodyWeight,
      equivalentDelta,
      level,
    };
  }, [additionalWeightInput, bodyWeightInput]);

  const progressWidth = Math.min(100, Math.max(0, result?.progress ?? 0));

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-16">
        <button
          type="button"
          onClick={() => router.push('/toolbox')}
          className="mb-8 inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          返回工具箱
        </button>

        <section className="overflow-hidden rounded-[32px] border border-slate-200 bg-[#1D1A16] text-white shadow-[0_24px_80px_rgba(29,26,22,0.14)]">
          <div className="grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-12">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold tracking-wide text-[#F0C5B7]">
                  <Sparkles className="h-4 w-4" />
                  负重引体 → 单手引体
                </div>
                <h1 className="max-w-2xl text-3xl font-black leading-tight tracking-tight md:text-5xl">
                  算一算，你离单手引体还有多远
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-300 md:text-base">
                  用严格负重引体 1RM，估算你距离“外加 0.8 倍体重”经验门槛的差距，并生成当前阶段的两日训练计划。
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center md:max-w-lg md:gap-4">
                {[
                  ['2 个', '必填数据'],
                  ['1 分钟', '完成测算'],
                  ['2 天', '每周训练'],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-4">
                    <div className="text-base font-black text-white md:text-xl">{value}</div>
                    <div className="mt-1 text-[11px] text-slate-400 md:text-xs">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-5 text-slate-950 md:p-8">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <div className="text-lg font-black">输入你的成绩</div>
                  <div className="mt-1 text-xs text-slate-500">两次测试之间建议休息 3–5 分钟</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    bodyWeightTouchedRef.current = false;
                    setBodyWeightInput(exampleBodyWeight);
                    setAdditionalWeightInput('40');
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                  aria-label="重置示例数据"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-6">
                <NumericField
                  id="body-weight"
                  label="当前体重"
                  hint={
                    <>
                      {bodyWeightFromProfile ? '来自你的个人资料。' : '穿轻便训练服，使用最近一次稳定体重。'}
                      <SaveBodyToProfileLink
                        patch={weightPatch}
                        profileEmpty={bodyMetrics.profile.weightKg === null}
                        onSave={bodyMetrics.saveToProfile}
                        className="ml-2"
                      />
                    </>
                  }
                  value={bodyWeightInput}
                  onChange={changeBodyWeight}
                />
                <NumericField
                  id="additional-weight"
                  label="负重引体 1RM 外加重量"
                  hint="不含自身体重；要求下放到直臂、下巴明确过杠。"
                  value={additionalWeightInput}
                  onChange={setAdditionalWeightInput}
                />
              </div>

              {!result && (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  请输入大于 0 的体重，以及不小于 0 的外加重量。
                </div>
              )}
            </div>
          </div>
        </section>

        {result && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-[1.25fr_0.75fr]">
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 md:p-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-500">当前阶段</div>
                    <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">{result.level.name}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">{result.level.summary}</p>
                  </div>
                  <div
                    className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-2 text-xs font-bold text-white"
                    style={{ backgroundColor: result.level.accent }}
                  >
                    <Target className="h-4 w-4" />
                    {result.progress >= 100 ? '已过经验门槛' : `完成 ${Math.round(result.progress)}%`}
                  </div>
                </div>

                <div className="mt-8">
                  <div className="mb-3 flex items-end justify-between gap-4">
                    <div>
                      <span className="text-4xl font-black tracking-tight md:text-5xl">{Math.round(result.progress)}</span>
                      <span className="ml-1 text-lg font-bold text-slate-400">%</span>
                    </div>
                    <div className="text-right text-xs leading-5 text-slate-500">
                      目标外加重量
                      <br />
                      <strong className="text-sm text-slate-900">{formatKg(result.targetAdditionalWeight)}</strong>
                    </div>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#CF6D4E] transition-[width] duration-500"
                      style={{ width: `${progressWidth}%` }}
                    />
                  </div>
                  <div className="mt-3 flex justify-between text-xs font-semibold text-slate-400">
                    <span>自重基础</span>
                    <span>0.8 × 体重经验门槛</span>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
                  <div className="rounded-2xl bg-[#F7F4EF] p-4">
                    <div className="text-xs font-semibold text-slate-500">还差外加重量</div>
                    <div className="mt-2 text-xl font-black">{result.gap > 0 ? formatKg(result.gap) : '0 kg'}</div>
                  </div>
                  <div className="rounded-2xl bg-[#F7F4EF] p-4">
                    <div className="text-xs font-semibold text-slate-500">外加 / 体重</div>
                    <div className="mt-2 text-xl font-black">{result.additionalRatio.toFixed(2)}×</div>
                  </div>
                  <div className="rounded-2xl bg-[#F7F4EF] p-4">
                    <div className="text-xs font-semibold text-slate-500">系统重量指数</div>
                    <div className="mt-2 text-xl font-black">{result.systemRatio.toFixed(2)}×</div>
                  </div>
                  <div className="rounded-2xl bg-[#F7F4EF] p-4">
                    <div className="text-xs font-semibold text-slate-500">单引等效体重</div>
                    <div className="mt-2 text-xl font-black">{formatKg(result.equivalentBodyWeight)}</div>
                  </div>
                </div>

                <div className="mt-6 flex gap-3 rounded-2xl border border-[#CF6D4E]/20 bg-[#FFF7F3] p-4">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#CF6D4E]" />
                  <p className="text-sm leading-6 text-slate-700">
                    {result.progress >= 100
                      ? '力量门槛不等于动作必然成功。你已经适合把训练重点转向握杠、肩胛起拉、抗旋转和单侧顶端控制。'
                      : `按这个经验模型，你还需要把严格负重 1RM 提高约 ${formatKg(result.gap)}。先完成下方 8 周训练，再复测一次。`}
                  </p>
                </div>
              </div>

              <aside className="rounded-[32px] bg-[#B4553A] p-6 text-white md:p-8">
                <BadgeCheck className="h-8 w-8" />
                <div className="mt-8 text-sm font-bold text-[#FFE5DC]">本阶段最重要的事</div>
                <div className="mt-2 text-2xl font-black leading-tight">{result.level.focus}</div>
                <div className="mt-8 border-t border-white/20 pt-6">
                  <div className="text-xs font-semibold text-[#FFE5DC]">模型中的等效差值 x</div>
                  <div className="mt-2 text-3xl font-black">
                    {result.equivalentDelta >= 0 ? '+' : ''}
                    {formatKg(result.equivalentDelta)}
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#FFF0EA]">
                    表示当前双手负重能力，对应于比你当前体重
                    {result.equivalentDelta >= 0 ? '更重' : '更轻'}多少的理论单引体重。
                  </p>
                </div>
              </aside>
            </section>

            <section className="mt-8 rounded-[32px] border border-slate-200 bg-white p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 text-sm font-bold text-[#CF6D4E]">
                    <CalendarDays className="h-4 w-4" />
                    8 周简易计划
                  </div>
                  <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">每周练 2 次，至少间隔 48 小时</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    每组保留 1–2 次余力。动作变形、肘肩不适或左右差距扩大时，不要继续加重。
                  </p>
                </div>
                <div className="w-fit rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-600">
                  第 4 周减量 30% · 第 8 周末复测
                </div>
              </div>

              <div className="mt-8 grid gap-4 lg:grid-cols-2">
                <article className="rounded-3xl border border-slate-200 bg-[#F7F4EF] p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1D1A16] text-white">
                      <Dumbbell className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500">训练 A</div>
                      <h3 className="text-lg font-black">最大力量日</h3>
                    </div>
                  </div>
                  <ol className="mt-6 space-y-4">
                    {[
                      ['严格负重引体', '5 × 3，最后一组仍保留 1 次余力'],
                      ['顶端停顿引体', '4 × 3，顶端停 2 秒'],
                      ['单臂悬垂', '3 × 15–30 秒/侧，可用另一手轻扶'],
                    ].map(([name, dose], index) => (
                      <li key={name} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#CF6D4E]">
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{dose}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>

                <article className="rounded-3xl border border-slate-200 bg-[#F7F4EF] p-5 md:p-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CF6D4E] text-white">
                      <Target className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-500">训练 B</div>
                      <h3 className="text-lg font-black">单侧转化日</h3>
                    </div>
                  </div>
                  <ol className="mt-6 space-y-4">
                    {[
                      [result.level.unilateralExercise, '左右都从较弱侧开始，质量优先'],
                      ['爆发胸触杠引体', '5 × 2，充分休息，不做到力竭'],
                      ['单臂肩胛下沉', '3 × 6/侧，保持肘伸直，可用另一手或弹力带辅助'],
                    ].map(([name, dose], index) => (
                      <li key={name} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-black text-[#CF6D4E]">
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-slate-900">{name}</div>
                          <div className="mt-1 text-xs leading-5 text-slate-500">{dose}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {[
                  {
                    icon: BarChart3,
                    title: '加重规则',
                    text: '两次训练都按要求完成后，下周增加最小杠铃片；失败则保持重量。',
                  },
                  {
                    icon: ShieldCheck,
                    title: '动作标准',
                    text: '直臂起始、不过度摆动、下巴过杠；标准变化会让前后复测失去意义。',
                  },
                  {
                    icon: BadgeCheck,
                    title: '毕业标准',
                    text: '达到 0.8× 只是经验门槛；两侧都能稳定完成标准单引才算真正解锁。',
                  },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-2xl border border-slate-200 p-4">
                    <Icon className="h-5 w-5 text-[#CF6D4E]" />
                    <div className="mt-3 text-sm font-black">{title}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setShowMethod((current) => !current)}
                className="flex w-full items-center justify-between gap-4 p-6 text-left md:p-8"
              >
                <span>
                  <span className="block text-sm font-bold text-[#CF6D4E]">怎么算的？</span>
                  <span className="mt-1 block text-lg font-black">查看公式、输入口径与模型限制</span>
                </span>
                <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${showMethod ? 'rotate-180' : ''}`} />
              </button>

              {showMethod && (
                <div className="border-t border-slate-100 px-6 pb-6 pt-6 md:px-8 md:pb-8">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-bold text-slate-500">经验门槛</div>
                      <div className="mt-2 font-mono text-sm font-bold">目标 AW = 0.8 × BW</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-bold text-slate-500">单引等效体重</div>
                      <div className="mt-2 font-mono text-sm font-bold">(BW + AW) ÷ 1.8</div>
                    </div>
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <div className="text-xs font-bold text-slate-500">等效差值</div>
                      <div className="mt-2 font-mono text-sm font-bold">(AW − 0.8BW) ÷ 1.8</div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">
                    BW 是体重，AW 是严格负重引体 1RM 的外加重量。0.8 是经验假设，不是医学或生物力学定律；臂长、握力、体脂、肩胛稳定、旋转控制和动作标准都会影响真实单手引体表现。本工具适合跟踪训练方向，不用于保证成功或替代教练评估。
                  </p>
                </div>
              )}
            </section>

            <div className="mt-8 flex justify-center">
              <button
                type="button"
                onClick={() => router.push('/toolbox')}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-[#B4553A] px-6 text-sm font-bold text-white transition hover:bg-[#9A4630] active:opacity-80"
              >
                继续逛工具箱
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
