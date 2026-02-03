'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Star, Users, Clock, Crown, Eye, Search, ArrowRight, UserCheck, HelpCircle, Filter, ShoppingCart, Package, User, Layers, BookOpen, ShieldCheck, ChevronRight } from 'lucide-react';
import { Paginator } from 'primereact/paginator';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Carousel } from 'primereact/carousel';
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

// Carousel 容器组件
const CarouselSection = ({ title, moreLink, items, itemTemplate, moreText = "查看更多", numVisible = 3 }: { 
    title: string, 
    moreLink?: string, 
    items: any[], 
    itemTemplate: (item: any) => React.ReactNode,
    moreText?: string,
    numVisible?: number
}) => {
    const router = useRouter();
    
    // 根据桌面端显示数量动态计算响应式配置
    const responsiveOptions = [
        {
            breakpoint: '1536px', // 2xl breakpoint
            numVisible: numVisible,
            numScroll: 1
        },
        {
            breakpoint: '1280px', // xl breakpoint
            numVisible: Math.max(Math.floor(numVisible * 0.8), 3),
            numScroll: 1
        },
        {
            breakpoint: '1024px', // lg breakpoint
            numVisible: Math.max(Math.floor(numVisible * 0.6), 2),
            numScroll: 1
        },
        {
            breakpoint: '768px', // md breakpoint
            numVisible: 2,
            numScroll: 1
        },
        {
            breakpoint: '640px', // sm breakpoint
            numVisible: 1.5,
            numScroll: 1
        },
        {
            breakpoint: '480px', // mobile
            numVisible: 1.2,
            numScroll: 1
        }
    ];

    return (
        <div className="mb-10">
            <div className="flex items-center justify-between mb-5 px-1">
                <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight">{title}</h2>
                {moreLink && (
                    <button 
                        onClick={() => router.push(moreLink)}
                        className="flex items-center gap-1 text-xs md:text-sm font-bold text-surface-500 hover:text-surface-900 active:scale-95 transition-all"
                    >
                        <span>{moreText}</span>
                        <ChevronRight size={16} className="stroke-[2.5]" />
                    </button>
                )}
            </div>
            <Carousel 
                value={items} 
                itemTemplate={itemTemplate}
                numVisible={numVisible}
                numScroll={1}
                responsiveOptions={responsiveOptions}
                circular={false}
                autoplayInterval={0}
                className="custom-carousel"
            />
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
            className="w-[180px] md:w-[220px] shrink-0 bg-surface-0 rounded-3xl p-4 md:p-5 border border-surface-100 hover:border-surface-200 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start"
            onClick={() => router.push('/coach/profile/' + coach.id + '?from=discovery')}
        >
            <div className="relative w-full aspect-square mb-3 rounded-2xl overflow-hidden bg-surface-50 border border-surface-100">
                {coach.avatar_url ? (
                    <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-black text-surface-300 bg-surface-100">
                        {coach.name.charAt(0)}
                    </div>
                )}
                {coach.is_featured && (
                    <div className="absolute top-2 right-2 bg-amber-400 text-white p-1.5 rounded-xl shadow-sm">
                        <Crown size={12} fill="currentColor" />
                    </div>
                )}
            </div>
            
            <h3 className="text-sm font-black text-surface-900 truncate mb-1 tracking-tight">{coach.name}</h3>
            <p className="text-xs text-surface-500 font-medium line-clamp-1 mb-3 h-4">{coach.bio || "暂无简介"}</p>
            
            <div className="flex items-center gap-1.5 text-[11px] text-surface-400 mb-3">
                <Star size={11} className="text-amber-500 fill-amber-500" />
                <span className="font-black text-surface-700">{typeof coach.averageRating === 'number' ? coach.averageRating.toFixed(1) : (coach.rating ?? '0.0')}</span>
                <span className="w-1 h-1 bg-surface-300 rounded-full"></span>
                <span className="font-medium">{coach.studentCount || 0} 学员</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {coach.specialties?.slice(0, 2).map((spec, i) => (
                    <span key={i} className="px-2 py-1 bg-surface-50 text-surface-600 text-[10px] font-bold rounded-full border border-surface-100 truncate max-w-full">
                        {spec}
                    </span>
                ))}
            </div>
        </div>
    );

    // 服务商品卡片（用于横向滚动）
    const renderProductCard = (item: { coach: CoachesRow; product: Product; opt: DurationOption }, idx: number) => (
        <div 
            className="w-[280px] md:w-[320px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100 hover:border-surface-200 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start relative group"
        >
            <div className="flex items-start justify-between mb-3">
                <div className="px-2.5 py-1 bg-primary-50 text-primary-700 text-[11px] font-black rounded-full border border-primary-100">
                    {item.product.tier === 'basic' ? 'L1 基础版' : item.product.tier === 'standard' ? 'L2 进阶版' : 'L3 专业版'}
                </div>
                <div className="text-xl font-black text-primary-600 tracking-tight">¥{item.opt.price}</div>
            </div>
            
            <h3 className="text-base font-black text-surface-900 line-clamp-1 mb-2 tracking-tight">{item.product.name}</h3>
            <p className="text-xs text-surface-500 font-medium line-clamp-2 h-8 mb-4">{item.product.description || "暂无描述"}</p>
            
            <div className="flex items-center gap-2 mb-4 pt-4 border-t border-surface-100">
                <div className="w-7 h-7 rounded-full bg-surface-100 overflow-hidden shrink-0 border border-surface-200">
                    {item.coach.avatar_url ? (
                        <img src={item.coach.avatar_url} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-surface-500">{item.coach.name[0]}</div>
                    )}
                </div>
                <span className="text-xs text-surface-700 font-bold truncate tracking-tight">{item.coach.name}</span>
            </div>

            <Button
                size="small"
                className="w-full h-10 rounded-2xl font-black bg-surface-900 border-none text-surface-0 hover:bg-surface-800 shadow-sm active:scale-95 transition-all"
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
        <div className="w-[220px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100 hover:border-surface-200 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 active:scale-98 transition-all snap-start">
             <h3 className="text-sm font-black text-surface-900 mb-4 line-clamp-2 min-h-[2.5em] tracking-tight">{action.name}</h3>
             <div className="flex items-center justify-between">
                 <span className="text-xs text-surface-500 font-bold">{action.like_count || 0} 赞</span>
                 <Button 
                    label={action.isAdded ? "已添加" : "添加"}
                    size="small"
                    className={`h-9 px-4 rounded-2xl font-black text-xs border ${
                        action.isAdded 
                            ? 'bg-surface-100 border-surface-200 text-surface-400 cursor-not-allowed' 
                            : 'bg-surface-900 border-surface-900 text-surface-0 hover:bg-surface-800 active:scale-95'
                    } transition-all`}
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
            className="w-[260px] md:w-[300px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100 hover:border-surface-200 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start flex flex-col justify-between"
            onClick={() => router.push(`/articles/${article.id}`)}
        >
            <div>
                 <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-surface-100 overflow-hidden shrink-0 border border-surface-200">
                        {article.coachAvatarUrl ? (
                            <img src={article.coachAvatarUrl} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-surface-500">
                                {article.coachName?.[0]}
                            </div>
                        )}
                    </div>
                    <span className="text-xs text-surface-600 font-bold truncate max-w-[120px] tracking-tight">{article.coachName}</span>
                    {article.priceCents > 0 && (
                        <span className="ml-auto px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100">
                            付费
                        </span>
                    )}
                 </div>
                 <h3 className="text-sm font-black text-surface-900 line-clamp-2 leading-snug mb-2 min-h-[2.5em] tracking-tight">
                     {article.title}
                 </h3>
                 <p className="text-xs text-surface-500 font-medium line-clamp-2 h-8 mb-0">
                     {article.summary || "暂无简介"}
                 </p>
            </div>
            <div className="mt-4 pt-4 border-t border-surface-100 flex items-center justify-between text-[10px] text-surface-400">
                 <span className="font-medium">{article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('zh-CN') : ''}</span>
                 <div className="flex items-center gap-1 text-surface-900 font-black hover:text-primary-600 transition-colors">
                    <span>阅读</span>
                    <ArrowRight size={12} className="stroke-[2.5]" />
                 </div>
            </div>
        </div>
    );

    // 专注模式
    if (visibilityStatus?.focusMode) {
        return (
            <div className="min-h-screen bg-surface-50 py-8 px-4">
                <div className="max-w-6xl mx-auto">
                    <header className="mb-10">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-14 h-14 bg-primary-50 rounded-3xl flex items-center justify-center border border-primary-100">
                                <UserCheck className="text-primary-600 stroke-[2.5]" size={26} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-surface-900 tracking-tight">我的专属教练</h1>
                                <p className="text-sm text-surface-600 font-medium mt-1">专注模式已开启</p>
                            </div>
                        </div>
                    </header>
                     <div className="space-y-4">
                        {coaches.map((c, idx) => (
                            <div key={c.id} className="bg-surface-0 p-6 rounded-3xl border border-surface-100 hover:border-surface-200 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)] transition-all">
                                <h3 className="text-lg font-black text-surface-900 tracking-tight mb-2">{c.name}</h3>
                                {c.bio && <p className="text-sm text-surface-600 font-medium mb-4">{c.bio}</p>}
                                <Button 
                                    label="查看详情" 
                                    onClick={() => router.push('/coach/profile/' + c.id)} 
                                    className="rounded-2xl font-black h-10 bg-surface-900 border-none text-surface-0 hover:bg-surface-800 shadow-sm active:scale-95 transition-all" 
                                    size="small"
                                />
                            </div>
                        ))}
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 pb-20">
            {/* 顶部搜索区 */}
            <div className="bg-surface-0 sticky top-0 z-30 pt-safe-top border-b border-surface-100">
                <div className="px-4 py-3 flex items-center gap-3 max-w-6xl mx-auto">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
                        <InputText
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') onSearchOrFilter();
                            }}
                            placeholder="搜索教练 / 专长 / 计划"
                            className="w-full pl-10 h-11 rounded-2xl border border-surface-100 bg-surface-0 focus:ring-2 focus:ring-primary-500/20 text-sm font-medium"
                        />
                    </div>
                    {session?.user ? (
                        <button 
                            className="w-10 h-10 flex items-center justify-center rounded-2xl bg-surface-100 text-surface-600 hover:bg-surface-50 active:scale-95 transition-all border border-surface-200"
                            onClick={() => router.push('/me/cart')}
                        >
                            <ShoppingCart size={18} />
                        </button>
                    ) : (
                         <Button 
                            label="登录" 
                            size="small" 
                            onClick={() => router.push('/login')} 
                            className="rounded-2xl font-bold border-surface-200 hover:border-primary-200 active:scale-95 transition-all"
                            outlined
                         />
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pt-6">
                
                {/* 1. 四大入口区 */}
                <div className="grid grid-cols-4 gap-3 mb-10">
                    {categories.map((c) => (
                        <button
                            key={c.href}
                            onClick={() => router.push(c.href)}
                            className="flex flex-col items-center gap-2.5 group"
                        >
                            <div className={`w-14 h-14 md:w-16 md:h-16 rounded-3xl flex items-center justify-center ${c.color} shadow-sm border ${c.borderColor} group-hover:-translate-y-0.5 group-active:scale-95 transition-all`}>
                                <c.icon size={24} className="stroke-[2.5]" />
                            </div>
                            <span className="text-xs font-bold text-surface-800 tracking-tight">{c.title}</span>
                        </button>
                    ))}
                </div>

                {/* 2. 热门训练计划模块 */}
                {productFeedLoading ? (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">热门训练计划</h2>
                        <div className="flex gap-3 overflow-hidden">
                            {[1,2,3].map(i => <Skeleton key={i} width="280px" height="200px" className="shrink-0 rounded-3xl" />)}
                        </div>
                    </div>
                ) : productFeed.length > 0 ? (
                    <CarouselSection 
                        title="热门训练计划" 
                        moreLink="/market"
                        items={productFeed}
                        itemTemplate={(item) => renderProductCard(item, productFeed.indexOf(item))}
                        numVisible={3}
                    />
                ) : (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">热门训练计划</h2>
                        <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">
                            暂无推荐计划
                        </div>
                    </div>
                )}

                {/* 3. 推荐教练模块 */}
                {isLoading ? (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">推荐教练</h2>
                        <div className="flex gap-3 overflow-hidden">
                            {[1,2,3,4].map(i => <Skeleton key={i} width="180px" height="240px" className="shrink-0 rounded-3xl" />)}
                        </div>
                    </div>
                ) : coaches.length > 0 ? (
                    <CarouselSection 
                        title="推荐教练" 
                        moreLink="/search"
                        items={coaches}
                        itemTemplate={(coach) => renderMiniCoachCard(coach as any)}
                        numVisible={4}
                    />
                ) : (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">推荐教练</h2>
                        <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">
                            暂无推荐教练
                        </div>
                    </div>
                )}

                 {/* 4. 热门动作模块 */}
                 {!visibilityStatus?.focusMode && (
                    <>
                        {recommendedLoading ? (
                            <div className="mb-10">
                                <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">热门动作</h2>
                                <div className="flex gap-3 overflow-hidden">
                                    {[1,2,3,4].map(i => <Skeleton key={i} width="220px" height="140px" className="shrink-0 rounded-3xl" />)}
                                </div>
                            </div>
                        ) : recommendedActions.length > 0 ? (
                            <CarouselSection 
                                title="热门动作" 
                                moreLink="/me/action-lib?tab=public"
                                items={recommendedActions}
                                itemTemplate={(action) => renderActionCard(action)}
                                numVisible={5}
                            />
                        ) : (
                            <div className="mb-10">
                                <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">热门动作</h2>
                                <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">
                                    暂无推荐动作
                                </div>
                            </div>
                        )}
                    </>
                 )}

                 {/* 5. 健身资讯 (新增) */}
                 {!visibilityStatus?.focusMode && (
                    <>
                        {articlesLoading ? (
                            <div className="mb-10">
                                <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">健身资讯</h2>
                                <div className="flex gap-3 overflow-hidden">
                                    {[1,2,3].map(i => <Skeleton key={i} width="260px" height="180px" className="shrink-0 rounded-3xl" />)}
                                </div>
                            </div>
                        ) : articles.length > 0 ? (
                            <CarouselSection 
                                title="健身资讯" 
                                moreLink="/articles"
                                items={articles}
                                itemTemplate={(article) => renderArticleCard(article)}
                                numVisible={3}
                            />
                        ) : (
                            <div className="mb-10">
                                <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">健身资讯</h2>
                                <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">
                                    暂无最新资讯
                                </div>
                            </div>
                        )}
                    </>
                 )}

                 {/* 6. 底部 Slogan */}
                <div className="py-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-primary-50 rounded-3xl mb-4 border border-primary-100">
                         <Star size={20} className="text-primary-500 fill-primary-500" />
                    </div>
                    <p className="text-sm text-surface-500 font-bold tracking-tight">让小白到高手都能有所收获</p>
                </div>

            </div>
        </div>
    );
};

export default CoachDiscoveryPage;