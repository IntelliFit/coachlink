'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Star, Users, Clock, Crown, Eye, Search, ArrowRight, UserCheck, HelpCircle, Filter, ShoppingCart, Package, User, Layers, BookOpen, ShieldCheck, ChevronRight } from 'lucide-react';
import { Paginator } from 'primereact/paginator';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { coachService } from '@/app/service/coachService';
import { publicActionLibService } from '@/app/service/publicActionLibService';
import { Skeleton } from 'primereact/skeleton';
import { CoachesRow } from '@/types';
import { useRouter } from 'next/navigation';
import { useGuideStore } from '@/stores/useGuideStore';
import { useSession } from 'next-auth/react';
import { useToastContext } from '@/context/ToastContext';
import { useCart } from '@/context/CartContext';
import type { Product, DurationOption } from '@/app/api/coach/get-pricing/entity';
import type { PublicActionItemDto } from '@/app/api/public-action-lib/list-actions/entity';

interface PublicArticleListItem {
    id: string;
    coachId: string;
    coachName: string;
    coachAvatarUrl: string | null;
    title: string;
    summary: string;
    contentType: string;
    requiredTier: number;
    priceCents: number;
    publishedAt: string | null;
}

interface VisibilityStatus {
    focusMode: boolean;
    focusCoachId: string | null;
    focusCoachName: string | null;
    referrerCoachId: string | null;
    referrerCoachName: string | null;
}

// 简单的横向滚动容器组件
const ScrollSection = ({ title, moreLink, children, moreText = "查看更多" }: { title: string, moreLink?: string, children: React.ReactNode, moreText?: string }) => {
    const router = useRouter();
    return (
        <div className="mb-8">
            <div className="flex items-center justify-between mb-4 px-1">
                <h2 className="text-lg md:text-xl font-black text-surface-900 tracking-tight">{title}</h2>
                {moreLink && (
                    <button 
                        onClick={() => router.push(moreLink)}
                        className="flex items-center gap-1 text-xs md:text-sm font-bold text-surface-500 hover:text-primary-600 transition-colors"
                    >
                        <span>{moreText}</span>
                        <ChevronRight size={14} />
                    </button>
                )}
            </div>
            <div className="flex overflow-x-auto pb-4 -mx-4 px-4 gap-3 snap-x scrollbar-hide md:scrollbar-default">
                {children}
            </div>
        </div>
    );
};

