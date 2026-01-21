'use client';

import React, { useMemo, useState } from 'react';
import { Chart } from 'primereact/chart';
import { ChevronDown } from 'lucide-react'; // 引入折叠图标
import { SportCards } from '@/types/sportCards';
import {
    typicalActionMaps,
    SportTypes,
    getTotalWeight,
    showTotalWeight
} from '@/lib/sportsCollections';

interface SportCardsDisplayProps {
    sportCards: SportCards | null;
}

const SportChartDisplay = ({
    title,
    icon: Icon,
    iconClass,
    data,
    sportKey
}: {
    title: string;
    icon: React.ElementType;
    iconClass: string;
    data: Record<string, any>;
    sportKey: string;
}) => {
    // 状态控制：默认展开第一个，或者全部折叠
    const [isExpanded, setIsExpanded] = useState(false);

    const sportFields = useMemo(() => {
        return Object.entries(typicalActionMaps).filter(([key]) => {
            if (sportKey === 'powerlifting') return ['squat', 'bench', 'deadlift'].includes(key);
            if (sportKey === 'streetlifting') return ['weightedPullup', 'weightedDip', 'weightedMuscleUp', 'squat'].includes(key);
            if (sportKey === 'calisthenics') return ['maxPullups', 'maxDips', 'maxMuscleUps', 'frontLever', 'planche', 'humanFlag'].includes(key);
            if (sportKey === 'weightlifting') return ['snatch', 'cleanAndJerk'].includes(key);
            if (sportKey === 'bodybuilding') return ['bodyfat', 'chest', 'arm', 'waist', 'hip', 'thigh', 'calf'].includes(key);
            if (sportKey === 'running') return ['fiveK', 'tenK', 'halfMarathon', 'marathon'].includes(key);
            if (sportKey === 'cycling') return ['ftp', 'maxPower', 'maxDistance'].includes(key);
            return false;
        });
    }, [sportKey]);

    const chartData = useMemo(() => {
        const labels = sportFields.map(([, config]) => config.nameCn);
        const values = sportFields.map(([fieldKey]) => data?.[fieldKey] || 0);
        const primaryColor = '#F28631';

        return {
            labels: labels,
            datasets: [{
                label: '当前表现',
                backgroundColor: primaryColor,
                borderColor: primaryColor,
                borderRadius: 8,
                barThickness: 12,
                data: values
            }]
        };
    }, [sportFields, data]);

    const chartOptions = useMemo(() => ({
        indexAxis: 'y' as const,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { enabled: true }
        },
        scales: {
            x: { display: false, beginAtZero: true },
            y: {
                grid: { display: false },
                border: { display: false },
                ticks: { color: '#64748b', font: { size: 11, weight: '700' } }
            }
        },
        layout: { padding: { right: 45 } }
    }), []);

    const chartHeight = `${sportFields.length * 42 + 10}px`;

    return (
        <div className={`
            bg-surface rounded-[24px] border border-surface-100 mb-3 transition-all duration-300
            ${isExpanded ? 'shadow-[0_12px_40px_rgba(0,0,0,0.08)]' : 'shadow-sm'}
        `}>
            {/* 可点击的 Header */}
            <div 
                className="flex items-center justify-between p-5 cursor-pointer select-none"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-surface-50 ${iconClass} transition-transform ${isExpanded ? 'scale-110' : ''}`}>
                        <Icon size={20} strokeWidth={3} />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-base font-black text-surface-900 italic tracking-tight uppercase leading-none">
                            {title}
                        </span>
                        {!isExpanded && (
                             <span className="text-[10px] font-bold text-surface-400 mt-1">
                                点击查看详情数据
                             </span>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {showTotalWeight(sportKey) && data && (
                        <div className="flex flex-col items-end">
                            <span className={`text-lg font-black leading-none transition-colors ${isExpanded ? 'text-[#F28631]' : 'text-surface-900'}`}>
                                {getTotalWeight(sportKey, data)}<small className="text-[10px] ml-0.5 font-bold">kg</small>
                            </span>
                        </div>
                    )}
                    <ChevronDown 
                        size={18} 
                        className={`text-surface-300 transition-transform duration-300 ${isExpanded ? 'rotate-180 text-primary' : ''}`} 
                    />
                </div>
            </div>

            {/* 折叠动画容器 */}
            <div className={`
                grid transition-all duration-300 ease-in-out
                ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 pointer-events-none'}
            `}>
                <div className="overflow-hidden">
                    <div className="px-5 pb-5 pt-0">
                        {/* 分割线 */}
                        <div className="h-[1px] bg-surface-50 w-full mb-5" />
                        
                        <div className="relative" style={{ height: chartHeight }}>
                            <Chart type="bar" data={chartData} options={chartOptions} style={{ height: '100%' }} />
                            
                            {/* 数值叠加层 */}
                            <div className="absolute top-0 right-0 h-full flex flex-col justify-around pointer-events-none py-[10px]">
                                {sportFields.map(([fieldKey, fieldConfig]) => (
                                    <div key={fieldKey} className="text-right">
                                        <span className="text-sm font-black text-surface-900">
                                            {data?.[fieldKey] ?? '-'}
                                        </span>
                                        <span className="text-[10px] font-bold text-surface-400 ml-1">
                                            {fieldConfig.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const SportCardsDisplay: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
    if (!sportCards?.activeCards || sportCards.activeCards.length === 0) return null;

    return (
        <div className="space-y-1 pb-4">
            {sportCards.activeCards.map((sportKey) => {
                const sportType = SportTypes.find(type => type.key === sportKey);
                if (!sportType) return null;
                const sportData = sportCards[sportKey as keyof typeof sportCards];
                if (!sportData || typeof sportData !== 'object') return null;

                return (
                    <SportChartDisplay
                        key={sportKey}
                        title={sportType.label}
                        icon={sportType.icon}
                        iconClass={sportType.color}
                        data={sportData as Record<string, any>}
                        sportKey={sportKey}
                    />
                );
            })}
        </div>
    );
};