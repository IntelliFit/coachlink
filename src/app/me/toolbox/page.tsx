'use client';

import { useMemo, useState, type ComponentType } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Dialog } from 'primereact/dialog';
import { QRCodeSVG } from 'qrcode.react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Calculator,
  Copy,
  Database,
  ExternalLink,
  MapPin,
  ScanLine,
  Share2,
  Sparkles,
  Target,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { STUDENT_TOOLBOX_LINKS, type ToolboxLink } from '@/config/toolbox';
import { useToastContext } from '@/context/ToastContext';

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
  'motion-effects': { eyebrow: 'AI 视觉', tone: '#6D5D8C' },
  'power-analysis': { eyebrow: '视频分析', tone: '#3F7C6B' },
  'strength-calculator': { eyebrow: '力量测算', tone: '#B7793D' },
  'bar-locations': { eyebrow: '训练地图', tone: '#4D7185' },
  'community-data': { eyebrow: '街举社区', tone: '#64748B' },
};

const SCENARIO_TOOLBOX_ITEMS = [
  {
    key: 'office-neck',
    title: '办公后肩颈放松',
    description: '久坐肩颈发紧时，用几步温和动作慢慢松开。',
    icon: '🪑',
    slug: 'office-neck',
    imageUrl: '/images/toolbox-scenarios/first-aid-1.png',
  },
  {
    key: 'sitting-back',
    title: '久坐后腰背舒展',
    description: '起身后腰背发僵，先延展、再活动、最后放松。',
    icon: '🧘',
    slug: 'sitting-back',
    imageUrl: '/images/toolbox-scenarios/first-aid-4.png',
  },
  {
    key: 'post-run',
    title: '跑步后下肢拉伸',
    description: '依次放松小腿、大腿前侧和髋臀，完成跑后收尾。',
    icon: '🏃',
    slug: 'post-run',
    imageUrl: '/images/toolbox-scenarios/first-aid-7.png',
  },
  {
    key: 'bedtime',
    title: '睡前放松',
    description: '从呼吸和轻柔舒展开始，让身体慢慢进入休息。',
    icon: '🌙',
    slug: 'bedtime',
    imageUrl: '/images/toolbox-scenarios/first-aid-10.png',
  },
];

