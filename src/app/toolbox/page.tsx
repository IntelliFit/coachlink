'use client';

import { useEffect, useMemo, useRef, type ComponentType } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  Calculator,
  Database,
  LogIn,
  MapPin,
  ScanLine,
  Share2,
  Sparkles,
  Target,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';

const TOOL_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  boji: ScanLine,
  'one-arm-pull-up': Target,
  'motion-effects': WandSparkles,
  'power-analysis': Zap,
  'strength-calculator': Calculator,
  'bar-locations': MapPin,
  'community-data': Database,
};

const TOOL_META: Record<string, { eyebrow: string; tone: string }> = {
  boji: { eyebrow: '新上线 · 测试版', tone: '#CF6D4E' },
  'one-arm-pull-up': { eyebrow: '本周主推', tone: '#CF6D4E' },
  'motion-effects': { eyebrow: 'AI 视觉', tone: '#6D5D8C' },
  'power-analysis': { eyebrow: '视频分析', tone: '#3F7C6B' },
  'strength-calculator': { eyebrow: '力量测算', tone: '#B7793D' },
  'bar-locations': { eyebrow: '训练地图', tone: '#4D7185' },
  'community-data': { eyebrow: '街举社区', tone: '#64748B' },
};

export default function PublicToolboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolKey = searchParams.get('tool');
  const toolRefs = useRef<Record<string, HTMLElement | null>>({});

  const selectedTool = useMemo(() => {
    if (!toolKey) return null;
    return STUDENT_TOOLBOX_LINKS.find((tool) => tool.key === toolKey) || null;
  }, [toolKey]);

  useEffect(() => {
    if (!toolKey) return;
    toolRefs.current[toolKey]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [toolKey]);

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = `${window.location.origin}/toolbox`;
    return toolKey ? `${base}?tool=${encodeURIComponent(toolKey)}` : base;
  }, [toolKey]);

  const tryNativeShare = async () => {
    const title = 'CoachLink 工具箱';
    const text = selectedTool
      ? `我在 CoachLink 上发现了一个工具：${selectedTool.label}`
      : '我在 CoachLink 上发现了一组好用的训练工具';
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };

    if (nav.share) {
      try {
        await nav.share({ title, text, url: shareUrl });
        return;
      } catch {
        // User cancelled or the share sheet is unavailable.
      }
    }

    if (shareUrl) window.prompt('复制分享链接：', shareUrl);
  };

  const openTool = (url: string) => {
    if (/^https?:\/\//.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    router.push(url);
  };

  return (
    <main className="min-h-screen bg-[#F7F4EF] dark:bg-[#161412] text-slate-950 dark:text-[#F2EEE8]">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-16">
        <section className="relative overflow-hidden rounded-[32px] bg-[#1D1A16] dark:bg-[#2E2A26] p-6 text-white shadow-[0_24px_80px_rgba(29,26,22,0.14)] md:p-12">
          <div className="relative z-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold tracking-wide text-[#F0C5B7]">
                <Activity className="h-4 w-4" />
                COACHLINK LAB
              </div>
              <h1 className="text-4xl font-black tracking-tight md:text-6xl">把训练问题，变成一个个简单答案</h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                测力量、看动作、找场地。所有工具都可以直接打开，登录后还能继续记录训练和成长。
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#B4553A] px-5 text-sm font-black text-white transition hover:bg-[#9A4630] active:opacity-80"
              >
                <LogIn className="h-4 w-4" />
                登录 / 注册
              </button>
              <button
                type="button"
                onClick={tryNativeShare}
                disabled={!shareUrl}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-transparent px-5 text-sm font-black text-white transition hover:bg-white/10 disabled:opacity-40"
              >
                <Share2 className="h-4 w-4" />
                分享工具箱
              </button>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full border-[48px] border-white/5" />
        </section>

        <section className="mt-12">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-black tracking-[0.14em] text-[#CF6D4E] dark:text-[#E08A6C]">训练与探索</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">选一个问题，马上开始</h2>
            </div>
            <span className="text-sm text-slate-500 dark:text-[#A0978B]">{STUDENT_TOOLBOX_LINKS.length} 个工具 · 随开随用</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {STUDENT_TOOLBOX_LINKS.map((tool) => {
              const Icon = TOOL_ICONS[tool.key] || Sparkles;
              const meta = TOOL_META[tool.key] || { eyebrow: '训练工具', tone: '#64748B' };
              const isHighlighted = tool.key === toolKey;

              return (
                <article
                  key={tool.key}
                  ref={(element) => {
                    toolRefs.current[tool.key] = element;
                  }}
                  className={[
                    'group flex min-h-72 flex-col rounded-3xl border bg-white dark:bg-[#211E1B] p-6 transition',
                    isHighlighted
                      ? 'border-[#CF6D4E] dark:border-[#E08A6C] shadow-[0_20px_48px_rgba(207,109,78,0.14)] ring-4 ring-[#CF6D4E]/10'
                      : 'border-slate-200 dark:border-[#37312B] hover:-translate-y-1 hover:border-slate-300 dark:hover:border-[#4A423A] hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]',
                  ].join(' ')}
                >
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
                    style={{ backgroundColor: meta.tone }}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="mt-6 flex-1">
                    <div className="text-xs font-black tracking-[0.14em]" style={{ color: meta.tone }}>
                      {meta.eyebrow}
                    </div>
                    <h3 className="mt-2 text-xl font-black leading-7 tracking-tight">{tool.label}</h3>
                    {tool.description && <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-[#CBC3B8]">{tool.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => openTool(tool.url)}
                    className={[
                      'mt-6 flex h-12 w-full items-center justify-between rounded-2xl px-4 text-sm font-black transition',
                      tool.key === 'one-arm-pull-up'
                        ? 'bg-[#B4553A] text-white hover:bg-[#9A4630]'
                        : 'border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] text-slate-800 dark:text-[#F2EEE8] hover:border-[#CF6D4E] dark:hover:border-[#E08A6C] hover:text-[#CF6D4E] dark:hover:text-[#E08A6C]',
                    ].join(' ')}
                  >
                    打开工具
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-12 rounded-[32px] border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-black tracking-[0.14em] text-[#CF6D4E] dark:text-[#E08A6C]">继续使用 COACHLINK</div>
              <h2 className="mt-2 text-xl font-black md:text-2xl">保存训练记录，让每次测算都有上下文</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-[#CBC3B8]">登录后可以进入今日训练、查看计划，并把工具分享给同伴。</p>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#B4553A] px-6 text-sm font-black text-white transition hover:bg-[#9A4630]"
            >
              进入 CoachLink
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
