'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';

type Props = {
  visible: boolean;
  onHide: () => void;
  contentId: string;
  title: string;
  priceCents: number;
  redirect: string;
};

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

export default function ContentPurchaseDialog({
  visible,
  onHide,
  contentId,
  title,
  priceCents,
  redirect,
}: Props) {
  const { showToast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const priceYuan = useMemo(() => (priceCents / 100).toFixed(2), [priceCents]);

  const handlePay = async () => {
    if (!contentId) return;
    if (!priceCents || priceCents <= 0) return;

    setLoading(true);
    try {
      const mobile = isMobileDevice();
      const res = await fetch('/api/payment/alipay/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `购买文章：${title || ''}`,
          totalAmount: Number(priceYuan),
          orderType: 'content_purchase',
          orderData: {
            contentId,
            redirect,
          },
          isMobile: mobile,
        }),
      });

      const data = await res.json();
      if (!data?.success || !data?.data?.paymentInfo?.formHtml) {
        showToast({
          severity: 'error',
          summary: '支付创建失败',
          detail: data?.message || '请稍后重试',
        });
        return;
      }

      const orderId: string | undefined = data?.data?.order?.id;
      const formHtml: string = data?.data?.paymentInfo?.formHtml;

      onHide();

      if (mobile) {
        document.open();
        document.write(formHtml);
        document.close();
        return;
      }

      const w = window.open('', '_blank');
      if (w) {
        w.document.write(formHtml);
        w.document.close();
      }

      if (orderId) {
        window.location.assign(`/payment/${orderId}?redirect=${encodeURIComponent(redirect)}`);
      }
    } catch (e) {
      console.error('[ContentPurchase] create order failed:', e);
      showToast({ severity: 'error', summary: '错误', detail: '支付请求失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      header="购买并解锁全文"
      visible={visible}
      onHide={onHide}
      modal
      draggable={false}
      resizable={false}
      style={{ width: '92vw', maxWidth: '520px' }}
      className="text-surface-900"
      pt={{
        header: { className: 'border-none bg-surface' },
        content: { className: 'bg-surface' },
        footer: { className: 'bg-surface' },
      }}
      footer={
        <div className="flex justify-end gap-2">
          <Button
            outlined
            className="rounded-2xl"
            label="取消"
            onClick={onHide}
            disabled={loading}
          />
          <Button
            className="rounded-2xl"
            label={`立即支付 ¥${priceYuan}`}
            onClick={handlePay}
            loading={loading}
            disabled={loading || priceCents <= 0}
          />
        </div>
      }
    >
      <div className="p-1">
        <div className="text-sm text-surface-500 leading-relaxed">
          支付成功后将自动返回文章并解锁全文阅读。
        </div>
      </div>
    </Dialog>
  );
}

