'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { BadgeCheck, ShoppingBag, ArrowRight, Tag, Users, ShoppingCart } from 'lucide-react';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { useCart } from '@/context/CartContext';
import type { DurationOption, Product, PricingTier } from '@/app/api/coach/get-pricing/entity';

export interface MarketCoach {
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  specialties: string[];
}

export interface MarketItem {
  coach: MarketCoach;
  product: Product;
  minPrice: number | null;
}

function tierLabel(tier: PricingTier): string {
  if (tier === 'basic') return '基础';
  if (tier === 'standard') return '专业';
  return '全能';
}

function tierColor(tier: PricingTier): string {
  if (tier === 'basic') return 'bg-blue-50 text-blue-700 border-blue-100';
  if (tier === 'standard') return 'bg-green-50 text-green-700 border-green-100';
  return 'bg-purple-50 text-purple-700 border-purple-100';
}

function formatPrice(price: number | null | undefined) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return '—';
  return `¥${price}`;
}

export default function MarketClient({ initialItems }: { initialItems: MarketItem[] }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { showToast } = useToastContext();
  const { addToCart, getItemCount } = useCart();

  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<'all' | PricingTier>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (initialItems || []).filter((it) => {
      if (tier !== 'all' && it.product.tier !== tier) return false;
      if (!q) return true;
      const hay = [
        it.coach.name,
        it.coach.title || '',
        (it.coach.specialties || []).join(' '),
        it.product.name,
        it.product.description || '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [initialItems, query, tier]);

  const handleBuy = (item: MarketItem, _opt: DurationOption) => {
    if (!session?.user) {
      router.push(`/login?redirect=${encodeURIComponent('/market')}`);
      return;
    }
    router.push(`/coach/profile/${item.coach.id}?from=market#choose-pricing`);
  };

  const handleAddToCart = async (item: MarketItem, opt: DurationOption) => {
    if (!session?.user) {
      router.push(`/login?redirect=${encodeURIComponent('/market')}`);
      return;
    }
    try {
      await addToCart({
        coachId: item.coach.id,
        coachName: item.coach.name || '教练',
        productId: item.product.id,
        productName: item.product.name,
        productTier: item.product.tier,
        durationMonths: opt.months,
        price: opt.price,
      });
      showToast({
        severity: 'success',
        summary: '已加入购物车',
        detail: `${item.product.name} - ${opt.months}个月`,
      });
    } catch (e: any) {
      showToast({
        severity: 'error',
        summary: '添加失败',
        detail: e?.message || '请稍后重试',
      });
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-50 text-primary-700 border border-primary-100 text-xs font-black uppercase tracking-widest">
                <ShoppingBag className="w-3 h-3" />
                服务商品
              </div>
              <h1 className="mt-4 text-2xl md:text-3xl font-black text-surface-900 tracking-tight">
                选择你的训练服务
              </h1>
              <p className="mt-2 text-surface-500 text-sm font-medium">
                本页展示教练提供的订阅/计划等服务商品；点击购买将进入对应教练的订阅页面。
              </p>
            </div>

            <div className="shrink-0 flex gap-2">
              <Button
                outlined
                className="rounded-2xl"
                label={getItemCount() > 0 ? `购物车（${getItemCount()}）` : '购物车'}
                icon="pi pi-shopping-cart"
                onClick={() => router.push('/me/cart')}
              />
              <Button
                outlined
                className="rounded-2xl"
                label="去发现"
                onClick={() => router.push('/coach/discovery')}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索教练/商品/专长..."
              className="w-full rounded-2xl border border-surface-200 bg-surface-0 px-4 py-3 text-sm font-medium text-surface-700 outline-none focus:ring-2 focus:ring-primary-200"
            />

            <div className="flex gap-2">
              {(['all', 'basic', 'standard', 'vip'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setTier(k)}
                  className={[
                    'px-4 py-3 rounded-2xl text-sm font-black border transition-colors',
                    k === tier
                      ? 'bg-surface-900 text-surface-0 border-surface-900'
                      : 'bg-surface-0 text-surface-700 border-surface-200 hover:bg-surface-50',
                  ].join(' ')}
                >
                  {k === 'all' ? '全部' : tierLabel(k)}
                </button>
              ))}
            </div>
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="bg-surface-0 rounded-3xl border border-surface-100 p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-surface-50 flex items-center justify-center text-surface-400 mb-4">
              <Tag className="w-6 h-6" />
            </div>
            <div className="text-surface-900 font-black">暂无可展示的服务商品</div>
            <div className="text-surface-500 text-sm mt-2 font-medium">
              你可以先去发现，进入教练主页查看其订阅方案。
            </div>
            <div className="mt-6">
              <Button className="rounded-2xl" label="去发现" onClick={() => router.push('/coach/discovery')} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((item, idx) => (
              <div
                key={`${item.coach.id}-${item.product.id}-${idx}`}
                className="bg-surface-0 border border-surface-100 rounded-[28px] p-6 hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)] transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-2xl overflow-hidden bg-surface-50 border border-surface-100 shrink-0">
                      {item.coach.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coach.avatarUrl} alt={item.coach.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-black text-primary-600 bg-primary-50">
                          {item.coach.name?.slice(0, 1) || 'C'}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/coach/profile/${item.coach.id}?from=market`}
                          className="text-sm font-black text-surface-900 truncate hover:text-primary-600 transition-colors"
                        >
                          {item.coach.name}
                        </Link>
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-surface-500 bg-surface-50 border border-surface-100 px-2 py-1 rounded-xl">
                          <Users className="w-3 h-3" />
                          教练
                        </span>
                      </div>
                      <div className="text-[12px] text-surface-500 font-medium line-clamp-1">
                        {item.coach.title || '专业训练指导'}
                      </div>
                    </div>
                  </div>

                  <div
                    className={[
                      'text-[11px] font-black px-2.5 py-1 rounded-xl border',
                      tierColor(item.product.tier),
                    ].join(' ')}
                  >
                    {tierLabel(item.product.tier)}
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-lg font-black text-surface-900 tracking-tight line-clamp-1">
                      {item.product.name}
                    </h3>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-surface-400">起价</div>
                      <div className="text-lg font-black text-primary-600">{formatPrice(item.minPrice)}</div>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-surface-500 font-medium leading-relaxed line-clamp-2">
                    {item.product.description || '订阅/计划服务商品'}
                  </p>
                </div>

                {Array.isArray(item.product.included_products) && item.product.included_products.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.product.included_products.slice(0, 4).map((s, i) => (
                      <span
                        key={`${item.product.id}-inc-${i}`}
                        className="text-[11px] font-bold text-surface-600 bg-surface-50 border border-surface-100 px-2 py-1 rounded-xl"
                      >
                        <BadgeCheck className="w-3 h-3 inline mr-1 text-primary-600" />
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 space-y-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-surface-400">选择时长</div>
                  <div className="grid grid-cols-1 gap-2">
                    {(item.product.duration_options || []).map((opt, i) => (
                      <div key={`${item.product.id}-opt-${i}`} className="flex gap-2">
                        <button
                          onClick={() => handleBuy(item, opt)}
                          className="flex-1 flex items-center justify-between gap-3 rounded-2xl border border-surface-100 bg-surface-50 px-4 py-3 hover:bg-primary-50 hover:border-primary-200 transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-surface-800">{opt.months} 个月</span>
                            {opt.is_recommend && (
                              <span className="text-[10px] font-black text-primary-700 bg-primary-100 px-2 py-0.5 rounded-xl">
                                推荐
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-black text-primary-600">{formatPrice(opt.price)}</span>
                            <ArrowRight className="w-4 h-4 text-surface-300 group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleAddToCart(item, opt);
                          }}
                          className="px-4 rounded-2xl border border-surface-100 bg-surface-50 hover:bg-primary-50 hover:border-primary-200 transition-colors group"
                          title="加入购物车"
                        >
                          <ShoppingCart className="w-5 h-5 text-surface-400 group-hover:text-primary-600 transition-colors" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

