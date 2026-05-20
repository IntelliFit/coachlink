'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { QRCodeSVG } from 'qrcode.react';
import { useToastContext } from '@/context/ToastContext';

type Props = {
  visible: boolean;
  onHide: () => void;
  contentId: string;
  title: string;
  priceCents: number;
  redirect: string;
  guestMode?: boolean;
  autoPay?: boolean;
};

function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

function extractHuifuPayTarget(payInfo: unknown): string {
  if (!payInfo) return '';
  if (typeof payInfo === 'string') return payInfo.trim();
  if (typeof payInfo !== 'object') return '';

  const value = payInfo as Record<string, unknown>;
  const directValue =
    value.qr_code ??
    value.qrcode ??
    value.qrCode ??
    value.code_url ??
    value.codeUrl ??
    value.pay_url ??
    value.payUrl ??
    value.url ??
    value.paymentUrl;

  return typeof directValue === 'string' ? directValue.trim() : '';
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export default function ContentPurchaseDialog({
  visible,
  onHide,
  contentId,
  title,
  priceCents,
  redirect,
  guestMode = false,
  autoPay = false,
}: Props) {
  const { showToast } = useToastContext();
  const [loading, setLoading] = useState(false);
  const [huifuQrOrder, setHuifuQrOrder] = useState<{
    orderId: string;
    qrValue: string;
    amountText: string;
  } | null>(null);
  const priceYuan = useMemo(() => (priceCents / 100).toFixed(2), [priceCents]);
  const hasTriggeredRef = useRef(false);

  const handlePay = async () => {
    if (!contentId) return;
    if (!priceCents || priceCents <= 0) return;

    setLoading(true);
    try {
      const mobile = isMobileDevice();
      const res = await fetch(
        guestMode ? '/api/payment/alipay/guest/create' : '/api/payment/alipay/create',
        {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `购买文章：${title || ''}`,
          title,
          totalAmount: Number(priceYuan),
          orderType: guestMode ? 'guest_content_purchase' : 'content_purchase',
          orderData: {
            contentId,
            redirect,
          },
          isMobile: mobile,
        }),
      },
      );

      const data = await res.json();
      const paymentInfo = data?.data?.paymentInfo;
      if (!data?.success || (!paymentInfo?.formHtml && !paymentInfo?.payInfo)) {
        showToast({
          severity: 'error',
          summary: '支付创建失败',
          detail: data?.message || '请稍后重试',
        });
        return;
      }

      const orderId: string | undefined = data?.data?.order?.id;
      const formHtml: string | undefined = paymentInfo?.formHtml;
      const payInfo = paymentInfo?.payInfo;

      onHide();

      if (payInfo) {
        if (!orderId) {
          showToast({
            severity: 'error',
            summary: '支付创建失败',
            detail: '缺少支付订单号，请稍后重试',
          });
          return;
        }

        const payTarget = extractHuifuPayTarget(payInfo);
        if (payTarget) {
          if (mobile && isHttpUrl(payTarget)) {
            window.location.assign(payTarget);
            return;
          }

          setHuifuQrOrder({
            orderId,
            qrValue: payTarget,
            amountText: priceYuan,
          });
          return;
        }

        window.location.assign(`/payment/${orderId}?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      if (!formHtml) {
        showToast({
          severity: 'error',
          summary: '支付创建失败',
          detail: '缺少支付参数，请稍后重试',
        });
        return;
      }

      if (mobile) {
        document.open();
        document.write(formHtml);
        document.close();
        return;
      }

      if (guestMode) {
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

  useEffect(() => {
    if (!visible) {
      hasTriggeredRef.current = false;
      return;
    }
    if (autoPay && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      handlePay();
    }
  }, [autoPay, visible]);

  if (autoPay) {
    return null;
  }

  return (
    <>
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

      <Dialog
        header="支付宝扫码支付"
        visible={Boolean(huifuQrOrder)}
        onHide={() => setHuifuQrOrder(null)}
        modal
        draggable={false}
        resizable={false}
        style={{ width: '92vw', maxWidth: '420px' }}
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
              onClick={() => setHuifuQrOrder(null)}
            />
            <Button
              className="rounded-2xl"
              label="我已完成支付"
              onClick={() => {
                if (!huifuQrOrder) return;
                window.location.assign(
                  `/payment/${huifuQrOrder.orderId}?redirect=${encodeURIComponent(redirect)}`,
                );
              }}
            />
          </div>
        }
      >
        {huifuQrOrder ? (
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <QRCodeSVG value={huifuQrOrder.qrValue} size={220} level="M" />
            </div>
            <div className="text-sm font-black text-surface-900">
              请使用支付宝扫码支付 ¥{huifuQrOrder.amountText}
            </div>
            <div className="text-xs leading-relaxed text-surface-500">
              支付完成后点击确认，系统会查询订单状态并解锁文章。
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

