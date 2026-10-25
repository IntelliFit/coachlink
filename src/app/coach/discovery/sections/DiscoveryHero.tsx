import Link from 'next/link';
import { Search, Layers, Users, BookOpen, Wrench } from 'lucide-react';

const SHORTCUTS = [
    { title: '服务商品', href: '/market', icon: Layers },
    { title: '动作库', href: '/me/action-lib?tab=public', icon: Users },
    { title: '健身资讯', href: '/articles', icon: BookOpen },
    { title: '训练工具', href: '/toolbox', icon: Wrench },
];

interface DiscoveryHeroProps {
    planCount: number | null;
    plansHref: string;
    searchTerm: string;
    onSearchTermChange: (value: string) => void;
    onSearch: () => void;
}

export default function DiscoveryHero({ planCount, plansHref, searchTerm, onSearchTermChange, onSearch }: DiscoveryHeroProps) {
    const planText = planCount ? `${planCount} 套免费计划` : '免费计划';

    return (
        <section className="flex flex-wrap items-center gap-8 md:gap-12">
            <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
                <span className="text-sm font-bold tracking-wide text-primary">街健 · 力量举 · 引体专项</span>
                <h1 className="m-0 text-[32px] md:text-[44px] font-black leading-tight tracking-tight text-surface-900">
                    找到懂你的力量教练
                </h1>
                <p className="m-0 max-w-[520px] text-base md:text-[17px] leading-relaxed text-surface-600">
                    教练按你的情况排计划、看你的训练视频纠动作。暂时不找教练，也可以用{planText}自己练，训练记录和小程序同步。
                </p>
                <div className="flex flex-wrap gap-3">
                    <a href="#coaches" className="flex h-12 items-center rounded-xl bg-primary px-7 text-base font-bold text-primary-foreground hover:opacity-90">
                        找教练
                    </a>
                    <a href={plansHref} className="flex h-12 items-center rounded-xl border border-surface-300 bg-surface-0 px-7 text-base font-bold text-surface-900 hover:bg-surface-50">
                        免费计划开练
                    </a>
                </div>
            </div>

            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5 rounded-3xl border border-surface-200 bg-surface-0 p-5 md:p-6">
                <label htmlFor="guide-discovery-search" className="text-sm font-bold text-surface-900">搜索教练、专长或计划</label>
                <div className="flex gap-2">
                    <div className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-100 px-3">
                        <Search size={16} className="shrink-0 text-surface-500" aria-hidden="true" />
                        <input
                            id="guide-discovery-search"
                            type="search"
                            value={searchTerm}
                            onChange={(e) => onSearchTermChange(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') onSearch(); }}
                            placeholder="例如：引体、力量举"
                            className="min-w-0 flex-1 border-0 bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-500"
                        />
                    </div>
                    <button type="button" onClick={onSearch} className="h-12 shrink-0 rounded-xl bg-surface-900 px-5 text-sm font-bold text-surface-0 hover:opacity-90">
                        搜索
                    </button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                    {SHORTCUTS.map(({ title, href, icon: Icon }) => (
                        <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl py-3 text-surface-800 hover:bg-surface-50">
                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-400">
                                <Icon size={20} aria-hidden="true" />
                            </span>
                            <span className="text-xs font-bold">{title}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