function StandardToolCard({
  tool,
  onOpen,
  onShare,
}: {
  tool: ToolboxLink;
  onOpen: () => void;
  onShare: () => void;
}) {
  const Icon = TOOL_ICONS[tool.key] || Sparkles;
  const meta = TOOL_META[tool.key] || { eyebrow: '训练工具', tone: '#64748B' };

  return (
    <article className="group flex min-h-64 flex-col rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
          style={{ backgroundColor: meta.tone }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <button
          type="button"
          onClick={onShare}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-[#CF6D4E] hover:text-[#CF6D4E]"
          aria-label={`分享 ${tool.label}`}
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 flex-1">
        <div className="text-xs font-black tracking-[0.14em] text-slate-400">{meta.eyebrow}</div>
        <h3 className="mt-2 text-xl font-black leading-7 tracking-tight text-slate-950">{tool.label}</h3>
        {tool.description && <p className="mt-3 text-sm leading-6 text-slate-600">{tool.description}</p>}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-6 flex h-12 w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:border-[#CF6D4E] hover:text-[#CF6D4E]"
      >
        打开工具
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </button>
    </article>
  );
}

export default function StudentToolboxPage() {
  const router = useRouter();
  const { showToast } = useToastContext();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ title: string; url: string } | null>(null);

  const featuredTool = STUDENT_TOOLBOX_LINKS.find((tool) => tool.key === 'one-arm-pull-up');
  const standardTools = STUDENT_TOOLBOX_LINKS.filter((tool) => tool.key !== 'one-arm-pull-up');

  const toolboxShareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/toolbox`;
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        severity: 'success',
        summary: '已复制链接',
        detail: '现在可以直接发给朋友了。',
      });
    } catch {
      window.prompt('复制链接（手动复制）', text);
    }
  };

  const openShareDialog = (title: string, url: string) => {
    setShareTarget({ title, url });
    setShareOpen(true);
  };

  const tryNativeShare = async (title: string, toolKey?: string) => {
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
    };
    const platformUrl = `${window.location.origin}/toolbox${toolKey ? `?tool=${encodeURIComponent(toolKey)}` : ''}`;

    if (nav.share) {
      try {
        await nav.share({
          title,
          text: `我在 CoachLink 里发现了这个工具：${title}`,
          url: platformUrl,
        });
        return;
      } catch {
        // User cancelled or the browser share sheet is unavailable.
      }
    }

    openShareDialog(title, platformUrl);
  };

  return (
    <main className="min-h-screen bg-[#F7F4EF] text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-16">
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>
          <button
            type="button"
            onClick={() => tryNativeShare('CoachLink 工具箱')}
            disabled={!toolboxShareUrl}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-[#CF6D4E] hover:text-[#CF6D4E] disabled:opacity-40"
          >
            <Share2 className="h-4 w-4" />
            分享工具箱
          </button>
        </div>

        <section className="relative overflow-hidden rounded-[32px] bg-[#18231F] p-6 text-white shadow-[0_24px_80px_rgba(24,35,31,0.14)] md:p-12">
          <div className="relative z-10 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold tracking-wide text-[#F0C5B7]">
              <Activity className="h-4 w-4" />
              COACHLINK LAB
            </div>
            <h1 className="text-4xl font-black tracking-tight md:text-6xl">把训练问题，变成一个个简单答案</h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
              测力量、看动作、找场地，也照顾训练后的身体。选一个问题，马上开始。
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200">
                {STUDENT_TOOLBOX_LINKS.length} 个训练工具
              </div>
              <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200">
                4 个恢复场景
              </div>
              <div className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-200">
                随开随用
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full border-[48px] border-white/5" />
        </section>

        {featuredTool && (
          <section className="mt-12">
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-xs font-black tracking-[0.14em] text-[#CF6D4E]">本周主推</div>
                <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">先知道自己在哪，再决定怎么练</h2>
              </div>
              <span className="hidden text-sm text-slate-500 md:block">1 分钟完成</span>
            </div>

            <article className="grid overflow-hidden rounded-[32px] border border-[#CF6D4E]/20 bg-[#FFF7F3] md:grid-cols-[1.1fr_0.9fr]">
              <div className="p-6 md:p-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#CF6D4E] text-white">
                  <Target className="h-6 w-6" />
                </div>
                <h3 className="mt-6 text-3xl font-black leading-tight tracking-tight md:text-4xl">{featuredTool.label}</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-slate-600 md:text-base">{featuredTool.description}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {['测算差距', '分级结果', '8 周计划'].map((label) => (
                    <span key={label} className="rounded-full border border-[#CF6D4E]/20 bg-white px-3 py-2 text-xs font-bold text-[#9D4F3B]">
                      {label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between bg-[#CF6D4E] p-6 text-white md:p-10">
                <div>
                  <div className="text-xs font-bold text-[#FFE5DC]">经验门槛</div>
                  <div className="mt-2 text-5xl font-black tracking-tight">0.8×</div>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#FFF0EA]">
                    当严格负重引体的外加重量接近体重的 80%，通常已经具备挑战标准单手引体的力量基础。
                  </p>
                </div>
                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => router.push(featuredTool.url)}
                    className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-white px-5 text-sm font-black text-[#9D4F3B] transition hover:bg-[#FFF7F3] active:opacity-80"
                  >
                    开始测算
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => tryNativeShare(featuredTool.label, featuredTool.key)}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-transparent text-white transition hover:bg-white/10"
                    aria-label={`分享 ${featuredTool.label}`}
                  >
                    <Share2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </article>
          </section>
        )}

        <section className="mt-12">
          <div className="mb-4">
            <div className="text-xs font-black tracking-[0.14em] text-[#CF6D4E]">训练与探索</div>
            <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">再挑一个趁手工具</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {standardTools.map((tool) => (
              <StandardToolCard
                key={tool.key}
                tool={tool}
                onOpen={() => router.push(tool.url)}
                onShare={() => tryNativeShare(tool.label, tool.key)}
              />
            ))}
          </div>
        </section>

        <section className="mt-16 border-t border-slate-200 pt-12">
          <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs font-black tracking-[0.14em] text-[#CF6D4E]">身体恢复</div>
              <h2 className="mt-2 text-2xl font-black tracking-tight md:text-3xl">不训练的时候，也可以照顾身体</h2>
            </div>
            <span className="text-sm text-slate-500">不需要器械 · 跟着步骤完成</span>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {SCENARIO_TOOLBOX_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => router.push(`/dashboard/knowledge/scenarios/${item.slug}`)}
                className="group overflow-hidden rounded-3xl border border-slate-200 bg-white text-left transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-[0_20px_48px_rgba(15,23,42,0.08)]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <Image
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-105"
                    sizes="(max-width: 768px) 50vw, 25vw"
                  />
                  <span className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm">
                    {item.icon}
                  </span>
                </div>
                <div className="p-4">
                  <div className="text-sm font-black leading-5 text-slate-950 md:text-base">{item.title}</div>
                  <div className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</div>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>

      <Dialog
        header={shareTarget ? `分享：${shareTarget.title}` : '分享'}
        visible={shareOpen}
        onHide={() => setShareOpen(false)}
        className="w-[92vw] max-w-md"
        draggable={false}
        pt={{
          root: { className: 'rounded-3xl' },
          header: { className: 'rounded-t-3xl' },
        }}
      >
        {shareTarget && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="rounded-3xl border border-slate-200 bg-white p-4">
                <QRCodeSVG value={shareTarget.url} size={160} level="M" />
              </div>
            </div>
            <div className="text-center text-sm text-slate-600">微信扫码打开，或者复制链接发给朋友。</div>
            <div className="rounded-2xl bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-500 break-all">
              {shareTarget.url}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => copyToClipboard(shareTarget.url)}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:border-[#CF6D4E] hover:text-[#CF6D4E]"
              >
                <Copy className="h-4 w-4" />
                复制链接
              </button>
              <button
                type="button"
                onClick={() => window.open(shareTarget.url, '_blank', 'noopener,noreferrer')}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#CF6D4E] text-sm font-bold text-white transition hover:bg-[#B95F43]"
              >
                <ExternalLink className="h-4 w-4" />
                打开链接
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
