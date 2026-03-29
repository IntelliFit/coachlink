'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';
import { useToastContext } from '@/context/ToastContext';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, Share2, Copy, ArrowLeft, ArrowRight, Sparkles, Calculator, MapPin, Database } from 'lucide-react';
import { AERO_CONTAINER_6XL, AERO_SUBTITLE } from '@/components/streetlifting-index/aero';

// Icon mapping for tools
const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'strength-calculator': Calculator,
  'bar-locations': MapPin,
  'community-data': Database,
};

const SCENARIO_TOOLBOX_ITEMS = [
  { key: 'office-neck', title: '办公族肩颈救星', icon: '💼', slug: 'office-neck' },
  { key: 'sitting-back', title: '久坐腰痛缓解', icon: '🪑', slug: 'sitting-back' },
  { key: 'post-run', title: '跑步后拉伸', icon: '🏃', slug: 'post-run' },
  { key: 'bedtime', title: '睡前放松', icon: '😴', slug: 'bedtime' },
];

export default function StudentToolboxPage() {
  const router = useRouter();
  const { showToast } = useToastContext();

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ title: string; url: string } | null>(null);

  const toolboxShareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    // Share the public landing page to bring users to CoachLink first
    return `${window.location.origin}/toolbox`;
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({
        severity: 'success',
        summary: '已复制链接',
        detail: '快去分享给朋友吧～',
      });
    } catch {
      // Fallback: prompt allows manual copy on some browsers
      window.prompt('复制链接（手动复制）：', text);
    }
  };

  const openShareDialog = (title: string, url: string) => {
    setShareTarget({ title, url });
    setShareOpen(true);
  };

  const tryNativeShare = async (title: string, toolKey?: string) => {
    // Prefer native share on mobile; fallback to QR/copy dialog on desktop
    const nav: any = navigator;
    const platformUrl = `${window.location.origin}/toolbox${toolKey ? `?tool=${encodeURIComponent(toolKey)}` : ''}`;
    if (nav?.share) {
      try {
        await nav.share({
          title,
          text: `我在 CoachLink 上发现了一个工具：${title}`,
          url: platformUrl,
        });
        return;
      } catch {
        // user cancelled or share failed — fallback below
      }
    }
    openShareDialog(title, platformUrl);
  };

  return (
    <div>
      {/* 背景装饰：自上而下的淡淡渐变 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/50 to-transparent dark:from-primary-800/50" />

      <div className="relative z-10">
        <section className="text-surface-900">
          <div className={`${AERO_CONTAINER_6XL} py-10 md:py-14`}>
            {/* Header */}
            <div className="mb-8">
              <Button
                icon={<ArrowLeft className="h-4 w-4" />}
                text
                onClick={() => router.back()}
                className="mb-4 text-surface-600 hover:text-surface-900"
              />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-3xl bg-surface-900 text-surface-0 flex items-center justify-center shadow-sm">
                    <Sparkles className="h-8 w-8 stroke-[2.2]" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-4xl font-bold tracking-tight">工具箱</h1>
                    <p className={`${AERO_SUBTITLE} mt-2 md:mt-2 text-sm md:text-base`}>
                      挑一个工具立刻试试；喜欢就一键分享给同伴。
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  {/* Mobile: Simple Share Icon */}
                  <Button
                    icon={<Share2 className="h-4 w-4" />}
                    text
                    rounded
                    className="md:hidden text-surface-600 hover:text-surface-900"
                    onClick={() => tryNativeShare('工具箱（CoachLink）')}
                  />

                  {/* Desktop: Full Buttons */}
                  <div className="hidden md:flex gap-2">
                    <Button
                      label="分享工具箱"
                      icon={<Share2 className="w-4 h-4 mr-2" />}
                      size="small"
                      className="h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 shadow-sm shadow-primary-100/60 hover:shadow-primary-100 active:scale-[0.98] transition-all"
                      onClick={() => tryNativeShare('工具箱（CoachLink）')}
                      disabled={!toolboxShareUrl}
                    />
                    <Button
                      label="复制链接"
                      icon={<Copy className="w-4 h-4 mr-2" />}
                      size="small"
                      outlined
                      severity="secondary"
                      className="h-10 rounded-2xl border-surface-200 text-surface-800 text-sm font-black hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                      onClick={() => copyToClipboard(toolboxShareUrl)}
                      disabled={!toolboxShareUrl}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Hero Section */}
            <div className="rounded-[28px] mb-8">
              <div className="p-5 md:p-7 rounded-3xl border border-surface-100 bg-gradient-to-r from-primary-50 via-surface-0 to-amber-50">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 rounded-full bg-surface-0/80 border border-surface-200 px-3 py-1.5 text-xs font-black text-surface-700">
                      <Sparkles className="h-3.5 w-3.5 text-primary-600" />
                      {STUDENT_TOOLBOX_LINKS.length} 个工具 · 1 分钟上手
                    </div>
                    <div className="text-lg md:text-xl font-bold tracking-tight text-surface-900">
                      让训练更"可量化、可分享、可传播"
                    </div>
                    <div className="text-sm text-surface-600">
                      计算力量水平、找单杠、提交社区数据——越多人用，越准、越好玩。
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tool Cards */}
            <div className="mb-3 text-sm text-surface-600">进阶工具（适合需要计算或数据分析时使用）</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {STUDENT_TOOLBOX_LINKS.map((t) => {
                const IconComponent = TOOL_ICONS[t.key] || Sparkles;
                return (
                  <div
                    key={t.key}
                    className="rounded-2xl border border-surface-200 bg-surface-0 p-4 hover:border-primary-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 rounded-xl bg-surface-50 border border-surface-100 text-surface-700 flex items-center justify-center shrink-0">
                        <IconComponent className="h-5 w-5" />
                      </div>
                      <button
                        type="button"
                        onClick={() => tryNativeShare(t.label, t.key)}
                        className="w-8 h-8 rounded-lg border border-surface-200 text-surface-600 flex items-center justify-center hover:border-primary-200 hover:text-primary-600 transition-colors"
                        aria-label={`分享 ${t.label}`}
                      >
                        <Share2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mt-3">
                      <div className="text-base font-bold text-surface-900 leading-6 line-clamp-2">
                        {t.label}
                      </div>
                      {t.description && (
                        <div className="text-sm text-surface-600 mt-1 line-clamp-2">
                          {t.description}
                        </div>
                      )}
                    </div>

                    <div className="mt-3">
                      <Button
                        label="打开工具"
                        icon={<ArrowRight className="w-4 h-4 mr-2" />}
                        size="small"
                        className="w-full h-9 rounded-xl bg-surface-900 border-none text-surface-0 text-sm font-bold hover:bg-surface-800 transition-colors"
                        onClick={() => router.push(t.url)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Scene Toolkit — 放在页面底部，避免挤占进阶工具首屏 */}
            <div className="mt-10 pt-8 border-t border-surface-100">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg md:text-xl font-black text-surface-900">场景急救箱</h2>
                <span className="text-xs md:text-sm text-surface-600">从知识库迁移，按场景直接用</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {SCENARIO_TOOLBOX_ITEMS.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => router.push(`/dashboard/knowledge/scenarios/${item.slug}`)}
                    className="rounded-2xl border border-surface-200 bg-surface-0 p-4 text-left hover:border-primary-200 hover:shadow-sm transition-all"
                  >
                    <div className="text-2xl mb-2">{item.icon}</div>
                    <div className="text-sm font-bold text-surface-900 leading-5">{item.title}</div>
                    <div className="text-xs text-surface-500 mt-2">点击查看方案</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Share Dialog (QR + copy) */}
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
              <div className="p-4 rounded-3xl bg-surface-0 border border-surface-200">
                <QRCodeSVG value={shareTarget.url} size={160} level="M" />
              </div>
            </div>

            <div className="text-sm text-surface-600 text-center">
              微信里扫码打开，或复制链接发给朋友。
            </div>

            <div className="flex gap-2">
              <InputText
                value={shareTarget.url}
                readOnly
                className="w-full font-mono text-sm bg-surface-50 rounded-2xl border-surface-200"
              />
              <Button
                icon={<Copy className="w-4 h-4" />}
                outlined
                severity="secondary"
                className="rounded-2xl"
                onClick={() => copyToClipboard(shareTarget.url)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                label="打开链接"
                icon={<ExternalLink className="w-4 h-4 mr-2" />}
                size="small"
                className="flex-1 h-10 rounded-2xl bg-surface-900 border-none text-surface-0 text-sm font-black hover:bg-surface-800 active:scale-[0.98] transition-all"
                onClick={() => window.open(shareTarget.url, '_blank', 'noopener,noreferrer')}
              />
              <Button
                label="关闭"
                outlined
                severity="secondary"
                size="small"
                className="flex-1 h-10 rounded-2xl border-surface-200 text-surface-800 text-sm font-black hover:bg-surface-0 hover:border-primary-200 active:scale-[0.98] transition-all"
                onClick={() => setShareOpen(false)}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

