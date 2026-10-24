'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Root page is intentionally lightweight.
 *
 * Entry routing is handled by middleware (`src/proxy.ts`) so that:
 * - unauthenticated -> /coach/discovery
 * - student -> /today-training (when has plan) or /coach/discovery (when no plan)
 * - coach -> /dashboard/overview
 *
 * This page is only a fallback to avoid flashes/extra requests.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Fallback: if middleware is bypassed in some environments, at least land on Discover.
    router.replace('/coach/discovery');
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center">
        <div className="text-sm font-black text-surface-900">正在进入…</div>
        <div className="mt-2 text-xs text-surface-500">如果未自动跳转，请点击下方按钮。</div>
        <button
          className="mt-5 inline-flex items-center justify-center px-5 py-3 rounded-2xl bg-surface-900 text-surface-0 text-sm font-black active:scale-[0.99]"
          onClick={() => router.push('/coach/discovery')}
        >
          去发现
        </button>
      </div>
    </main>
  );
}