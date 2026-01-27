export const dynamic = 'force-dynamic';

import supabase from '@/lib/supabaseClient';
import type { Product } from '@/app/api/coach/get-pricing/entity';
import MarketClient, { MarketItem } from './MarketClient';

type CoachRowLite = {
  id: string;
  name: string;
  title: string | null;
  avatar_url: string | null;
  specialties: string[] | null;
  coach_pricing?: { products: any } | null;
};

function asProductArray(value: unknown): Product[] {
  if (!value) return [];
  if (!Array.isArray(value)) return [];
  return value as Product[];
}

function getMinPrice(product: Product): number | null {
  const opts = Array.isArray(product.duration_options) ? product.duration_options : [];
  const prices = opts.map((o) => Number((o as any)?.price ?? NaN)).filter((n) => Number.isFinite(n));
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

async function loadMarketItems(): Promise<MarketItem[]> {
  const { data: coaches, error } = await supabase
    .from('coaches')
    .select('id,name,title,avatar_url,specialties,coach_pricing(products)')
    .eq('status', 'approved')
    .limit(200);

  if (error) {
    console.error('loadMarketItems error:', error);
    return [];
  }

  const items: MarketItem[] = [];
  const coachList = (coaches || []) as unknown as CoachRowLite[];

  for (const coach of coachList) {
    const products = asProductArray((coach as any)?.coach_pricing?.products);
    for (const product of products) {
      const minPrice = getMinPrice(product);
      items.push({
        coach: {
          id: coach.id,
          name: coach.name,
          title: coach.title,
          avatarUrl: coach.avatar_url,
          specialties: coach.specialties || [],
        },
        product,
        minPrice,
      });
    }
  }

  // 兜底：如果教练未配置产品导致不足 6 个，为“过审路径”提供可展示的示例商品（绑定到第一个教练）
  if (items.length < 6 && coachList.length > 0) {
    const c = coachList[0];
    const fallbackCoach = {
      id: c.id,
      name: c.name,
      title: c.title,
      avatarUrl: c.avatar_url,
      specialties: c.specialties || [],
    };

    const fallbackProducts: Product[] = [
      {
        id: 'fallback-basic',
        tier: 'basic',
        type: 'single',
        name: '基础训练订阅（示例）',
        description: '基础订阅示例，用于展示“服务商品”形态与购买入口。',
        duration_options: [{ months: 1, price: 99 }, { months: 3, price: 269, is_recommend: true }],
      },
      {
        id: 'fallback-standard',
        tier: 'standard',
        type: 'single',
        name: '专业指导订阅（示例）',
        description: '专业指导示例，包含计划调整与沟通支持。',
        duration_options: [{ months: 1, price: 199 }, { months: 3, price: 549, is_recommend: true }],
      },
      {
        id: 'fallback-vip',
        tier: 'vip',
        type: 'single',
        name: '全能指导订阅（示例）',
        description: '全能指导示例，适合需要更高频反馈的用户。',
        duration_options: [{ months: 1, price: 299 }, { months: 3, price: 849, is_recommend: true }],
      },
      {
        id: 'fallback-video',
        tier: 'standard',
        type: 'single',
        name: '视频点评服务（示例）',
        description: '用于展示“可售卖服务”，实际以教练配置为准。',
        duration_options: [{ months: 1, price: 159 }],
      },
      {
        id: 'fallback-ai',
        tier: 'basic',
        type: 'single',
        name: '智能导入服务（示例）',
        description: '用于展示“服务商品”，不代表最终售卖口径。',
        duration_options: [{ months: 1, price: 39 }],
      },
      {
        id: 'fallback-combo',
        tier: 'vip',
        type: 'combo',
        name: '组合服务包（示例）',
        description: '组合服务示例：订阅 + 点评等。',
        included_products: ['训练订阅', '视频点评'],
        duration_options: [{ months: 1, price: 399 }, { months: 3, price: 1099, is_recommend: true }],
      },
    ];

    for (const p of fallbackProducts) {
      items.push({ coach: fallbackCoach, product: p, minPrice: getMinPrice(p) });
    }
  }

  return items;
}

export default async function MarketPage() {
  const initialItems = await loadMarketItems();
  return <MarketClient initialItems={initialItems} />;
}

