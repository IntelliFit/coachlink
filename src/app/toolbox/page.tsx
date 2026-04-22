'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';
import { ExternalLink, LogIn, Share2 } from 'lucide-react';

const NOVICE_FIRST_STEPS = [
  '先登录并打开「今天练什么」完成一次训练',
  '如果到场临时想练，直接用「立即开练（不建计划）」',
  '练完再使用进阶工具做计算、查地图或看社区数据',
];

export default function PublicToolboxPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toolKey = searchParams.get('tool');

  const toolRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const selectedTool = useMemo(() => {
    if (!toolKey) return null;
    return STUDENT_TOOLBOX_LINKS.find((t) => t.key === toolKey) || null;
  }, [toolKey]);

  useEffect(() => {
    if (!toolKey) return;
    const el = toolRefs.current[toolKey];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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
      : '我在 CoachLink 上发现了一个工具箱：力量计算器 / 找单杠 / 社区数据';

    const nav: any = navigator;
    if (nav?.share) {
      try {
        await nav.share({ title, text, url: shareUrl });
        return;
      } catch {
        // ignore; user cancelled or share failed
      }
    }
    // fallback: go to login page, user can still copy link from browser
    // (Public page keeps UI simple; /me/toolbox has richer QR + copy)
    if (shareUrl) {
      window.prompt('复制分享链接：', shareUrl);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="rounded-3xl border border-primary-100 bg-gradient-to-r from-primary-50 via-surface-0 to-amber-50 p-6 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-surface-0/80 border border-surface-200 px-3 py-1 text-xs font-bold text-surface-700">
                <i className="pi pi-sparkles text-primary-600" />
                CoachLink 工具箱
              </div>
              <h1 className="text-2xl md:text-3xl font-black text-surface-900">
                先来平台，再去用工具
              </h1>
              <p className="text-surface-600 text-sm md:text-base max-w-2xl">
                在 CoachLink 里发现好用的街健工具：力量水平评估、找单杠、社区数据共建。登录后还可以继续训练、记录与成长。
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                label="登录 / 注册"
                icon={<LogIn className="w-4 h-4 mr-2" />}
                className="bg-primary-600 border-primary-600 hover:bg-primary-700 hover:border-primary-700"
                onClick={() => router.push('/login')}
              />
              <Button
                label="分享这个页面"
                icon={<Share2 className="w-4 h-4 mr-2" />}
                outlined
                onClick={tryNativeShare}
                disabled={!shareUrl}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3 rounded-2xl border border-primary-100 bg-primary-50/50 p-4 md:p-5">
            <div className="text-base font-black text-surface-900">新手先走这 3 步</div>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
              {NOVICE_FIRST_STEPS.map((step, index) => (
                <div key={step} className="rounded-xl border border-primary-100 bg-surface-0 px-3 py-2 text-sm text-surface-700">
                  <span className="text-primary-700 font-semibold mr-1">{index + 1}.</span>
                  {step}
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button
                label="登录后开始今天训练"
                className="bg-surface-900 border-surface-900 hover:bg-surface-800 hover:border-surface-800"
                onClick={() => router.push('/login')}
              />
            </div>
          </div>

          {STUDENT_TOOLBOX_LINKS.map((t) => {
            const isHighlighted = toolKey === t.key;
            return (
              <div
                key={t.key}
                ref={(el) => {
                  toolRefs.current[t.key] = el;
                }}
                className={[
                  'rounded-2xl border bg-surface-0 overflow-hidden transition-all',
                  isHighlighted
                    ? 'border-primary-300 shadow-md ring-2 ring-primary-200'
                    : 'border-surface-200 hover:border-primary-200 hover:shadow-md',
                ].join(' ')}
              >
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center shrink-0">
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
                      label="打开工具"
                      icon={<ExternalLink className="w-4 h-4 mr-2" />}
                      className="flex-1 bg-surface-900 border-surface-900 hover:bg-surface-800 hover:border-surface-800"
                      onClick={() => window.open(t.url, '_blank', 'noopener,noreferrer')}
                    />
                    <Button
                      label="登录后收藏"
                      outlined
                      className="flex-1"
                      onClick={() => router.push('/login')}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

