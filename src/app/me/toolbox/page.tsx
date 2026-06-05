'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Copy,
  Database,
  ExternalLink,
  MapPin,
  Share2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';
import { AERO_CONTAINER_6XL, AERO_SUBTITLE } from '@/components/streetlifting-index/aero';
import { useToastContext } from '@/context/ToastContext';

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'power-analysis': Zap,
  'strength-calculator': Calculator,
  'bar-locations': MapPin,
  'community-data': Database,
};

const SCENARIO_TOOLBOX_ITEMS = [
  {
    key: 'office-neck',
    title: '办公后肩颈放松',
    description: '适合久坐办公后肩颈发紧时做，几步温和动作帮你把肩颈慢慢松开。',
    icon: '🪑',
    slug: 'office-neck',
    imageUrl: '/images/toolbox-scenarios/first-aid-1.png',
  },
  {
    key: 'sitting-back',
    title: '久坐后腰背舒展',
    description: '适合久坐起身后腰背发僵时做，先延展、再活动、最后放松。',
    icon: '🧘',
    slug: 'sitting-back',
    imageUrl: '/images/toolbox-scenarios/first-aid-4.png',
  },
  {
    key: 'post-run',
    title: '跑步后下肢拉伸',
    description: '按顺序放松小腿、大腿前侧和髋臀，适合作为跑后恢复收尾。',
    icon: '🏃',
    slug: 'post-run',
    imageUrl: '/images/toolbox-scenarios/first-aid-7.png',
  },
  {
    key: 'bedtime',
    title: '睡前放松',
    description: '从呼吸和轻柔舒展开始，把身体节奏慢慢放下来，更容易进入休息状态。',
    icon: '🌙',
    slug: 'bedtime',
    imageUrl: '/images/toolbox-scenarios/first-aid-10.png',
  },
];

