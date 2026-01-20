'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';
import { useToastContext } from '@/context/ToastContext';
import { QRCodeSVG } from 'qrcode.react';
import { ExternalLink, Share2, Copy } from 'lucide-react';

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
    <div className="min-h-screen bg-surface-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button icon="pi pi-arrow-left" text onClick={() => router.back()} />
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-surface-900">工具箱</h1>
              <p className="text-surface-500 mt-1">挑一个工具立刻试试；喜欢就一键分享给同伴。</p>
            </div>
          </div>

          <div className="hidden md:flex gap-2">
            <Button
              label="分享工具箱"
              icon={<Share2 className="w-4 h-4 mr-2" />}
              className="bg-primary-600 border-primary-600 hover:bg-primary-700 hover:border-primary-700"
              onClick={() => tryNativeShare('工具箱（CoachLink）')}
              disabled={!toolboxShareUrl}
            />
            <Button
              label="复制链接"
              icon={<Copy className="w-4 h-4 mr-2" />}
              outlined
              onClick={() => copyToClipboard(toolboxShareUrl)}
              disabled={!toolboxShareUrl}
            />
          </div>
        </div>

        {/* Hero */}
        <div className="rounded-2xl border border-primary-100 bg-gradient-to-r from-primary-50 via-surface-0 to-amber-50 p-5 md:p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-0/80 border border-surface-200 px-3 py-1 text-xs font-bold text-surface-700">
                <i className="pi pi-sparkles text-primary-600" />
                3 个工具 · 1 分钟上手
              </div>
              <div className="text-lg md:text-xl font-black text-surface-900">
                让训练更“可量化、可分享、可传播”
              </div>
              <div className="text-sm text-surface-600">
                计算力量水平、找单杠、提交社区数据——越多人用，越准、越好玩。
              </div>
            </div>

            <div className="flex md:hidden gap-2">
              <Button
                label="分享工具箱"
                icon={<Share2 className="w-4 h-4 mr-2" />}
                className="flex-1 bg-primary-600 border-primary-600 hover:bg-primary-700 hover:border-primary-700"
                onClick={() => tryNativeShare('工具箱（CoachLink）')}
                disabled={!toolboxShareUrl}
              />
              <Button
                label="复制"
                icon={<Copy className="w-4 h-4 mr-2" />}
                outlined
                className="flex-1"
                onClick={() => copyToClipboard(toolboxShareUrl)}
                disabled={!toolboxShareUrl}
              />
            </div>
          </div>
        </div>

        {/* Tool Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STUDENT_TOOLBOX_LINKS.map((t) => (
            <div
              key={t.key}
              className="group rounded-2xl border border-surface-200 bg-surface-0 hover:border-primary-200 hover:shadow-md transition-all overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0 group-hover:scale-[1.03] transition-transform">
                    <i className={`${t.icon || 'pi pi-external-link'} text-primary-600 text-lg`} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-black text-surface-900 leading-snug">
                      {t.label}
                    </div>
                    {t.description && (
                      <div className="text-sm text-surface-600 mt-2 line-clamp-3">
                        {t.description}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button
                    label="打开"
                    icon={<ExternalLink className="w-4 h-4 mr-2" />}
                    className="flex-1 bg-surface-900 border-surface-900 hover:bg-surface-800 hover:border-surface-800"
                    onClick={() => window.open(t.url, '_blank', 'noopener,noreferrer')}
                  />
                  <Button
                    label="分享"
                    icon={<Share2 className="w-4 h-4 mr-2" />}
                    outlined
                    className="flex-1"
                    onClick={() => tryNativeShare(t.label, t.key)}
                  />
                </div>

                <div className="text-xs text-surface-400 mt-3 break-all font-mono">
                  {t.url}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Share Dialog (QR + copy) */}
      <Dialog
        header={shareTarget ? `分享：${shareTarget.title}` : '分享'}
        visible={shareOpen}
        onHide={() => setShareOpen(false)}
        className="w-[92vw] max-w-md"
        draggable={false}
      >
        {shareTarget && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="p-3 rounded-2xl bg-surface-0 border border-surface-200">
                <QRCodeSVG value={shareTarget.url} size={160} level="M" />
              </div>
            </div>

            <div className="text-sm text-surface-600 text-center">
              微信里扫码打开，或复制链接发给朋友。
            </div>

            <div className="flex gap-2">
              <InputText value={shareTarget.url} readOnly className="w-full font-mono text-sm bg-surface-50" />
              <Button
                icon={<Copy className="w-4 h-4" />}
                outlined
                onClick={() => copyToClipboard(shareTarget.url)}
              />
            </div>

            <div className="flex gap-2">
              <Button
                label="打开链接"
                icon={<ExternalLink className="w-4 h-4 mr-2" />}
                className="flex-1"
                onClick={() => window.open(shareTarget.url, '_blank', 'noopener,noreferrer')}
              />
              <Button
                label="关闭"
                outlined
                className="flex-1"
                onClick={() => setShareOpen(false)}
              />
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}

