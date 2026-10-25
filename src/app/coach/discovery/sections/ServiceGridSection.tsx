import Link from 'next/link';
import { Skeleton } from 'primereact/skeleton';
import SectionHeader from './SectionHeader';
import { tierLabel, type ProductFeedItem } from './types';

const MAX_SERVICES = 8;

function subscribeHref(item: ProductFeedItem): string {
    const p = new URLSearchParams();
    p.set('tab', '1');
    p.set('from', 'discovery');
    p.set('autoSubscribe', '1');
    p.set('productId', item.product.id);
    p.set('months', String(item.opt.months));
    return `/coach/profile/${item.coach.id}?${p.toString()}#choose-pricing`;
}

function ServiceCard({ item }: { item: ProductFeedItem }) {
    return (
        <div className="flex flex-col gap-3 rounded-2xl border border-surface-200 bg-surface-0 p-5">
            <span className="self-start rounded-md bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                {tierLabel(item.product.tier)}
            </span>
            <span className="line-clamp-2 min-h-12 text-[17px] font-bold leading-6 text-surface-900">{item.product.name}</span>
            <span className="truncate text-[13px] text-surface-600">
                {item.coach.name} · {item.opt.months} 个月 · 开练才计次
            </span>
            <span className="mt-auto flex items-center justify-between">
                <span className="text-2xl font-black text-surface-900">¥{item.opt.price}</span>
                <Link
                    href={subscribeHref(item)}
                    className="flex h-10 items-center rounded-xl border border-surface-300 px-4 text-[15px] font-bold text-surface-900 hover:bg-surface-50"
                >
                    查看方案
                </Link>
            </span>
        </div>
    );
}

export default function ServiceGridSection({ items, loading }: { items: ProductFeedItem[]; loading: boolean }) {
    if (!loading && items.length === 0) return null;

    return (
        <section className="flex flex-col gap-5">
            <SectionHeader title="教练服务" moreHref="/market" moreText="全部服务" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {loading
                    ? [1, 2, 3, 4].map((i) => <Skeleton key={i} height="188px" className="rounded-2xl" />)
                    : items.slice(0, MAX_SERVICES).map((item) => (
                        <ServiceCard key={`${item.coach.id}-${item.product.id}`} item={item} />
                    ))}
            </div>
        </section>
    );
}
