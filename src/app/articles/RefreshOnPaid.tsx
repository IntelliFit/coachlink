'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Button } from 'primereact/button';

const RECENT_PAY_TTL_MS = 2 * 60 * 1000;

export default function RefreshOnPaid() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [recentPay, setRecentPay] = useState(false);
  const refreshedOnceRef = useRef(false);
  const initialAt = useRef(Date.now());

  const paidParam = useMemo(() => searchParams?.get('paid') === '1', [searchParams]);
  const shouldShowNotice = paidParam || recentPay;

  const triggerRefresh = (reason: string) => {
    if (refreshedOnceRef.current) return;
    refreshedOnceRef.current = true;
    router.refresh();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.sessionStorage.getItem('recentPayAt');
    const ts = raw ? Number(raw) : 0;
    if (ts && Date.now() - ts <= RECENT_PAY_TTL_MS) {
      setRecentPay(true);
    }
  }, []);

  useEffect(() => {
    if (!paidParam) return;

    triggerRefresh('paid-param');

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('paid');
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [router, pathname, searchParams, paidParam]);

  useEffect(() => {
    if (!shouldShowNotice) return;

    const onFocus = () => triggerRefresh('focus');
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerRefresh('visibility');
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const hardTimer = window.setTimeout(() => {
      triggerRefresh('timeout');
    }, 15000);

    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearTimeout(hardTimer);
    };
  }, [shouldShowNotice]);

  if (!shouldShowNotice) return null;

  return (
    <div className="fixed left-1/2 top-4 z-50 w-[92%] max-w-xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          支付完成后如未立即解锁，请点击刷新或稍等片刻自动更新。
        </div>
        <Button
          label="刷新"
          size="small"
          className="rounded-xl"
          onClick={() => {
            refreshedOnceRef.current = false;
            router.refresh();
          }}
        />
      </div>
    </div>
  );
}

