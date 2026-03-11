'use client';

import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
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
import FormattedActionText from '@/components/shared/FormattedActionText';

// 动态导入，避免首次加载时拉入 dashboard/me 下的重型组件
const PublicActionDetailDialog = dynamic(
  () => import('@/components/action-lib/PublicActionDetailDialog'),
  { ssr: false }
);

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

// 实体商品数据（用于过审展示）
interface PhysicalProduct {
    id: string;
    name: string;
    description: string;
    price: number;
    originalPrice?: number;
    imageUrl: string;
    category: string;
    badge?: string;
}

const PHYSICAL_PRODUCTS: PhysicalProduct[] = [
    {
        id: 'pp-1',
        name: '核心怪负重腰带',
        description: '专业力量训练腰带，加厚牛皮材质，稳固支撑腰部',
        price: 128,
        originalPrice: 198,
        imageUrl: '/images/products/weight-belt.png',
        category: '训练装备',
        badge: '热销',
    },
    {
        id: 'pp-2',
        name: '液态镁粉',
        description: '快干防滑配方，提升抓握力，适用于硬拉/引体等动作',
        price: 34,
        originalPrice: 44,
        imageUrl: '/images/products/liquid-chalk.png',
        category: '训练辅助',
    },
    {
        id: 'pp-3',
        name: '康比特乳清蛋白粉',
        description: '优质乳清蛋白，每份25g蛋白质，助力肌肉恢复',
        price: 134,
        originalPrice: 164,
        imageUrl: '/images/products/protein-powder.png',
        category: '营养补剂',
        badge: '推荐',
    },
    {
        id: 'pp-4',
        name: '深海鱼油软胶囊',
        description: '高纯度Omega-3，支持心血管健康，减少运动炎症',
        price: 64,
        originalPrice: 84,
        imageUrl: '/images/products/fish-oil.png',
        category: '营养补剂',
    },
];

// 骨架屏卡片组件
const ProductSkeletonCard = () => (
    <div className="w-[280px] md:w-[320px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100">
        <div className="flex items-start justify-between mb-3">
            <Skeleton width="80px" height="24px" className="rounded-full" />
            <Skeleton width="60px" height="28px" />
        </div>
        <Skeleton width="80%" height="20px" className="mb-2" />
        <Skeleton width="100%" height="32px" className="mb-4" />
        <div className="flex items-center gap-2 mb-4 pt-4 border-t border-surface-100">
            <Skeleton shape="circle" size="28px" />
            <Skeleton width="100px" height="16px" />
        </div>
        <Skeleton width="100%" height="40px" className="rounded-2xl" />
    </div>
);

const CoachSkeletonCard = () => (
    <div className="w-[180px] md:w-[220px] shrink-0 bg-surface-0 rounded-3xl p-4 md:p-5 border border-surface-100">
        <Skeleton width="100%" height="180px" className="rounded-2xl mb-3" />
        <Skeleton width="70%" height="18px" className="mb-1" />
        <Skeleton width="100%" height="14px" className="mb-3" />
        <div className="flex items-center gap-1.5 mb-3">
            <Skeleton width="60px" height="14px" />
        </div>
        <div className="flex gap-1.5">
            <Skeleton width="60px" height="24px" className="rounded-full" />
            <Skeleton width="50px" height="24px" className="rounded-full" />
        </div>
    </div>
);

const ActionSkeletonCard = () => (
    <div className="w-[220px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100">
        <Skeleton width="100%" height="40px" className="mb-4" />
        <div className="flex items-center justify-between">
            <Skeleton width="50px" height="16px" />
            <Skeleton width="80px" height="36px" className="rounded-2xl" />
        </div>
    </div>
);

function isVideoUrl(url: string | null | undefined) {
    if (!url) return false;
    const u = url.toLowerCase();
    return (
        u.endsWith('.mp4') ||
        u.endsWith('.webm') ||
        u.endsWith('.mov') ||
        u.endsWith('.m4v') ||
        u.includes('/videos/')
    );
}

