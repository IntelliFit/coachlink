'use client';

import React, { useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Lock } from 'lucide-react';
import ContentPurchaseDialog from '@/components/payment/ContentPurchaseDialog';
import { useRouter } from 'next/navigation';

export default function ArticlePurchaseSection({
  contentId,
  title,
  priceCents,
  coachId,
  coachName,
  requiredTier,
}: {
  contentId: string;
  title: string;
  priceCents: number;
  coachId: string;
  coachName: string;
  requiredTier: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const priceYuan = useMemo(() => (priceCents / 100).toFixed(2), [priceCents]);
  const redirect = `/articles/${contentId}`;
  const subscribeHint = useMemo(() => {
    if (!requiredTier || requiredTier <= 0) return '订阅该教练后，可免费阅读其付费文章。';
    return `订阅该教练（等级 ≥ ${requiredTier}）后，可免费阅读其文章。`;
  }, [requiredTier]);

  return (
    <>
      <div className="mt-10 rounded-3xl border border-surface-200 bg-surface-0 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Lock className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-surface-900">该内容为付费文章</div>
            <div className="text-sm text-surface-500 mt-1 leading-relaxed">
              支付 <span className="font-black text-surface-900">¥{priceYuan}</span> 后解锁全文阅读（单篇购买）。
            </div>
            <div className="mt-2 text-xs text-surface-500 leading-relaxed">
              发布教练：<span className="font-black text-surface-900">{coachName}</span>。{subscribeHint}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                className="rounded-2xl"
                label={`立即购买 ¥${priceYuan}`}
                onClick={() => setOpen(true)}
              />
              <Button
                outlined
                className="rounded-2xl"
                label="订阅教练免费读"
                onClick={() =>
                  router.push(
                    `/coach/profile/${coachId}?tab=1#choose-pricing`,
                  )
                }
              />
              <Button
                outlined
                className="rounded-2xl"
                label="返回文章列表"
                onClick={() => (window.location.href = '/articles')}
              />
            </div>
          </div>
        </div>
      </div>

      <ContentPurchaseDialog
        visible={open}
        onHide={() => setOpen(false)}
        contentId={contentId}
        title={title}
        priceCents={priceCents}
        redirect={redirect}
      />
    </>
  );
}

