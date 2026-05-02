'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
    Activity,
    CheckCircle2,
    ChevronRight,
    CircleDashed,
    FileText,
    Layout,
    Library,
    Loader2,
    Star,
    TrendingUp,
    Users,
    Video,
} from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';

interface OverviewData {
    totalStudentCount: number;
    pendingReviewCount: number;
    averageRating: number;
    monthlyRevenue: number;
    contentCount: number;
    actionCount: number;
    planTemplateCount: number;
    questionReady: boolean;
    pricingReady: boolean;
}

interface CardLinkProps {
    children: React.ReactNode;
    href?: string;
}

const CardLink = ({ children, href }: CardLinkProps) => {
    if (!href) {
        return <div className="group">{children}</div>;
    }

    return (
        <Link href={href} className="group block">
            {children}
        </Link>
    );
};

interface MetricCardProps {
    title: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    loading: boolean;
    href?: string;
}

const MetricCard = ({
    title,
    value,
    icon: Icon,
    colorClass,
    loading,
    href,
}: MetricCardProps) => (
    <CardLink href={href}>
        <div className="rounded-3xl border border-surface-200 bg-white px-4 py-4 transition hover:border-primary-300 hover:shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between">
                <div className={`rounded-2xl p-3 ${colorClass}`}>
                    <Icon className="h-5 w-5" />
                </div>
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-surface-300" />
                ) : href ? (
                    <ChevronRight className="h-4 w-4 text-surface-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500" />
                ) : null}
            </div>

            <div className="mt-5">
                <div className="text-xs font-bold uppercase tracking-[0.16em] text-surface-400">
                    {title}
                </div>
                <div className="mt-2 text-2xl font-black tracking-tight text-surface-900">
                    {loading ? <Skeleton width="5rem" height="2rem" /> : value}
                </div>
            </div>
        </div>
    </CardLink>
);

interface StatusCardProps {
    title: string;
    description: string;
    value: string | number;
    icon: React.ComponentType<{ className?: string }>;
    colorClass: string;
    loading: boolean;
    href?: string;
    isComplete?: boolean;
}

const StatusCard = ({
    title,
    description,
    value,
    icon: Icon,
    colorClass,
    loading,
    href,
    isComplete,
}: StatusCardProps) => (
    <CardLink href={href}>
        <div className="flex items-center gap-3 rounded-3xl border border-surface-200 bg-white px-4 py-4 transition hover:border-primary-300 hover:shadow-[0_12px_36px_rgba(15,23,42,0.06)]">
            <div className={`rounded-2xl p-3 ${colorClass}`}>
                <Icon className="h-5 w-5" />
            </div>

            <div className="min-w-0 flex-1">
                <div className="text-sm font-black text-surface-900">{title}</div>
                <div className="mt-1 text-xs text-surface-500">{description}</div>
            </div>

            <div className="flex items-center gap-2">
                {loading ? (
                    <Skeleton width="4rem" height="1.25rem" />
                ) : (
                    <span className="text-sm font-black text-surface-900">{value}</span>
                )}
                {isComplete && !loading ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600">
                        已就绪
                    </span>
                ) : null}
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-surface-300" />
                ) : href ? (
                    <ChevronRight className="h-4 w-4 text-surface-300 transition group-hover:translate-x-0.5 group-hover:text-primary-500" />
                ) : null}
            </div>
        </div>
    </CardLink>
);

