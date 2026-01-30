'use client';

import React, { useState, useEffect } from 'react';
import { 
    Users, Video, Star, TrendingUp, CheckCircle2, 
    CircleDashed, Library, Layout, FileText, 
    Activity, ChevronRight, Loader2 
} from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import Link from 'next/link';

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

// 统一的卡片组件
const StatCard = ({
    title,
    description,
    value,
    icon: Icon,
    colorClass,
    loading,
    href,
    isStatus = false,
    isComplete = false,
    variant = 'tile', // 'tile' | 'row'
}: any) => {
    const CardWrapper = ({ children }: { children: React.ReactNode }) => 
        href ? <Link href={href} className="block group">{children}</Link> : <div className="group">{children}</div>;

    if (variant === 'row') {
        return (
            <CardWrapper>
                <div className="bg-white dark:bg-surface-50 border border-surface-200 rounded-2xl px-3 py-2.5 transition-all duration-300 hover:border-primary-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.99]">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${colorClass} transition-colors shrink-0`}>
                            <Icon className="w-4 h-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-black text-surface-900 leading-tight truncate">{title}</div>
                            {description && (
                                <div className="text-[11px] text-surface-400 leading-tight line-clamp-1">
                                    {description}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {loading ? (
                                <Skeleton width="3.5rem" height="1.25rem" />
                            ) : (
                                <span className="text-sm font-black text-surface-900 tracking-tight">
                                    {value}
                                </span>
                            )}
                            {isStatus && isComplete && !loading && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-bold">
                                    已就绪
                                </span>
                            )}
                            {loading ? (
                                <Loader2 className="w-4 h-4 animate-spin text-surface-200" />
                            ) : (
                                href && <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                            )}
                        </div>
                    </div>
                </div>
            </CardWrapper>
        );
    }

    return (
        <CardWrapper>
            <div className="relative h-full bg-white dark:bg-surface-50 border border-surface-200 p-3 sm:p-5 rounded-2xl transition-all duration-300 hover:border-primary-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.99]">
                <div className="flex justify-between items-start mb-2 sm:mb-4">
                    <div className={`p-2 rounded-xl ${colorClass} transition-colors`}>
                        <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin text-surface-300" />
                    ) : (
                        href && <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
                    )}
                </div>

                <div>
                    <h3 className="text-[11px] sm:text-sm font-bold text-surface-500 mb-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        {loading ? (
                            <Skeleton width="3.5rem" height="1.5rem" className="mb-1" />
                        ) : (
                            <span className="text-xl sm:text-2xl font-black text-surface-900 tracking-tight">
                                {value}
                            </span>
                        )}
                        {isStatus && isComplete && !loading && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
                                已就绪
                            </span>
                        )}
                    </div>
                    {description && (
                        <p className="text-xs text-surface-400 mt-2 line-clamp-1 font-light tracking-wide italic">
                            {description}
                        </p>
                    )}
                </div>
            </div>
        </CardWrapper>
    );
};

const Overview = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadOverviewData = async () => {
            if (coach?.id) {
                try {
                    const data = await coachService.getOverviewData({ coachId: coach.id });
                    if (data) setOverviewData(data);
                } catch (error) {
                    console.error('加载概览数据失败:', error);
                } finally {
                    setLoading(false);
                }
            }
        };
        loadOverviewData();
    }, [coach?.id]);

    // 顶部核心指标
    const coreStats = [
        {
            title: "总学员数",
            value: overviewData?.totalStudentCount || 0,
            icon: Users,
            colorClass: "bg-blue-50 text-blue-600",
            href: "/dashboard/students"
        },
        {
            title: "待点评视频",
            value: overviewData?.pendingReviewCount || 0,
            icon: Video,
            colorClass: "bg-amber-50 text-amber-600",
            href: "/dashboard/videos"
        },
        {
            title: "平均评分",
            value: overviewData?.averageRating?.toFixed(1) || "0.0",
            icon: Star,
            colorClass: "bg-yellow-50 text-yellow-600",
        },
        {
            title: "本月收入",
            value: `¥${overviewData?.monthlyRevenue?.toLocaleString() || 0}`,
            icon: TrendingUp,
            colorClass: "bg-purple-50 text-purple-600",
            href: "/dashboard/revenue"
        }
    ];

    // 配置进度指标
    const configStats = [
        {
            title: "订阅定价",
            description: "设置您的会员方案",
            value: overviewData?.pricingReady ? "已激活" : "待配置",
            icon: overviewData?.pricingReady ? CheckCircle2 : CircleDashed,
            colorClass: overviewData?.pricingReady ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
            isStatus: true,
            isComplete: overviewData?.pricingReady,
            href: "/dashboard/pricing"
        },
        {
            title: "学员问卷",
            description: "收集学员基础信息",
            value: overviewData?.questionReady ? "已开启" : "待设置",
            icon: FileText,
            colorClass: overviewData?.questionReady ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-600",
            isStatus: true,
            isComplete: overviewData?.questionReady,
            href: "/dashboard/questionnaire"
        },
        {
            title: "内容库",
            description: "已发布的文章与视频",
            value: overviewData?.contentCount || 0,
            icon: Library,
            colorClass: "bg-primary-50 text-primary-600",
            href: "/dashboard/content"
        },
        {
            title: "计划库",
            description: "标准化训练方案",
            value: overviewData?.planTemplateCount || 0,
            icon: Layout,
            colorClass: "bg-indigo-50 text-indigo-600",
            href: "/dashboard/plan-lib"
        },
        {
            title: "动作库",
            description: "演示资源总数",
            value: overviewData?.actionCount || 0,
            icon: Activity,
            colorClass: "bg-slate-50 text-slate-600",
            href: "/dashboard/action-lib"
        }
    ];

    return (
        <div className="space-y-6 sm:space-y-10 max-w-[1600px] mx-auto">
            {/* 1. 核心指标区域 */}
            <section className="space-y-3">
                <div className="px-1">
                    <h2 className="text-base sm:text-lg font-black text-surface-900 tracking-tight">业务概览</h2>
                    <p className="text-[11px] sm:text-xs text-surface-500">关键运营指标实时汇总</p>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {coreStats.map((stat, idx) => (
                        <StatCard key={idx} {...stat} loading={loading} variant="tile" />
                    ))}
                </div>
            </section>

            {/* 2. 进度看板区域 */}
            <section className="space-y-3">
                <div className="flex items-end justify-between px-1">
                    <div className="space-y-1">
                        <h2 className="text-base sm:text-lg font-black text-surface-900 tracking-tight">教学资产配置</h2>
                        <p className="text-[11px] sm:text-xs text-surface-500">完善以下内容以提升教学专业度</p>
                    </div>
                </div>

                {/* Mobile: 行式列表（更紧凑）；Desktop: 仍可读 */}
                <div className="space-y-2">
                    {configStats.map((card, idx) => (
                        <StatCard key={idx} {...card} loading={loading} variant="row" />
                    ))}
                </div>
            </section>
        </div>
    );
};

export default Overview;