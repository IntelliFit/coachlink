'use client';

import React, { useState, useEffect } from 'react';
import { Star, Users, Clock, Crown, Eye, Search, ArrowRight, UserCheck, HelpCircle, Filter, ShoppingCart, Package } from 'lucide-react';
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

interface VisibilityStatus {
    focusMode: boolean;
    focusCoachId: string | null;
    focusCoachName: string | null;
    referrerCoachId: string | null;
    referrerCoachName: string | null;
}

const CoachDiscoveryPage: React.FC = () => {
    const [coaches, setCoaches] = useState<CoachesRow[]>([]);
    const [specialties, setSpecialties] = useState<{ label: string; value: string }[]>([{ label: '所有专长', value: 'all' }]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
    const [totalCount, setTotalCount] = useState(0);
    const [first, setFirst] = useState(0);
    const coachesPerPage = 10;
    const router = useRouter();
    const { startGuide, hasCompletedGuide, isLoading: isGuideLoading } = useGuideStore();
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const { addToCart } = useCart();

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
                // 静默失败：不影响核心发现教练流程
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
            // 专注模式不展示混合商品流，避免干扰
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
                // 只取前 N 位教练做“推荐商品”，避免 N+1 过重
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

                // 兜底：如果暂时没拿到任何产品，就不展示商品区块
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

    // Auto start guide once after list is available (action-oriented, not just nav overview)
    useEffect(() => {
        if (isLoading) return;
        if (!coaches || coaches.length === 0) return;
        if (isGuideLoading) return;
        if (hasCompletedGuide('student_find_coach')) return;
        // 专注模式下不显示发现教练的引导
        if (visibilityStatus?.focusMode) return;
        const t = setTimeout(() => startGuide('STUDENT_FIND_COACH_GUIDE'), 600);
        return () => clearTimeout(t);
    }, [isLoading, coaches, hasCompletedGuide, startGuide, isGuideLoading, visibilityStatus]);

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
            // 如果处于专注模式，只加载专注的教练
            if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
                const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId });
                if (res && res.coach) {
                    setCoaches([res.coach as CoachesRow]);
                    setTotalCount(1);
                } else {
                    setCoaches([]);
                    setTotalCount(0);
                }
            } else {
                const res = await coachService.getAllCoaches({
                    page: page, limit: coachesPerPage,
                    search: searchTerm || '', specialty: selectedSpecialty
                });
                if (res) {
                    setCoaches(res.coaches);
                    setTotalCount(res.count);
                }
            }
        } finally { setIsLoading(false); }
    };

    const onSearchOrFilter = () => {
        setFirst(0);
        loadCoaches(1);
    };

    const renderCoachCard = (coach: CoachesRow & { studentCount?: number; averageRating?: number }, idx: number) => (
        <div
            key={coach.id}
            id={idx === 0 ? "guide-discovery-first-coach" : undefined}
            className="group bg-surface-0 rounded-[24px] md:rounded-2xl p-4 md:p-5 mb-4 transition-all active:scale-[0.98] md:active:scale-100 md:hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-surface-100 cursor-pointer"
            onClick={() => router.push('/coach/profile/' + coach.id + '?from=discovery')}
        >
            <div className="flex flex-row gap-4 md:gap-6">
                {/* 头像区：移动端缩小，PC保持 */}
                <div className="relative shrink-0">
                    <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-xl overflow-hidden bg-surface-50 border border-surface-100/50 shadow-inner">
                        {coach.avatar_url ? (
                            <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-xl font-black text-primary-500 bg-primary-50/30">
                                {coach.name.charAt(0)}
                            </div>
                        )}
                    </div>
                    {coach.is_featured && (
                        <div className="absolute -top-1.5 -left-1.5 bg-amber-400 text-white p-1 rounded-lg shadow-sm">
                            <Crown size={12} fill="currentColor" />
                        </div>
                    )}
                </div>

                {/* 内容区 */}
                <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                        <div className="flex items-start justify-between">
                            <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base md:text-lg font-bold text-surface-900 tracking-tight truncate">
                                        {coach.name}
                                    </h3>
                                    <div className="flex items-center gap-0.5 text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-md">
                                        <Star size={12} fill="currentColor" />
                                        <span className="text-xs font-black">
                                            {typeof coach.averageRating === 'number' ? coach.averageRating.toFixed(1) : (coach.rating ?? '0.0')}
                                        </span>
                                    </div>
                                </div>
                                {/* 移动端显示的副标题/简介，精简信息 */}
                                <p className="text-surface-400 text-xs md:text-sm font-medium line-clamp-1 mb-2">
                                    {coach.bio || "专业健身教练"}
                                </p>
                            </div>

                            {/* 价格中心化：移动端显示更精简 */}
                            {typeof (coach as any).subscription_price_tier1 === 'number' && (
                                <div className="flex flex-col items-end shrink-0">
                                    <span className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">起价</span>
                                    <span className="text-base md:text-xl font-black text-primary-600">
                                        ¥{(coach as any).subscription_price_tier1}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* 标签组：移动端横向排列，不强制牺牲空间 */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {coach.specialties?.slice(0, 3).map((spec, i) => (
                                <span key={i} className="px-2 py-0.5 bg-surface-50 text-surface-600 text-[10px] md:text-xs font-bold rounded-md border border-surface-100">
                                    {spec}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* 底部数据：辅助信息弱化 */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-surface-400 text-[10px] md:text-xs font-bold uppercase tracking-wide">
                            <div className="flex items-center gap-1">
                                <Users size={12} className="opacity-70" />
                                <span>{coach.studentCount || 0} 学员</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Clock size={12} className="opacity-70" />
                                <span>{coach.years_experience || 0} 年经验</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // 专注模式下显示不同的界面
    if (visibilityStatus?.focusMode) {
        return (
            <div className="min-h-screen bg-surface-50/50 py-8 px-4">
                <div className="max-w-5xl mx-auto">
                    {/* 专属教练头部 */}
                    <header className="mb-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-primary-50 rounded-lg">
                                <UserCheck className="text-primary-500" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-surface-900 tracking-tight">我的专属教练</h1>
                                <p className="text-surface-500 text-sm mt-1 font-medium">
                                    您通过 {visibilityStatus.focusCoachName || '教练'} 的邀请加入平台
                                </p>
                            </div>
                        </div>
                    </header>

                    {/* 教练卡片 */}
                    {isLoading || visibilityLoading ? (
                        <div className="bg-surface-0 rounded-lg p-6 border border-surface-100">
                            <div className="flex gap-4">
                                <Skeleton shape="rectangle" size="5rem" className="rounded-lg shrink-0" />
                                <div className="flex-1 space-y-3">
                                    <Skeleton width="30%" height="1.2rem" />
                                    <Skeleton width="100%" height="2rem" />
                                </div>
                            </div>
                        </div>
                    ) : coaches.length > 0 ? (
                        coaches.map((c, idx) => renderCoachCard(c as any, idx))
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-surface-0 rounded-lg border border-surface-100">
                            <Eye size={40} className="text-surface-200 mb-3" />
                            <p className="text-surface-500 font-bold">教练信息加载失败</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-surface-50/50 py-4 md:py-8 px-4">
            <div className="max-w-5xl mx-auto">
                {/* 头部标题区 */}
                <header className="mb-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-surface-900 tracking-tight">发现教练</h1>
                            <p className="text-surface-500 text-sm mt-1">找到最适合你的专业健身伙伴</p>
                        </div>
                        <Button
                            icon="pi pi-question-circle"
                            label={window.innerWidth < 768 ? "" : "新手引导"}
                            outlined
                            size="small"
                            onClick={() => !isGuideLoading && startGuide('STUDENT_FIND_COACH_GUIDE', true)}
                            disabled={isGuideLoading}
                            className="shrink-0 rounded-2xl border-primary-500 text-primary-500"
                        />
                    </div>

                    {/* 搜索与筛选区域 - 响应式单行布局 */}
                    <div className="mt-6 flex items-center gap-2 p-1.5 bg-surface-0 dark:bg-surface-50 rounded-2xl md:rounded-2xl shadow-sm border border-surface-100">
                        {/* 搜索输入框 */}
                        <div id="guide-discovery-search" className="flex-1 relative flex items-center">
                            <InputText
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索姓名或专长..."
                                className="w-full border-none shadow-none bg-transparent py-2 text-surface-700"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            {/* 筛选区域 */}
                            <div id="guide-discovery-filter">
                                {/* PC端：保持文字显示 */}
                                <Dropdown
                                    value={selectedSpecialty}
                                    options={specialties}
                                    onChange={(e) => setSelectedSpecialty(e.value)}
                                    className="hidden md:flex w-44 bg-surface-50 border-none rounded-lg items-center"
                                    pt={{
                                        input: { className: 'py-2 px-3 text-sm font-medium text-surface-600' }
                                    }}
                                />
                                {/* 移动端：图标化筛选，宽度收缩 */}
                                <Dropdown
                                    value={selectedSpecialty}
                                    options={specialties}
                                    onChange={(e) => setSelectedSpecialty(e.value)}
                                    className="flex md:hidden bg-surface-50 border-none rounded-xl w-10 h-10 items-center justify-center"
                                    dropdownIcon={() => <Filter size={16} className="text-surface-500" />}
                                    pt={{
                                        input: { className: 'hidden' },
                                        trigger: { className: 'w-full h-full' }
                                    }}
                                />
                            </div>

                            {/* 搜索按钮 */}
                            {/* PC端：文字按钮 */}
                            <Button
                                onClick={onSearchOrFilter}
                                label="搜索"
                                className="hidden md:flex bg-primary-500 border-none px-6 py-2 rounded-xl font-bold text-white shadow-sm"
                            />
                            {/* 移动端：图标按钮 */}
                            <Button
                                onClick={onSearchOrFilter}
                                icon="pi pi-search"
                                className="flex md:hidden bg-primary-500 border-none w-10 h-10 rounded-xl font-bold text-white shadow-sm active:scale-95"
                            />
                        </div>
                    </div>
                </header>

                {/* 混合流：推荐服务商品（类似电商首页的“推荐商品”区块） */}
                <div className="mb-6">
                    <div className="rounded-[24px] border border-surface-100 bg-surface-0 p-4 md:p-5">
                        <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                            <div className="min-w-0">
                                <div className="text-xs font-black uppercase tracking-widest text-surface-400">服务商品</div>
                                <div className="mt-1 text-lg font-black text-surface-900 tracking-tight">
                                    推荐订阅/计划服务
                                </div>
                                <div className="mt-1 text-sm text-surface-500 font-medium">
                                    先挑服务再看教练，或直接去服务商品页查看更多（购买需登录）。
                                </div>
                            </div>
                            <div className="shrink-0 flex gap-2">
                                <Button
                                    text
                                    severity="secondary"
                                    size="small"
                                    className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                                    label="去服务商品页"
                                    icon="pi pi-arrow-right"
                                    iconPos="right"
                                    onClick={() => router.push('/market')}
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            {productFeedLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {[1, 2, 3].map((i) => (
                                        <div key={i} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                            <Skeleton width="60%" height="1rem" className="mb-2" />
                                            <Skeleton width="100%" height="2.5rem" className="mb-3" />
                                            <Skeleton width="40%" height="1rem" />
                                        </div>
                                    ))}
                                </div>
                            ) : productFeed.length === 0 ? (
                                <div className="py-10 text-center bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                                    <Package className="w-10 h-10 text-surface-200 mx-auto mb-2" />
                                    <div className="text-sm font-bold text-surface-700">暂无可推荐的服务商品</div>
                                    <div className="text-xs text-surface-500 mt-1">你也可以先从下方列表发现教练</div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {productFeed.map((it, idx) => (
                                        <div key={`${it.coach.id}-${it.product.id}-${idx}`} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <div className="text-sm font-black text-surface-900 line-clamp-1">
                                                        {it.product.name}
                                                    </div>
                                                    <div className="mt-1 text-xs text-surface-500 font-medium line-clamp-1">
                                                        教练：{it.coach.name}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">起价</div>
                                                    <div className="text-base font-black text-primary-600">¥{it.opt.price}</div>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex items-center justify-between gap-2">
                                                <Button
                                                    outlined
                                                    size="small"
                                                    className="rounded-2xl border-primary-200 text-primary-700 hover:bg-primary-50 active:scale-[0.98] transition-all font-bold"
                                                    label="订阅"
                                                    onClick={() => {
                                                        const p = new URLSearchParams();
                                                        p.set('tab', '1'); // 订阅价格现在在第二栏（index 1）
                                                        p.set('from', 'discovery');
                                                        p.set('autoSubscribe', '1');
                                                        p.set('productId', it.product.id);
                                                        p.set('months', String(it.opt.months));
                                                        router.push(`/coach/profile/${it.coach.id}?${p.toString()}#choose-pricing`);
                                                    }}
                                                />
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        text
                                                        severity="secondary"
                                                        size="small"
                                                        className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                                                        icon={<ShoppingCart size={18} />}
                                                        onClick={async () => {
                                                            if (!session?.user?.id) {
                                                                router.push(`/login?redirect=${encodeURIComponent('/coach/discovery')}`);
                                                                return;
                                                            }
                                                            try {
                                                                await addToCart({
                                                                    coachId: it.coach.id,
                                                                    coachName: it.coach.name || '教练',
                                                                    productId: it.product.id,
                                                                    productName: it.product.name,
                                                                    productTier: it.product.tier,
                                                                    durationMonths: it.opt.months,
                                                                    price: it.opt.price,
                                                                });
                                                                showToast({ severity: 'success', summary: '已加入购物车' });
                                                            } catch (e: any) {
                                                                showToast({ severity: 'error', summary: '添加失败', detail: e?.message || '请稍后重试' });
                                                            }
                                                        }}
                                                        tooltip="加入购物车"
                                                        tooltipOptions={{ position: 'top' }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 推荐动作：公共动作库（增长入口） */}
                {!visibilityStatus?.focusMode && (
                    <div className="mb-6">
                        <div className="rounded-[24px] border border-surface-100 bg-surface-0 p-4 md:p-5">
                            <div className="flex items-start md:items-center justify-between gap-4 flex-col md:flex-row">
                                <div className="min-w-0">
                                    <div className="text-xs font-black uppercase tracking-widest text-surface-400">公共动作库</div>
                                    <div className="mt-1 text-lg font-black text-surface-900 tracking-tight">
                                        推荐动作
                                    </div>
                                    <div className="mt-1 text-sm text-surface-500 font-medium">
                                        发现大家都在用的动作，一键加入你的动作库。
                                    </div>
                                </div>
                                <div className="shrink-0 flex gap-2">
                                    <Button
                                        outlined
                                        className="rounded-2xl"
                                        label="去动作库"
                                        onClick={() => router.push('/me/action-lib')}
                                    />
                                </div>
                            </div>

                            <div className="mt-4">
                                {recommendedLoading ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {[1, 2, 3].map((i) => (
                                            <div key={i} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                                <Skeleton width="60%" height="1rem" className="mb-2" />
                                                <Skeleton width="100%" height="2.5rem" className="mb-3" />
                                                <Skeleton width="40%" height="1rem" />
                                            </div>
                                        ))}
                                    </div>
                                ) : recommendedActions.length === 0 ? (
                                    <div className="py-10 text-center bg-surface-50 rounded-2xl border border-dashed border-surface-200">
                                        <Package className="w-10 h-10 text-surface-200 mx-auto mb-2" />
                                        <div className="text-sm font-bold text-surface-700">暂无推荐动作</div>
                                        <div className="text-xs text-surface-500 mt-1">你可以先去动作库贡献或收藏</div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {recommendedActions.map((a) => (
                                            <div key={a.id} className="rounded-2xl border border-surface-100 bg-surface-50 p-4">
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-black text-surface-900 line-clamp-1">
                                                            {a.name}
                                                        </div>
                                                        <div className="mt-1 text-xs text-surface-500 font-medium line-clamp-2">
                                                            {a.detail || '暂无描述'}
                                                        </div>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <div className="text-[10px] text-surface-400 font-bold uppercase tracking-wider">点赞</div>
                                                        <div className="text-base font-black text-primary-600">{a.like_count || 0}</div>
                                                    </div>
                                                </div>

                                                <div className="mt-3 flex gap-2">
                                                    <Button
                                                        className="flex-1 rounded-2xl bg-primary-500 border-none font-bold"
                                                        label={a.isAdded ? '已加入' : '一键加入'}
                                                        disabled={a.isAdded}
                                                        onClick={async () => {
                                                            if (!session?.user?.id) {
                                                                router.push(`/login?redirect=${encodeURIComponent('/coach/discovery')}`);
                                                                return;
                                                            }
                                                            try {
                                                                await publicActionLibService.addToMyLib({ actionId: a.id });
                                                                showToast({ severity: 'success', summary: '已加入动作库' });
                                                                setRecommendedActions((prev) =>
                                                                    prev.map((x) => (x.id === a.id ? { ...x, isAdded: true } : x)),
                                                                );
                                                            } catch (e: any) {
                                                                showToast({ severity: 'error', summary: '加入失败', detail: e?.message || '请稍后重试' });
                                                            }
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs font-bold text-surface-400 tracking-wider">
                        共找到 {totalCount} 位教练
                    </div>
                </div>

                {/* 列表内容区 */}
                {isLoading || visibilityLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface-0 rounded-xl p-6 border border-surface-100">
                                <div className="flex gap-4">
                                    <Skeleton shape="rectangle" size="5rem" className="rounded-lg shrink-0" />
                                    <div className="flex-1 space-y-3">
                                        <Skeleton width="30%" height="1.2rem" />
                                        <Skeleton width="100%" height="2rem" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : coaches.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface-0 rounded-xl border border-surface-100">
                        <Eye size={40} className="text-surface-200 mb-3" />
                        <p className="text-surface-500 font-bold">没有找到相关教练</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {coaches.map((c, idx) => (
                            <div key={idx} id={idx === 0 ? "guide-discovery-first-coach" : undefined}>
                                {renderCoachCard(c as any, idx)}
                            </div>
                        ))}
                        <Paginator
                            first={first}
                            rows={coachesPerPage}
                            totalRecords={totalCount}
                            onPageChange={(e) => {
                                setFirst(e.first);
                                loadCoaches(e.page + 1);
                            }}
                            className="bg-transparent border-none py-8"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoachDiscoveryPage;