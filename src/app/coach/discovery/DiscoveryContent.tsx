'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { UserCheck } from 'lucide-react';
import { Button } from 'primereact/button';
import { coachService } from '@/app/service/coachService';
import knowledgeService, { type PublicTrainingPlanListItem } from '@/app/service/knowledgeService';
import { useRouter } from 'next/navigation';
import { useGuideStore } from '@/stores/useGuideStore';
import { useSession } from 'next-auth/react';
import { useToastContext } from '@/context/ToastContext';
import type { Product } from '@/app/api/coach/get-pricing/entity';
import DiscoveryHero from './sections/DiscoveryHero';
import CoachGridSection from './sections/CoachGridSection';
import ServiceGridSection from './sections/ServiceGridSection';
import FreePlansSection from './sections/FreePlansSection';
import HotActionsSection from './sections/HotActionsSection';
import ToolsSection from './sections/ToolsSection';
import GearSection from './sections/GearSection';
import ArticlesSection from './sections/ArticlesSection';
import type { DiscoveryCoach, ProductFeedItem, PublicArticleListItem } from './sections/types';

interface VisibilityStatus {
    focusMode: boolean;
    focusCoachId: string | null;
    focusCoachName: string | null;
    referrerCoachId: string | null;
    referrerCoachName: string | null;
}

const COACHES_PER_PAGE = 10;
const FEATURED_COACH_NAMES = ['枭马葛', '马葛', 'XM'];

const isFeaturedCoach = (name: string) => FEATURED_COACH_NAMES.some((n) => name.includes(n));

function DiscoveryContentInner() {
    const [coaches, setCoaches] = useState<DiscoveryCoach[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTrack, setSelectedTrack] = useState<string>('all');
    const router = useRouter();
    const { startGuide, hasCompletedGuide, isLoading: isGuideLoading } = useGuideStore();
    const { data: session, status: sessionStatus } = useSession();
    const { showToast } = useToastContext();

    const [productFeed, setProductFeed] = useState<ProductFeedItem[]>([]);
    const [productFeedLoading, setProductFeedLoading] = useState(false);

    const [visibilityStatus, setVisibilityStatus] = useState<VisibilityStatus | null>(null);
    const [visibilityLoading, setVisibilityLoading] = useState(true);

    const [articles, setArticles] = useState<PublicArticleListItem[]>([]);

    const [plans, setPlans] = useState<PublicTrainingPlanListItem[]>([]);
    const [planTotal, setPlanTotal] = useState<number | null>(null);
    const [plansLoading, setPlansLoading] = useState(true);

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
    }, [visibilityLoading, visibilityStatus, selectedTrack]);

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
                const items: ProductFeedItem[] = [];
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
            try {
                const res = await fetch('/api/public/articles/list?limit=6&offset=0');
                const json = await res.json();
                if (!cancelled && json?.data?.items) setArticles(json.data.items);
            } catch (e) {
                console.error('Failed to load articles', e);
            }
        };
        loadArticles();
        return () => { cancelled = true; };
    }, [visibilityLoading, visibilityStatus?.focusMode]);

    // 训练计划接口需要登录：游客不请求，计划区块隐藏，按钮改去计划库。
    useEffect(() => {
        if (sessionStatus === 'loading') return;
        if (sessionStatus !== 'authenticated') {
            setPlansLoading(false);
            return;
        }
        let cancelled = false;
        const loadPlans = async () => {
            try {
                const res = await knowledgeService.listTrainingPlans({ level: 'all', limit: 3, offset: 0 });
                if (!cancelled && res) {
                    setPlans(res.plans || []);
                    setPlanTotal(res.total || null);
                }
            } catch (e) {
                console.error('Failed to load training plans', e);
            } finally {
                if (!cancelled) setPlansLoading(false);
            }
        };
        loadPlans();
        return () => { cancelled = true; };
    }, [sessionStatus]);

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

    const loadCoaches = async (page: number) => {
        setIsLoading(true);
        try {
            if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
                const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId });
                if (res && res.coach) setCoaches([res.coach as DiscoveryCoach]);
                else setCoaches([]);
            } else {
                const res = await coachService.getAllCoaches({
                    page, limit: COACHES_PER_PAGE,
                    search: searchTerm || '',
                    specialty: 'all',
                    coachTrack: selectedTrack,
                    preferredCoachTrack: selectedTrack === 'all' ? 'buddy' : '',
                });
                if (res) setCoaches(res.coaches);
            }
        } finally { setIsLoading(false); }
    };

    const onSearch = () => {
        loadCoaches(1);
        document.getElementById('coaches')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // 创始人教练的方案排在最前面，其余按教练顺序。
    const serviceItems = useMemo(
        () => [
            ...productFeed.filter((p) => isFeaturedCoach(p.coach.name)),
            ...productFeed.filter((p) => !isFeaturedCoach(p.coach.name)),
        ],
        [productFeed],
    );

    const minPriceByCoach = useMemo(() => {
        const map: Record<string, number> = {};
        productFeed.forEach(({ coach, opt }) => {
            const price = Number(opt.price);
            if (!Number.isFinite(price)) return;
            if (map[coach.id] === undefined || price < map[coach.id]) map[coach.id] = price;
        });
        return map;
    }, [productFeed]);

    if (visibilityStatus?.focusMode) {
        return (
            <div className="min-h-screen py-8 px-4">
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
        <div className="min-h-screen pb-20">
            <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-4 pt-8 md:gap-16 md:px-6 md:pt-12">
                <DiscoveryHero
                    planCount={planTotal}
                    plansHref={plans.length > 0 ? '#plans' : '/dashboard/knowledge/training-plans'}
                    searchTerm={searchTerm}
                    onSearchTermChange={setSearchTerm}
                    onSearch={onSearch}
                />
                <CoachGridSection
                    coaches={coaches}
                    loading={isLoading}
                    selectedTrack={selectedTrack}
                    onSelectTrack={setSelectedTrack}
                    minPriceByCoach={minPriceByCoach}
                />
                <ServiceGridSection items={serviceItems} loading={productFeedLoading} />
                <FreePlansSection plans={plans} total={planTotal} loading={plansLoading} />
                <HotActionsSection />
                <ToolsSection />
                <ArticlesSection articles={articles} />
                <GearSection onSelect={() => showToast({ severity: 'info', summary: '商品详情', detail: '该商品即将上架，敬请期待' })} />
            </div>
        </div>
    );
}

export default DiscoveryContentInner;