export default function StudentToolboxPage() {
  const router = useRouter();
  const { showToast } = useToastContext();

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ title: string; url: string } | null>(null);

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
        // Fallback to QR dialog.
      }
    }

    openShareDialog(title, platformUrl);
  };

  return (
    <div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/50 to-transparent dark:from-primary-800/50" />

      <div className="relative z-10">
        <section className="text-surface-900">
          <div className={`${AERO_CONTAINER_6XL} py-10 md:py-14`}>
            <div className="mb-8">
              <Button
                icon={<ArrowLeft className="h-4 w-4" />}
                text
                onClick={() => router.back()}
                className="mb-4 text-surface-600 hover:text-surface-900"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-900 text-surface-0 shadow-sm">
                    <Sparkles className="h-8 w-8 stroke-[2.2]" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight md:text-4xl">工具箱</h1>
                    <p className={`${AERO_SUBTITLE} mt-2 text-sm md:text-base`}>
                      挑一个工具立刻试试；好用的话，也可以一键分享给同伴。
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    icon={<Share2 className="h-4 w-4" />}
                    text
                    rounded
                    className="text-surface-600 hover:text-surface-900 md:hidden"
                    onClick={() => tryNativeShare('工具箱（CoachLink）')}
                  />

                  <div className="hidden gap-2 md:flex">
                    <Button
                      label="分享工具箱"
                      icon={<Share2 className="mr-2 h-4 w-4" />}
                      size="small"
                      className="h-10 rounded-2xl border-none bg-surface-900 text-sm font-black text-surface-0 shadow-sm shadow-primary-100/60 transition-all hover:bg-surface-800 hover:shadow-primary-100 active:scale-[0.98]"
                      onClick={() => tryNativeShare('工具箱（CoachLink）')}
                      disabled={!toolboxShareUrl}
                    />
                    <Button
                      label="复制链接"
                      icon={<Copy className="mr-2 h-4 w-4" />}
                      size="small"
                      outlined
                      severity="secondary"
                      className="h-10 rounded-2xl border-surface-200 text-sm font-black text-surface-800 transition-all hover:border-primary-200 hover:bg-surface-0 active:scale-[0.98]"
                      onClick={() => copyToClipboard(toolboxShareUrl)}
                      disabled={!toolboxShareUrl}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-8 rounded-[28px]">
              <div className="rounded-3xl border border-surface-100 bg-gradient-to-r from-primary-50 via-surface-0 to-amber-50 p-5 md:p-7">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full border border-surface-200 bg-surface-0/80 px-3 py-1.5 text-xs font-black text-surface-700">
                      <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                      {STUDENT_TOOLBOX_LINKS.length} 个进阶工具，1 分钟上手
                    </div>
                    <div className="text-lg font-bold tracking-tight text-surface-900 md:text-xl">
                      让训练更可量化、可分享、可传播
                    </div>
                    <div className="text-sm text-surface-600">
                      从力量计算到地点查找，再到社区数据沉淀，把常用工具放在一个入口里。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 text-sm text-surface-600">进阶工具（适合需要计算或数据分析时使用）</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {STUDENT_TOOLBOX_LINKS.map((tool) => {
                const IconComponent = TOOL_ICONS[tool.key] || Sparkles;

                return (
                  <div
                    key={tool.key}
                    className="rounded-2xl border border-surface-200 bg-surface-0 p-4 transition-all hover:border-primary-200 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-surface-100 bg-surface-50 text-surface-700">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <button
                        type="button"
                        onClick={() => tryNativeShare(tool.label, tool.key)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-surface-200 text-surface-600 transition-colors hover:border-primary-200 hover:text-primary-600"
                        aria-label={`分享 ${tool.label}`}
                      >
                        <Share2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="line-clamp-2 text-base font-bold leading-6 text-surface-900">{tool.label}</div>
                      {tool.description && <div className="mt-1 line-clamp-2 text-sm text-surface-600">{tool.description}</div>}
                    </div>

                    <div className="mt-3">
                      <Button
                        label="打开工具"
                        icon={<ArrowRight className="mr-2 h-4 w-4" />}
                        size="small"
                        className="h-9 w-full rounded-xl border-none bg-surface-900 text-sm font-bold text-surface-0 transition-colors hover:bg-surface-800"
                        onClick={() => router.push(tool.url)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-10 border-t border-surface-100 pt-8">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-black text-surface-900 md:text-xl">场景放松</h2>
                <span className="text-xs text-surface-600 md:text-sm">不需要器械，跟着步骤慢慢开始</span>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {SCENARIO_TOOLBOX_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => router.push(`/dashboard/knowledge/scenarios/${item.slug}`)}
                    className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-0 text-left transition-all hover:border-primary-200 hover:shadow-sm"
                  >
                    <div className="relative aspect-[4/3] w-full bg-surface-100">
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" sizes="(max-width: 768px) 50vw, 25vw" />
                    </div>
                    <div className="p-4">
                      <div className="mb-2 text-2xl">{item.icon}</div>
                      <div className="text-sm font-bold leading-5 text-surface-900">{item.title}</div>
                      <div className="mt-2 line-clamp-2 text-xs text-surface-500">{item.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
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
              <div className="rounded-3xl border border-surface-200 bg-surface-0 p-4">
                <QRCodeSVG value={shareTarget.url} size={160} level="M" />
              </div>
            </div>

            <div className="text-center text-sm text-surface-600">微信里扫码打开，或者复制链接发给朋友。</div>

            <div className="flex gap-2">
              <InputText
                value={shareTarget.url}
                readOnly
                className="w-full rounded-2xl border-surface-200 bg-surface-50 font-mono text-sm"
              />
              <Button
                icon={<Copy className="h-4 w-4" />}
                outlined
                severity="secondary"
                className="rounded-2xl"
                onClick={() => copyToClipboard(shareTarget.url)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                label="打开链接"
                icon={<ExternalLink className="mr-2 h-4 w-4" />}
                size="small"
                className="h-10 flex-1 rounded-2xl border-none bg-surface-900 text-sm font-black text-surface-0 transition-all hover:bg-surface-800 active:scale-[0.98]"
                onClick={() => window.open(shareTarget.url, '_blank', 'noopener,noreferrer')}
              />
              <Button
                label="关闭"
                outlined
                severity="secondary"
                size="small"
                className="h-10 flex-1 rounded-2xl border-surface-200 text-sm font-black text-surface-800 transition-all hover:border-primary-200 hover:bg-surface-0 active:scale-[0.98]"
                onClick={() => setShareOpen(false)}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
