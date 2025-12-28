'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Loader2 } from 'lucide-react';

interface DashboardCardProps {
    title: string;
    value: string | number;
    description?: string;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    href?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
    title,
    value,
    description,
    icon,
    iconBg,
    iconColor,
    href
}) => {
    const router = useRouter();

    return (
        <div
            onClick={() => href && router.push(href)}
            className={`
                group relative flex flex-col h-full p-5
                bg-white border border-surface-100 rounded-2xl 
                transition-all duration-500
                ${href ? 'cursor-pointer hover:border-primary-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.04)] active:scale-[0.98]' : ''}
            `}
        >
            {/* 1. 顶部装饰性背景 - 极简细节：Hover 时轻微显现的渐变 */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-primary-50/30 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl pointer-events-none" />

            {/* 2. 布局：头部图标与状态 */}
            <div className="relative flex justify-between items-start mb-6">
                <div className={`p-2.5 rounded-xl ${iconBg} ${iconColor} transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm`}>
                    {/* 克隆图标以确保大小一致 */}
                    {React.isValidElement(icon)
                        ? React.cloneElement(icon as React.ReactElement<any>, { className: 'w-5 h-5' })
                        : icon}
                </div>

                {href && (
                    <div className="p-1 text-surface-300 group-hover:text-primary-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300">
                        <ArrowUpRight className="w-4 h-4" />
                    </div>
                )}
            </div>

            {/* 3. 内容区域 */}
            <div className="relative space-y-1.5 mb-4">
                <h3 className="text-sm font-medium text-surface-500 transition-colors group-hover:text-surface-700">
                    {title}
                </h3>

                <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-surface-900 tracking-tight">
                        {value}
                    </span>
                    {/* 如果是已激活/开启状态，可以加一个小圆点反馈 */}
                    {(value === "已激活" || value === "已开启") && (
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 mb-2" />
                    )}
                </div>
            </div>

            {/* 4. 描述文字 - 放在底部并固定高度 */}
            {description && (
                <div className="relative mt-auto">
                    <p className="text-xs text-surface-400 font-light leading-relaxed line-clamp-2">
                        {description}
                    </p>
                </div>
            )}
        </div>
    );
};

export default DashboardCard;