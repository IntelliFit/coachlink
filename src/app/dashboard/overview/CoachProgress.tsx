'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircle2, CircleDashed, Library, Layout, FileText, Activity, ChevronRight, Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { planLibService } from '@/app/service/planLibService';
import { actionLibService } from '@/app/service/actionLibService';
import Link from 'next/link';

// 内部美化版的 Card 组件
const ProgressCard = ({ title, description, value, icon: Icon, colorClass, loading, href, isComplete }: any) => (
  <Link href={href}>
    <div className="group relative bg-white border border-surface-100 p-5 rounded-2xl transition-all duration-300 hover:border-primary-500 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98]">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl ${colorClass} transition-colors`}>
          <Icon className="w-5 h-5" />
        </div>
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin text-surface-300" />
        ) : (
          <ChevronRight className="w-4 h-4 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition-all" />
        )}
      </div>
      
      <div>
        <h3 className="text-sm font-medium text-surface-500 mb-1">{title}</h3>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-surface-900 tracking-tight">
            {loading ? <div className="h-8 w-12 bg-surface-50 animate-pulse rounded" /> : value}
          </span>
          {isComplete && !loading && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-medium">
              已就绪
            </span>
          )}
        </div>
        <p className="text-xs text-surface-400 mt-2 line-clamp-1 font-light tracking-wide">{description}</p>
      </div>
    </div>
  </Link>
);

const CoachProgress: React.FC = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    const [data, setData] = useState({
        pricingComplete: false,
        questionnairesComplete: false,
        contentCount: 0,
        templateCount: 0,
        actionCount: 0,
    });

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadProgressData = async () => {
            if (!coach?.id) return;
            try {
                const [pricing, questionnaires, contents, templates, actions] = await Promise.all([
                    coachService.getPricing({ coachId: coach.id }),
                    coachService.getQuestionnaires({ coachId: coach.id }),
                    coachService.getContents({ coachId: coach.id, pagination: { page: 1, limit: 1 } }),
                    planLibService.listTemplates({ page: 1, limit: 1 }),
                    actionLibService.listActions({ page: 1, limit: 1 })
                ]);

                setData({
                    pricingComplete: !!pricing?.tiers?.length,
                    questionnairesComplete: !!questionnaires?.questionnaires?.length,
                    contentCount: contents?.totalCount || 0,
                    templateCount: templates?.totalCount || 0,
                    actionCount: actions?.totalCount || 0,
                });
            } catch (error) {
                console.error('Failed to load coach progress:', error);
            } finally {
                setLoading(false);
            }
        };
        loadProgressData();
    }, [coach?.id]);

    const cards = [
        {
            title: "订阅定价",
            description: "设置您的会员方案",
            value: data.pricingComplete ? "已激活" : "待配置",
            icon: data.pricingComplete ? CheckCircle2 : CircleDashed,
            colorClass: data.pricingComplete ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500",
            isComplete: data.pricingComplete,
            href: "/dashboard/pricing"
        },
        {
            title: "学员问卷",
            description: "收集学员基础信息",
            value: data.questionnairesComplete ? "已开启" : "待设置",
            icon: FileText,
            colorClass: data.questionnairesComplete ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-500",
            isComplete: data.questionnairesComplete,
            href: "/dashboard/questionnaire"
        },
        {
            title: "内容库",
            description: "已发布的文章与视频",
            value: data.contentCount,
            icon: Library,
            colorClass: "bg-primary-50 text-primary-600",
            href: "/dashboard/content"
        },
        {
            title: "计划模板",
            description: "标准化训练方案",
            value: data.templateCount,
            icon: Layout,
            colorClass: "bg-indigo-50 text-indigo-600",
            href: "/dashboard/plan-lib"
        },
        {
            title: "动作库",
            description: "基础动作演示资源",
            value: data.actionCount,
            icon: Activity,
            colorClass: "bg-surface-50 text-surface-600",
            href: "/dashboard/action-lib"
        }
    ];

    return (
        <div className="w-full space-y-6">
            <div className="flex items-end justify-between px-1">
                <div className="space-y-1">
                    <h2 className="text-lg font-bold text-surface-900 tracking-tight">教练进度看板</h2>
                    <p className="text-xs text-surface-500">实时追踪您的教学资产配置进度</p>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-50 rounded-full border border-surface-100">
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                    </span>
                    <span className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider">Live</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {cards.map((card, idx) => (
                    <ProgressCard key={idx} {...card} loading={loading} />
                ))}
            </div>
        </div>
    );
};

export default CoachProgress;