const ArticleSkeletonCard = () => (
    <div className="w-[260px] md:w-[300px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100">
        <div className="flex items-center gap-2 mb-3">
            <Skeleton shape="circle" size="24px" />
            <Skeleton width="80px" height="14px" />
        </div>
        <Skeleton width="100%" height="36px" className="mb-2" />
        <Skeleton width="100%" height="32px" className="mb-4" />
        <div className="pt-4 border-t border-surface-100 flex items-center justify-between">
            <Skeleton width="80px" height="12px" />
            <Skeleton width="50px" height="12px" />
        </div>
    </div>
);

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

    const responsiveOptions = [
        { breakpoint: '1536px', numVisible: numVisible, numScroll: 1 },
        { breakpoint: '1280px', numVisible: Math.max(Math.floor(numVisible * 0.8), 3), numScroll: 1 },
        { breakpoint: '1024px', numVisible: Math.max(Math.floor(numVisible * 0.6), 2), numScroll: 1 },
        { breakpoint: '768px', numVisible: 2, numScroll: 1 },
        { breakpoint: '640px', numVisible: 1.5, numScroll: 1 },
        { breakpoint: '480px', numVisible: 1.2, numScroll: 1 }
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

function DiscoveryContentInner() {
    const [coaches, setCoaches] = useState<CoachesRow[]>([]);
    const [specialties, setSpecialties] = useState<{ label: string; value: string }[]>([{ label: '所有专长', value: 'all' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const coachesPerPage = 10;
    const router = useRouter();
    const { startGuide, hasCompletedGuide, isLoading: isGuideLoading } = useGuideStore();
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const { addToCart } = useCart();

    const categories = useMemo(
        () => [
            { title: '服务商品', desc: '订阅计划/服务', icon: Layers, href: '/market' },
            { title: '动作库', desc: '动作学习/添加', icon: Users, href: '/me/action-lib?tab=public' },
            { title: '找教练', desc: '专业认证教练', icon: UserCheck, href: '/coach/discovery?tab=coaches' },
            { title: '健身资讯', desc: '知识与实践', icon: BookOpen, href: '/articles' },
        ],
        [],
    );

    const [recommendedActions, setRecommendedActions] = useState<PublicActionItemDto[]>([]);
    const [recommendedLoading, setRecommendedLoading] = useState(false);
    const [actionDetailVisible, setActionDetailVisible] = useState(false);
    const [selectedAction, setSelectedAction] = useState<PublicActionItemDto | null>(null);

    const [productFeed, setProductFeed] = useState<Array<{ coach: CoachesRow; product: Product; opt: DurationOption }>>([]);
    const [productFeedLoading, setProductFeedLoading] = useState(false);

    const [visibilityStatus, setVisibilityStatus] = useState<VisibilityStatus | null>(null);
    const [visibilityLoading, setVisibilityLoading] = useState(true);

    const [articles, setArticles] = useState<PublicArticleListItem[]>([]);
    const [articlesLoading, setArticlesLoading] = useState(false);

    useEffect(() => {
        const fetchVisibilityStatus = async () => {
            try {
                const res = await fetch('/api/student/visibility-status');
                const json = await res.json();
                if (json.success && json.data) setVisibilityStatus(json.data);
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
        loadCoaches(1);
        loadSpecialties();
    }, [visibilityLoading, visibilityStatus]);

    useEffect(() => {
        if (visibilityLoading) return;
        if (visibilityStatus?.focusMode) {
            setRecommendedActions([]);
            return;
        }
        let cancelled = false;
        const loadRecommendedActions = async () => {
            setRecommendedLoading(true);
            try {
                const res = await publicActionLibService.listActions({ page: 1, limit: 9 });
                if (!cancelled) setRecommendedActions(res?.actions || []);
            } catch {
                if (!cancelled) setRecommendedActions([]);
            } finally {
                if (!cancelled) setRecommendedLoading(false);
            }
        };
        loadRecommendedActions();
        return () => { cancelled = true; };
    }, [visibilityLoading, visibilityStatus?.focusMode]);

    useEffect(() => {
        if (visibilityLoading) return;
        if (visibilityStatus?.focusMode) {
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
        return () => { cancelled = true; };
    }, [coaches, visibilityLoading, visibilityStatus?.focusMode]);

    useEffect(() => {
        if (visibilityLoading) return;
        if (visibilityStatus?.focusMode) return;
        let cancelled = false;
        const loadArticles = async () => {
            setArticlesLoading(true);
            try {
                const res = await fetch('/api/public/articles/list?limit=6&offset=0');
                const json = await res.json();
                if (!cancelled && json?.data?.items) setArticles(json.data.items);
            } catch (e) {
                console.error('Failed to load articles', e);
            } finally {
                if (!cancelled) setArticlesLoading(false);
            }
        };
        loadArticles();
        return () => { cancelled = true; };
    }, [visibilityLoading, visibilityStatus?.focusMode]);

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
                const formattedSpecialties = specialtiesData.map(specialty => ({ label: specialty.name, value: specialty.name }));
                setSpecialties([{ label: '所有专长', value: 'all' }, ...formattedSpecialties]);
            }
        } catch (e) { console.error(e); }
    };

    const loadCoaches = async (page: number) => {
        setIsLoading(true);
        try {
            if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
                const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId });
                if (res && res.coach) setCoaches([res.coach as CoachesRow]);
                else setCoaches([]);
            } else {
                const res = await coachService.getAllCoaches({
                    page, limit: coachesPerPage,
                    search: searchTerm || '', specialty: selectedSpecialty
                });
                if (res) setCoaches(res.coaches);
            }
        } finally { setIsLoading(false); }
    };

    const onSearchOrFilter = () => loadCoaches(1);

    const renderMiniCoachCard = (coach: CoachesRow & { studentCount?: number; averageRating?: number }) => (
        <div
            className="w-[180px] md:w-[220px] shrink-0 bg-surface-0 rounded-3xl p-4 md:p-5 border border-surface-100 hover:border-surface-200 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start"
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

    const renderProductCard = (item: { coach: CoachesRow; product: Product; opt: DurationOption }, idx: number, smallMode: boolean = false) => (
        <div
            className={`${smallMode ? 'w-full flex flex-col h-full bg-surface-0 rounded-3xl p-4 md:p-5 border border-surface-100 hover:border-surface-200 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer' : 'w-[280px] md:w-[320px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100 hover:border-surface-200 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start'} relative group`}
        >
            <div className={`flex items-start justify-between mb-3 ${smallMode ? 'text-xs' : ''}`}>
                <div className={`px-2.5 py-1 bg-primary-50 text-primary-700 font-black rounded-full border border-primary-100 ${smallMode ? 'text-[10px]' : 'text-[11px]'}`}>
                    {item.product.tier === 'basic' ? 'L1 基础版' : item.product.tier === 'standard' ? 'L2 进阶版' : 'L3 专业版'}
                </div>
                <div className={`${smallMode ? 'text-lg' : 'text-xl'} font-black text-primary-600 tracking-tight`}>¥{item.opt.price}</div>
            </div>
            <h3 className={`${smallMode ? 'text-sm' : 'text-base'} font-black text-surface-900 line-clamp-1 mb-2 tracking-tight`}>{item.product.name}</h3>
            {!smallMode && <p className="text-xs text-surface-500 font-medium line-clamp-2 h-8 mb-4">{item.product.description || "暂无描述"}</p>}
            <div className={`flex items-center gap-2 mb-4 pt-4 border-t border-surface-100 ${smallMode ? 'mt-auto' : ''}`}>
                <div className="w-7 h-7 rounded-full bg-surface-100 overflow-hidden shrink-0 border border-surface-200">
                    {item.coach.avatar_url ? <img src={item.coach.avatar_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[11px] font-bold text-surface-500">{item.coach.name[0]}</div>}
                </div>
                <span className="text-xs text-surface-700 font-bold truncate tracking-tight">{item.coach.name}</span>
            </div>
            <Button
                size="small"
                className={`w-full ${smallMode ? 'h-8 text-xs' : 'h-10'} rounded-2xl font-black bg-surface-900 border-none text-surface-0 hover:bg-surface-800 shadow-sm active:scale-95 transition-all`}
                label="订阅"
                onClick={() => {
                    const p = new URLSearchParams();
                    p.set('tab', '1'); p.set('from', 'discovery'); p.set('autoSubscribe', '1');
                    p.set('productId', item.product.id); p.set('months', String(item.opt.months));
                    router.push(`/coach/profile/${item.coach.id}?${p.toString()}#choose-pricing`);
                }}
            />
        </div>
    );

    const renderActionCard = (action: PublicActionItemDto) => (
        <div
            className="w-[220px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100 hover:border-surface-200 hover:-translate-y-0.5 active:scale-98 transition-all snap-start cursor-pointer"
            onClick={() => { setSelectedAction(action); setActionDetailVisible(true); }}
        >
            <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="text-sm font-black text-surface-900 line-clamp-2 min-h-[2.5em] tracking-tight">{action.name}</h3>
                {isVideoUrl(action.url) && <span className="shrink-0 px-2 py-0.5 bg-primary-50 text-primary-700 text-[10px] font-black rounded-full border border-primary-100">视频</span>}
            </div>
            <FormattedActionText
                text={action.detail}
                className="text-xs text-surface-500 font-medium min-h-[2.5em] mb-3"
                lineClampClassName="line-clamp-2"
            />
            <div className="flex items-center justify-between">
                <span className="text-xs text-surface-500 font-bold">{action.like_count || 0} 赞</span>
                <Button
                    label={action.isAdded ? "已添加" : "添加"}
                    size="small"
                    className={`h-9 px-4 rounded-2xl font-black text-xs border ${action.isAdded ? 'bg-surface-100 border-surface-200 text-surface-400 cursor-not-allowed' : 'bg-surface-900 border-surface-900 text-surface-0 hover:bg-surface-800 active:scale-95'} transition-all`}
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
                            setRecommendedActions((prev) => prev.map((x) => (x.id === action.id ? { ...x, isAdded: true } : x)));
                        } catch {}
                    }}
                />
            </div>
        </div>
    );

    const renderArticleCard = (article: PublicArticleListItem) => (
        <div
            className="w-[260px] md:w-[300px] shrink-0 bg-surface-0 rounded-3xl p-5 border border-surface-100 hover:border-surface-200 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start flex flex-col justify-between"
            onClick={() => router.push(`/coach/content/${article.id}`)}
        >
            <div>
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-surface-100 overflow-hidden shrink-0 border border-surface-200">
                        {article.coachAvatarUrl ? <img src={article.coachAvatarUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-surface-500">{article.coachName?.[0]}</div>}
                    </div>
                    <span className="text-xs text-surface-600 font-bold truncate max-w-[120px] tracking-tight">{article.coachName}</span>
                    {article.priceCents > 0 && <span className="ml-auto px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-black rounded-full border border-amber-100">付费</span>}
                </div>
                <h3 className="text-sm font-black text-surface-900 line-clamp-2 leading-snug mb-2 min-h-[2.5em] tracking-tight">{article.title}</h3>
                <p className="text-xs text-surface-500 font-medium line-clamp-2 h-8 mb-0">{article.summary || "暂无简介"}</p>
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

    const renderPhysicalProductCard = (product: PhysicalProduct, smallMode: boolean = false) => (
        <div
            className={`${smallMode ? 'w-full aspect-[4/5]' : 'w-[280px] md:w-[320px] shrink-0'} bg-surface-0 rounded-3xl p-4 md:p-5 border border-surface-100 hover:border-surface-200 hover:-translate-y-0.5 active:scale-98 transition-all cursor-pointer snap-start flex flex-col`}
            onClick={() => showToast({ severity: 'info', summary: '商品详情', detail: '该商品即将上架，敬请期待' })}
        >
            <div className={`w-full aspect-square mb-3 rounded-2xl bg-surface-50 border border-surface-100 overflow-hidden relative ${smallMode ? 'p-2' : ''}`}>
                <img src={product.imageUrl} alt={product.name} className="w-full h-full object-contain mix-blend-multiply" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                {product.badge && <div className="absolute top-2 right-2 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-black rounded-full">{product.badge}</div>}
            </div>
            {!smallMode && <div className="mb-2"><span className="px-2 py-0.5 bg-surface-50 text-surface-500 text-[10px] font-bold rounded-full border border-surface-100">{product.category}</span></div>}
            <h3 className={`text-sm font-black text-surface-900 line-clamp-1 mb-1 tracking-tight ${smallMode ? 'text-xs' : ''}`}>{product.name}</h3>
            {!smallMode && <p className="text-xs text-surface-500 font-medium line-clamp-2 h-8 mb-3">{product.description}</p>}
            <div className="mt-auto flex items-baseline gap-1.5">
                <span className={`${smallMode ? 'text-base' : 'text-lg'} font-black text-primary-600`}>¥{product.price}</span>
                {product.originalPrice && <span className="text-[10px] text-surface-400 line-through">¥{product.originalPrice}</span>}
            </div>
        </div>
    );

    if (visibilityStatus?.focusMode) {
        return (
            <div className="min-h-screen bg-surface-50 py-8 px-4">
                <div className="max-w-6xl mx-auto">
                    <header className="mb-10">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="w-16 h-16 bg-surface-0 rounded-3xl flex items-center justify-center border border-surface-100">
                                <UserCheck className="text-surface-800 stroke-[2.5]" size={28} />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black text-surface-900 tracking-tight">我的专属教练</h1>
                                <p className="text-sm text-surface-600 font-medium mt-1">专注模式已开启</p>
                            </div>
                        </div>
                    </header>
                    <div className="space-y-4">
                        {coaches.map((c) => (
                            <div key={c.id} className="bg-surface-0 p-6 rounded-3xl border border-surface-100 hover:border-surface-200 transition-all">
                                <h3 className="text-lg font-black text-surface-900 tracking-tight mb-2">{c.name}</h3>
                                {c.bio && <p className="text-sm text-surface-600 font-medium mb-4">{c.bio}</p>}
                                <Button label="查看详情" onClick={() => router.push('/coach/profile/' + c.id)} className="rounded-2xl font-black h-10 bg-surface-900 border-none text-surface-0 hover:bg-surface-800 shadow-sm active:scale-95 transition-all" size="small" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50 pb-20">
            <div className="bg-surface-50 sticky top-0 z-30 pt-safe-top">
                <div className="px-4 py-4 flex items-center gap-3 max-w-6xl mx-auto">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-500" />
                        <InputText value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') onSearchOrFilter(); }} placeholder="搜索教练 / 专长 / 计划" className="w-full pl-10 h-11 rounded-2xl border-0 bg-surface-50 focus:bg-surface-100 focus:ring-0 text-sm font-medium transition-colors" />
                    </div>
                    {session?.user ? (
                        <button className="w-11 h-11 flex items-center justify-center rounded-2xl bg-surface-50 text-surface-700 hover:bg-surface-100 active:scale-95 transition-all" onClick={() => router.push('/me/cart')}>
                            <ShoppingCart size={18} />
                        </button>
                    ) : (
                        <Button label="登录" size="small" onClick={() => router.push('/login')} className="h-11 rounded-2xl font-bold bg-surface-50 text-surface-900 border-0 hover:bg-surface-100 active:scale-95 transition-all md:hidden" />
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 pt-2">
                <div className="grid grid-cols-4 gap-4 mb-10">
                    {categories.map((c) => (
                        <button key={c.href} onClick={() => router.push(c.href)} className="flex flex-col items-center gap-3 group">
                            <div className="w-16 h-16 md:w-18 md:h-18 rounded-3xl flex items-center justify-center bg-surface-0 text-surface-800 border border-surface-100 group-hover:bg-surface-50 group-hover:text-surface-900 group-hover:border-surface-200 group-active:scale-95 transition-all">
                                <c.icon size={26} className="stroke-[2.5]" />
                            </div>
                            <span className="text-xs font-black text-surface-900 tracking-tight">{c.title}</span>
                        </button>
                    ))}
                </div>

                {productFeedLoading ? (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">服务商品</h2>
                        <div className="flex gap-4 overflow-hidden px-2">{[1,2,3].map(i => <ProductSkeletonCard key={i} />)}</div>
                    </div>
                ) : (
                    <div className="mb-10">
                        <div className="flex items-center justify-between mb-5 px-1">
                            <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight">服务商品</h2>
                            <button onClick={() => router.push('/market')} className="flex items-center gap-1 text-xs md:text-sm font-bold text-surface-500 hover:text-surface-900 active:scale-95 transition-all">
                                <span>查看更多</span><ChevronRight size={16} className="stroke-[2.5]" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {(() => {
                                const xiaoMaGePlans = productFeed.filter(p => p.coach.name.includes('枭马葛') || p.coach.name.includes('马葛') || p.coach.name.includes('XM')).map((item, idx) => ({ ...item, _type: 'virtual' as const, _key: `xm-${idx}` }));
                                const otherPlans = productFeed.filter(p => !p.coach.name.includes('枭马葛') && !p.coach.name.includes('马葛') && !p.coach.name.includes('XM')).map((item, idx) => ({ ...item, _type: 'virtual' as const, _key: `virtual-${idx}` }));
                                const physicalItems = PHYSICAL_PRODUCTS.map((p, idx) => ({ _type: 'physical' as const, _key: `physical-${idx}`, product: p }));
                                const remainingMixed: any[] = [];
                                const maxLen = Math.max(otherPlans.length, physicalItems.length);
                                for (let i = 0; i < maxLen; i++) {
                                    if (i < physicalItems.length) remainingMixed.push(physicalItems[i]);
                                    if (i < otherPlans.length) remainingMixed.push(otherPlans[i]);
                                }
                                const finalItems = [...xiaoMaGePlans, ...remainingMixed].slice(0, 10);
                                return finalItems.map((item) => {
                                    if (item._type === 'physical') return React.cloneElement(renderPhysicalProductCard(item.product, true) as React.ReactElement, { key: item._key });
                                    return React.cloneElement(renderProductCard(item, -1, true) as React.ReactElement, { key: item._key });
                                });
                            })()}
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">推荐教练</h2>
                        <div className="flex gap-4 overflow-hidden px-2">{[1,2,3,4].map(i => <CoachSkeletonCard key={i} />)}</div>
                    </div>
                ) : coaches.length > 0 ? (
                    <CarouselSection title="推荐教练" moreLink="/search" items={coaches} itemTemplate={(coach) => renderMiniCoachCard(coach as any)} numVisible={4} />
                ) : (
                    <div className="mb-10">
                        <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">推荐教练</h2>
                        <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">暂无推荐教练</div>
                    </div>
                )}

                {!visibilityStatus?.focusMode && (
                    recommendedLoading ? (
                        <div className="mb-10">
                            <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">热门动作</h2>
                            <div className="flex gap-4 overflow-hidden px-2">{[1,2,3,4,5].map(i => <ActionSkeletonCard key={i} />)}</div>
                        </div>
                    ) : recommendedActions.length > 0 ? (
                        <CarouselSection title="热门动作" moreLink="/me/action-lib?tab=public" items={recommendedActions} itemTemplate={(action) => renderActionCard(action)} numVisible={5} />
                    ) : (
                        <div className="mb-10">
                            <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">热门动作</h2>
                            <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">暂无推荐动作</div>
                        </div>
                    )
                )}

                {!visibilityStatus?.focusMode && (
                    articlesLoading ? (
                        <div className="mb-10">
                            <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">健身资讯</h2>
                            <div className="flex gap-4 overflow-hidden px-2">{[1,2,3].map(i => <ArticleSkeletonCard key={i} />)}</div>
                        </div>
                    ) : articles.length > 0 ? (
                        <CarouselSection title="健身资讯" moreLink="/articles" items={articles} itemTemplate={(article) => renderArticleCard(article)} numVisible={3} />
                    ) : (
                        <div className="mb-10">
                            <h2 className="text-xl md:text-2xl font-black text-surface-900 tracking-tight mb-5 px-1">健身资讯</h2>
                            <div className="w-full py-12 text-center text-surface-400 text-sm font-medium bg-surface-50 rounded-3xl border border-dashed border-surface-200">暂无最新资讯</div>
                        </div>
                    )
                )}

                <div className="py-12 text-center">
                    <div className="inline-flex items-center justify-center w-14 h-14 bg-surface-0 rounded-3xl mb-4 border border-surface-100">
                        <Star size={20} className="text-surface-700 fill-surface-700" />
                    </div>
                    <p className="text-sm text-surface-500 font-bold tracking-tight">让小白到高手都能有所收获</p>
                </div>
            </div>

            <PublicActionDetailDialog
                visible={actionDetailVisible}
                action={selectedAction}
                onHide={() => { setActionDetailVisible(false); setSelectedAction(null); }}
                viewerActionType="student"
            />
        </div>
    );
}

export default DiscoveryContentInner;