const Overview = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadOverviewData = async () => {
            if (!coach?.id) return;

            try {
                const data = await coachService.getOverviewData({ coachId: coach.id });
                if (data) {
                    setOverviewData(data);
                }
            } catch (error) {
                console.error('加载概览数据失败:', error);
            } finally {
                setLoading(false);
            }
        };

        void loadOverviewData();
    }, [coach?.id]);

    const coachName = useMemo(() => {
        return coach?.name || '教练';
    }, [coach?.name]);

    const coreStats = [
        {
            title: '总学员数',
            value: overviewData?.totalStudentCount || 0,
            icon: Users,
            colorClass: 'bg-blue-50 text-blue-600',
            href: '/dashboard/students',
        },
        {
            title: '待点评视频',
            value: overviewData?.pendingReviewCount || 0,
            icon: Video,
            colorClass: 'bg-amber-50 text-amber-600',
            href: '/dashboard/videos',
        },
        {
            title: '平均评分',
            value: overviewData?.averageRating?.toFixed(1) || '0.0',
            icon: Star,
            colorClass: 'bg-yellow-50 text-yellow-600',
        },
        {
            title: '本月收入',
            value: `¥${overviewData?.monthlyRevenue?.toLocaleString() || 0}`,
            icon: TrendingUp,
            colorClass: 'bg-emerald-50 text-emerald-600',
            href: '/dashboard/revenue',
        },
    ];

    const setupCards = [
        {
            title: '订阅定价',
            description: '设置你的会员方案与收费节奏',
            value: overviewData?.pricingReady ? '已激活' : '待配置',
            icon: overviewData?.pricingReady ? CheckCircle2 : CircleDashed,
            colorClass: overviewData?.pricingReady ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
            href: '/dashboard/pricing',
            isComplete: overviewData?.pricingReady,
        },
        {
            title: '学员问卷',
            description: '收集目标、训练背景和约束条件',
            value: overviewData?.questionReady ? '已开启' : '待设置',
            icon: FileText,
            colorClass: overviewData?.questionReady ? 'bg-emerald-50 text-emerald-600' : 'bg-orange-50 text-orange-600',
            href: '/dashboard/questionnaire',
            isComplete: overviewData?.questionReady,
        },
        {
            title: '内容库',
            description: '文章与视频素材沉淀',
            value: overviewData?.contentCount || 0,
            icon: Library,
            colorClass: 'bg-primary-50 text-primary-600',
            href: '/dashboard/content',
        },
        {
            title: '计划库',
            description: '标准化训练模板与交付方案',
            value: overviewData?.planTemplateCount || 0,
            icon: Layout,
            colorClass: 'bg-indigo-50 text-indigo-600',
            href: '/dashboard/plan-lib',
        },
        {
            title: '动作库',
            description: '演示资源与动作标准积累',
            value: overviewData?.actionCount || 0,
            icon: Activity,
            colorClass: 'bg-slate-50 text-slate-600',
            href: '/dashboard/action-lib',
        },
    ];

    return (
        <div className="mx-auto max-w-[1600px] space-y-6 sm:space-y-8">
            <section className="overflow-hidden rounded-[32px] border border-surface-200 bg-surface shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
                <div className="border-b border-surface-100 bg-[radial-gradient(circle_at_top_left,rgba(207,109,78,0.14),transparent_38%),linear-gradient(180deg,rgba(255,248,244,0.95),rgba(255,255,255,0.98))] px-5 py-6 sm:px-8 sm:py-8">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <div className="text-xs font-black uppercase tracking-[0.22em] text-primary-600">
                                Coach Dashboard
                            </div>
                            <h1 className="mt-3 text-2xl font-black tracking-tight text-surface-900 sm:text-3xl">
                                {coachName}，今天先把关键看板收拢好
                            </h1>
                            <p className="mt-3 max-w-2xl text-sm leading-6 text-surface-600">
                                这里保留你最常用的经营指标和配置入口，减少跳来跳去的成本。
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <Link
                                href="/dashboard/students"
                                className="rounded-2xl bg-primary px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                            >
                                去看学员
                            </Link>
                            <Link
                                href="/dashboard/plan-lib"
                                className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-surface-700 transition hover:border-primary-300 hover:text-primary-700"
                            >
                                继续计划库
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 px-5 py-5 sm:px-8 md:grid-cols-4">
                    {coreStats.map((stat) => (
                        <MetricCard key={stat.title} {...stat} loading={loading} />
                    ))}
                </div>
            </section>

            <section className="space-y-3">
                <div className="px-1">
                    <h2 className="text-base font-black tracking-tight text-surface-900 sm:text-lg">
                        教学资产配置
                    </h2>
                    <p className="mt-1 text-xs text-surface-500">
                        保持这些基础设施就绪，首页体验会更稳，交付也更顺手。
                    </p>
                </div>

                <div className="space-y-3">
                    {setupCards.map((card) => (
                        <StatusCard key={card.title} {...card} loading={loading} />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Overview;