const CoachDiscoveryPage: React.FC = () => {
    const [coaches, setCoaches] = useState<CoachesRow[]>([]);
    const [specialties, setSpecialties] = useState<{ label: string; value: string }[]>([{ label: '所有专长', value: 'all' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    // const [totalCount, setTotalCount] = useState(0); // 暂时不需要分页总数显示在模块化布局里
    const coachesPerPage = 10;
    const router = useRouter();
    const { startGuide, hasCompletedGuide, isLoading: isGuideLoading } = useGuideStore();
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const { addToCart } = useCart();

    const categories = useMemo(
        () => [
            {
                title: '服务商品',
                desc: '订阅计划/服务',
                icon: Layers,
                href: '/market',
                color: 'bg-primary-50 text-primary-600',
                borderColor: 'border-primary-100',
            },
            {
                title: '动作库',
                desc: '动作学习/添加',
                icon: Users, // 暂时用 Users 图标
                href: '/me/action-lib?tab=public', // 默认跳转到公共动作库
                color: 'bg-amber-50 text-amber-600',
                borderColor: 'border-amber-100',
            },
            {
                title: '找教练',
                desc: '专业认证教练',
                icon: UserCheck,
                href: '/coach/discovery?tab=coaches', // 可以是同一个页面的锚点或筛选状态
                color: 'bg-emerald-50 text-emerald-600',
                borderColor: 'border-emerald-100',
            },
            {
                title: '健身资讯',
                desc: '知识与实践',
                icon: BookOpen,
                href: '/articles',
                color: 'bg-indigo-50 text-indigo-600',
                borderColor: 'border-indigo-100',
            },
        ],
        [],
    );

    // 推荐动作（公共动作库）
    const [recommendedActions, setRecommendedActions] = useState<PublicActionItemDto[]>([]);
    const [recommendedLoading, setRecommendedLoading] = useState(false);

    // 混合流：推荐服务商品（来自教练的订阅产品）
    const [productFeed, setProductFeed] = useState<Array<{
        coach: CoachesRow;
        product: Product;
        opt: DurationOption;
    }>>([]);
    const [productFeedLoading, setProductFeedLoading] = useState(false);

    // 视野状态
    const [visibilityStatus, setVisibilityStatus] = useState<VisibilityStatus | null>(null);
    const [visibilityLoading, setVisibilityLoading] = useState(true);

    // 健身资讯
    const [articles, setArticles] = useState<PublicArticleListItem[]>([]);
    const [articlesLoading, setArticlesLoading] = useState(false);

    // 先获取视野状态
    useEffect(() => {
        const fetchVisibilityStatus = async () => {
            try {
                const res = await fetch('/api/student/visibility-status');
                const json = await res.json();
                if (json.success && json.data) {
                    setVisibilityStatus(json.data);
                }
            } catch (error) {
                console.error('获取视野状态失败:', error);
            } finally {
                setVisibilityLoading(false);
            }
        };
        fetchVisibilityStatus();
    }, []);

    useEffect(() => {
        if (visibilityLoading) return;
        // 初始加载只加载第一页作为推荐
        loadCoaches(1);
        loadSpecialties();
    }, [visibilityLoading, visibilityStatus]);

    // 推荐动作：仅在已登录且非专注模式下展示（避免干扰）
    useEffect(() => {
        if (visibilityLoading) return;
        if (visibilityStatus?.focusMode) {
            setRecommendedActions([]);
            return;
        }
        if (!session?.user?.id) {
            setRecommendedActions([]);
            return;
        }

        let cancelled = false;
        const loadRecommendedActions = async () => {
            setRecommendedLoading(true);
            try {
                const res = await publicActionLibService.listActions({
                    page: 1,
                    limit: 9,
                });
                if (!cancelled) setRecommendedActions(res?.actions || []);
            } catch (e) {
                // 静默失败
                if (!cancelled) setRecommendedActions([]);
            } finally {
                if (!cancelled) setRecommendedLoading(false);
            }
        };

        loadRecommendedActions();
        return () => {
            cancelled = true;
        };
    }, [visibilityLoading, visibilityStatus?.focusMode, session?.user?.id]);

    // 混合流：根据当前教练列表拉取一批“服务商品”
    useEffect(() => {
        if (visibilityLoading) return;
        if (visibilityStatus?.focusMode) {
            // 专注模式不展示混合商品流
            setProductFeed([]);
            return;
        }
        if (!coaches || coaches.length === 0) {
            setProductFeed([]);
            return;
        }

        let cancelled = false;
        const loadProducts = async () => {
            setProductFeedLoading(true);
            try {
                // 只取前 N 位教练做“推荐商品”
                const sample = coaches.slice(0, 6);
                const res = await Promise.allSettled(
                    sample.map(async (c) => {
                        const pricing = await coachService.getPricing({ coachId: c.id });
                        const products = (pricing?.products || []) as Product[];
                        return { coach: c, products };
                    }),
                );

                const items: Array<{ coach: CoachesRow; product: Product; opt: DurationOption }> = [];
                for (const r of res) {
                    if (r.status !== 'fulfilled') continue;
                    const { coach, products } = r.value;
                    for (const p of products.slice(0, 2)) {
                        const opt = (p.duration_options || [])[0];
                        if (!opt) continue;
                        items.push({ coach, product: p, opt });
                    }
                }

                if (!cancelled) setProductFeed(items.slice(0, 9));
            } finally {
                if (!cancelled) setProductFeedLoading(false);
            }
        };

        loadProducts();
        return () => {
            cancelled = true;
        };
    }, [coaches, visibilityLoading, visibilityStatus?.focusMode]);

    // 加载健身资讯
    useEffect(() => {
        if (visibilityLoading) return;
        if (visibilityStatus?.focusMode) return;

        let cancelled = false;
        const loadArticles = async () => {
            setArticlesLoading(true);
            try {
                const res = await fetch('/api/public/articles/list?limit=6&offset=0');
                const json = await res.json();
                if (!cancelled && json?.data?.items) {
                    setArticles(json.data.items);
                }
            } catch (e) {
                console.error('Failed to load articles', e);
            } finally {
                if (!cancelled) setArticlesLoading(false);
            }
        };
        loadArticles();
        return () => { cancelled = true; };
    }, [visibilityLoading, visibilityStatus?.focusMode]);

    // Auto start guide
    useEffect(() => {
        if (!session?.user) return;
        if (isLoading) return;
        if (!coaches || coaches.length === 0) return;
        if (isGuideLoading) return;
        if (hasCompletedGuide('student_find_coach')) return;
        if (visibilityStatus?.focusMode) return;
        const t = setTimeout(() => startGuide('STUDENT_FIND_COACH_GUIDE'), 600);
        return () => clearTimeout(t);
    }, [session?.user, isLoading, coaches, hasCompletedGuide, startGuide, isGuideLoading, visibilityStatus]);

    const loadSpecialties = async () => {
        try {
            const specialtiesData = await coachService.getAllSpecialties();
            if (specialtiesData) {
                const formattedSpecialties = specialtiesData.map(specialty => ({
                    label: specialty.name, value: specialty.name
                }));
                setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties]);
            }
        } catch (e) { console.error(e); }
    };

    const loadCoaches = async (page: number) => {
        setIsLoading(true);
        try {
            if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
                const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId });
                if (res && res.coach) {
                    setCoaches([res.coach as CoachesRow]);
                } else {
                    setCoaches([]);
                }
            } else {
                const res = await coachService.getAllCoaches({
                    page: page, limit: coachesPerPage,
                    search: searchTerm || '', specialty: selectedSpecialty
                });
                if (res) {
                    setCoaches(res.coaches);
                }
            }
        } finally { setIsLoading(false); }
    };

    const onSearchOrFilter = () => {
        loadCoaches(1);
    };

    // 精简版教练卡片（用于横向滚动）
    const renderMiniCoachCard = (coach: CoachesRow & { studentCount?: number; averageRating?: number }) => (
        <div
            key={coach.id}
            className="w-[160px] md:w-[200px] shrink-0 bg-surface-0 rounded-2xl p-3 md:p-4 border border-surface-100 hover:border-primary-200 transition-all cursor-pointer snap-start"
            onClick={() => router.push('/coach/profile/' + coach.id + '?from=discovery')}
        >
            <div className="relative w-full aspect-square mb-3 rounded-xl overflow-hidden bg-surface-50">
                {coach.avatar_url ? (
                    <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-black text-surface-300 bg-surface-100">
                        {coach.name.charAt(0)}
                    </div>
                )}
                {coach.is_featured && (
                    <div className="absolute top-1 right-1 bg-amber-400 text-white p-1 rounded-lg">
                        <Crown size={10} fill="currentColor" />
                    </div>
                )}
            </div>
            
            <h3 className="text-sm font-bold text-surface-900 truncate mb-1">{coach.name}</h3>
            <p className="text-xs text-surface-500 line-clamp-1 mb-2 h-4">{coach.bio || "暂无简介"}</p>
            
            <div className="flex items-center gap-1 text-[10px] text-surface-400 mb-2">
                <Star size={10} className="text-amber-500 fill-amber-500" />
                <span className="font-bold text-surface-700">{typeof coach.averageRating === 'number' ? coach.averageRating.toFixed(1) : (coach.rating ?? '0.0')}</span>
                <span className="w-1 h-1 bg-surface-300 rounded-full mx-0.5"></span>
                <span>{coach.studentCount || 0} 学员</span>
            </div>

            <div className="flex flex-wrap gap-1">
                {coach.specialties?.slice(0, 2).map((spec, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-surface-50 text-surface-500 text-[10px] rounded md:rounded-md border border-surface-100 truncate max-w-full">
                        {spec}
                    </span>
                ))}
            </div>
        </div>
    );

    // 服务商品卡片（用于横向滚动）
    const renderProductCard = (item: { coach: CoachesRow; product: Product; opt: DurationOption }, idx: number) => (
        <div 
            key={`${item.coach.id}-${item.product.id}-${idx}`}
            className="w-[260px] md:w-[300px] shrink-0 bg-surface-0 rounded-2xl p-4 border border-surface-100 hover:border-primary-200 transition-all cursor-pointer snap-start relative group"
        >
            <div className="flex items-start justify-between mb-2">
                <div className="px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-bold rounded-full">
                    {item.product.tier === 'basic' ? 'L1 基础版' : item.product.tier === 'standard' ? 'L2 进阶版' : 'L3 专业版'}
                </div>
                <div className="text-lg font-black text-primary-600">¥{item.opt.price}</div>
            </div>
            
            <h3 className="text-base font-bold text-surface-900 line-clamp-1 mb-1">{item.product.name}</h3>
            <p className="text-xs text-surface-500 line-clamp-2 h-8 mb-3">{item.product.description || "暂无描述"}</p>
            
            <div className="flex items-center gap-2 mb-4 pt-3 border-t border-surface-50">
                <div className="w-6 h-6 rounded-full bg-surface-100 overflow-hidden shrink-0">
                    {item.coach.avatar_url ? (
                        <img src={item.coach.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px]">{item.coach.name[0]}</div>
                    )}
                </div>
                <span className="text-xs text-surface-600 font-medium truncate">{item.coach.name}</span>
            </div>

            <Button
                size="small"
                className="w-full rounded-xl font-bold"
                label="订阅"
                onClick={() => {
                    const p = new URLSearchParams();
                    p.set('tab', '1');
                    p.set('from', 'discovery');
                    p.set('autoSubscribe', '1');
                    p.set('productId', item.product.id);
                    p.set('months', String(item.opt.months));
                    router.push(`/coach/profile/${item.coach.id}?${p.toString()}#choose-pricing`);
                }}
            />
        </div>
    );

    // 动作卡片
    const renderActionCard = (action: PublicActionItemDto) => (
        <div key={action.id} className="w-[200px] shrink-0 bg-surface-0 rounded-2xl p-3 border border-surface-100 snap-start">
             <div className="w-full h-24 bg-surface-50 rounded-xl mb-3 flex items-center justify-center text-surface-300">
                {/* 这里应该展示动作缩略图，暂时用 Icon 占位 */}
                <Package size={24} />
             </div>
             <h3 className="text-sm font-bold text-surface-900 truncate mb-1">{action.name}</h3>
             <div className="flex items-center justify-between mt-2">
                 <span className="text-xs text-surface-500">{action.like_count || 0} 赞</span>
                 <Button 
                    icon={action.isAdded ? "pi pi-check" : "pi pi-plus"} 
                    rounded 
                    text 
                    size="small"
                    className="w-7 h-7"
                    disabled={action.isAdded}
                    onClick={async (e) => {
                        e.stopPropagation();
                        if (!session?.user?.id) {
                            router.push(`/login?redirect=${encodeURIComponent('/coach/discovery')}`);
                            return;
                        }
                        try {
                            await publicActionLibService.addToMyLib({ actionId: action.id });
                            showToast({ severity: 'success', summary: '已加入动作库' });
                            setRecommendedActions((prev) =>
                                prev.map((x) => (x.id === action.id ? { ...x, isAdded: true } : x)),
                            );
                        } catch (e: any) {
                        }
                    }}
                 />
             </div>
        </div>
    );

    const renderArticleCard = (article: PublicArticleListItem) => (
        <div 
            key={article.id} 
            className="w-[240px] md:w-[280px] shrink-0 bg-surface-0 rounded-2xl p-4 border border-surface-100 hover:border-primary-200 transition-all cursor-pointer snap-start flex flex-col justify-between"
            onClick={() => router.push(`/articles/${article.id}`)}
        >
            <div>
                 <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-surface-100 overflow-hidden shrink-0">
                        {article.coachAvatarUrl ? (
                            <img src={article.coachAvatarUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-surface-500">
                                {article.coachName?.[0]}
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-surface-500 font-medium truncate max-w-[120px]">{article.coachName}</span>
                    {article.priceCents > 0 && (
                        <span className="ml-auto px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded">
                            付费
                        </span>
                    )}
                 </div>
                 <h3 className="text-sm font-bold text-surface-900 line-clamp-2 leading-snug mb-2 min-h-[2.5em]">
                     {article.title}
                 </h3>
                 <p className="text-xs text-surface-500 line-clamp-2 h-8 mb-0">
                     {article.summary || "暂无简介"}
                 </p>
            </div>
            <div className="mt-3 pt-3 border-t border-surface-50 flex items-center justify-between text-[10px] text-surface-400">
                 <span>{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('zh-CN') : ''}</span>
                 <div className="flex items-center gap-1 text-primary-600 font-bold hover:underline">
                    <span>阅读全文</span>
                    <ArrowRight size={10} />
                 </div>
            </div>
        </div>
    );

    // 专注模式还是保持原样（但也可以复用部分逻辑，这里简化处理只在最顶层拦）
    if (visibilityStatus?.focusMode) {
        return (
            <div className="min-h-screen bg-surface-50/50 py-8 px-4">
               {/* 复用之前的专注模式代码，这里为了文件整洁，我假设专注模式下只需要显示教练 */}
                <div className="max-w-5xl mx-auto">
                    <header className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary-50 rounded-lg">
                                <UserCheck className="text-primary-500" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-surface-900 tracking-tight">我的专属教练</h1>
                            </div>
                        </div>
                    </header>
                     {/* ... 专注模式逻辑略，如果有需要可以把之前的渲染逻辑粘回来 ... */}
                     {/* 简单复用列表 */}
                     <div className="space-y-4">
                        {coaches.map((c, idx) => (
                            <div key={c.id} className="bg-surface-0 p-4 rounded-xl border border-surface-100">
                                <h3 className="font-bold">{c.name}</h3>
                                <Button label="查看详情" onClick={() => router.push('/coach/profile/' + c.id)} className="mt-2" size="small"/>
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50/50 pb-20">
            {/* 顶部搜索区 */}
            <div className="bg-surface-0 sticky top-0 z-30 pt-safe-top">
                <div className="px-4 py-3 flex items-center gap-3 max-w-5xl mx-auto">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <InputText
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onSearchOrFilter();
                            }}
                            placeholder="搜索教练 / 专长 / 计划"
                            className="w-full pl-10 h-10 rounded-full border-none bg-surface-100 focus:ring-2 focus:ring-primary-500/20 text-sm"
                        />
                    </div>
                    {session?.user ? (
                        <button 
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-surface-100 text-surface-600"
                            onClick={() => router.push('/me/cart')}
                        >
                            <ShoppingCart size={18} />
                        </button>
                    ) : (
                         <Button label="登录" size="small" rounded text onClick={() => router.push('/login')} className="px-2" />
                    )}
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 pt-4">
                
                {/* 1. 四大入口区 */}
                <div className="grid grid-cols-4 gap-2 mb-8">
                    {categories.map((c) => (
                        <button
                            key={c.href}
                            onClick={() => router.push(c.href)}
                            className="flex flex-col items-center gap-2 group"
                        >
                            <div className={`w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center ${c.color} shadow-sm border ${c.borderColor} group-active:scale-95 transition-transform`}>
                                <c.icon size={22} className="stroke-[2.5]" />
                            </div>
                            <span className="text-xs font-bold text-surface-700">{c.title}</span>
                        </button>
                    ))}
                </div>

                {/* 2. 热门训练计划模块 */}
                <ScrollSection title="热门训练计划" moreLink="/market">
                    {productFeedLoading ? (
                        [1,2,3].map(i => <Skeleton key={i} width="260px" height="180px" className="shrink-0 rounded-2xl" />)
                    ) : productFeed.length > 0 ? (
                        productFeed.map((item, idx) => renderProductCard(item, idx))
                    ) : (
                        <div className="w-full py-8 text-center text-surface-400 text-sm bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                            暂无推荐计划
                        </div>
                    )}
                </ScrollSection>

                {/* 3. 推荐教练模块 */}
                <ScrollSection title="推荐教练" moreLink="/search"> {/* 这里假设有一个search页或者filter状态 */}
                     {isLoading ? (
                        [1,2,3,4].map(i => <Skeleton key={i} width="160px" height="200px" className="shrink-0 rounded-2xl" />)
                    ) : coaches.length > 0 ? (
                        coaches.map(c => renderMiniCoachCard(c as any))
                    ) : (
                         <div className="w-full py-8 text-center text-surface-400 text-sm bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                            暂无推荐教练
                        </div>
                    )}
                </ScrollSection>

                 {/* 4. 热门动作模块 */}
                 {!visibilityStatus?.focusMode && (
                     <ScrollSection title="热门动作" moreLink="/me/action-lib?tab=public">
                        {recommendedLoading ? (
                            [1,2,3,4].map(i => <Skeleton key={i} width="200px" height="120px" className="shrink-0 rounded-2xl" />)
                        ) : recommendedActions.length > 0 ? (
                            recommendedActions.map(a => renderActionCard(a))
                        ) : (
                            <div className="w-full py-8 text-center text-surface-400 text-sm bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                                暂无推荐动作
                            </div>
                        )}
                     </ScrollSection>
                 )}

                 {/* 5. 健身资讯 (新增) */}
                 {!visibilityStatus?.focusMode && (
                     <ScrollSection title="健身资讯" moreLink="/articles">
                        {articlesLoading ? (
                             [1,2,3].map(i => <Skeleton key={i} width="240px" height="160px" className="shrink-0 rounded-2xl" />)
                        ) : articles.length > 0 ? (
                            articles.map(a => renderArticleCard(a))
                        ) : (
                            <div className="w-full py-8 text-center text-surface-400 text-sm bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                                暂无最新资讯
                            </div>
                        )}
                     </ScrollSection>
                 )}

                 {/* 6. 底部 Slogan */}
                <div className="py-8 text-center">
                    <div className="inline-flex items-center justify-center w-10 h-10 bg-primary-50 rounded-full mb-3">
                         <Star size={18} className="text-primary-500 fill-primary-500" />
                    </div>
                    <p className="text-xs text-surface-400 font-medium">让小白到高手都能有所收获</p>
                </div>

            </div>
        </div>
    );
};

export default CoachDiscoveryPage;