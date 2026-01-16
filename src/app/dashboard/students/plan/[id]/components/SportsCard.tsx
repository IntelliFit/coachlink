'use client';

import React from 'react';
import { Dumbbell, User, Bike, Footprints } from 'lucide-react';
import { SportCards } from '@/types/sportCards';
import { getPowerliftingTotal, getStreetliftingTotal, getWeightliftingTotal } from '@/lib/sportsCollections';

interface SportCardsDisplayProps {
    sportCards: SportCards | null;
}

/**
 * Aero 规范下的数据单元格：强调数值与呼吸感
 */
const DataCell = ({ label, value, unit, highlight = false }: { label: string, value: number | string | null, unit: string, highlight?: boolean }) => (
    <div className={`flex flex-col items-center justify-center p-4 rounded-[20px] transition-all duration-300 active:scale-[0.98] ${
        highlight 
        ? 'bg-primary-500 text-white shadow-[0_8px_20px_rgba(var(--primary-rgb),0.15)] scale-[1.02]' 
        : 'bg-surface-50/50 border border-surface-100/50 hover:bg-surface-50 hover:border-primary-100/50'
    }`}>
        <span className={`text-[10px] font-bold tracking-widest mb-1.5 ${highlight ? 'text-primary-100' : 'text-surface-400'}`}>
            {label}
        </span>
        <div className="flex items-baseline gap-0.5">
            <span className={`text-xl font-black tracking-tighter ${highlight ? 'text-white' : 'text-surface-900'}`}>
                {value || '-'}
            </span>
            {unit && (
                <span className={`text-[10px] font-bold ml-0.5 ${highlight ? 'text-primary-200' : 'text-surface-400'}`}>
                    {unit}
                </span>
            )}
        </div>
    </div>
);

// 运动卡片区块标题
const SectionHeader = ({ title, icon: Icon }: { title: string; icon: React.ElementType }) => (
    <div className="flex items-center gap-2 px-1">
        <Icon size={18} className="text-primary-500" strokeWidth={2.5} />
        <h3 className="text-sm font-bold tracking-tight text-surface-900">{title}</h3>
        <div className="h-px flex-1 bg-surface-100/60 ml-2" />
    </div>
);

export const SportCard: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
    if (!sportCards?.activeCards || sportCards.activeCards.length === 0) return null;

    return (
        <div className="space-y-8">
            {/* 1. 力量举 */}
            {sportCards.activeCards.includes('powerlifting') && sportCards.powerlifting && (
                <div className="space-y-4">
                    <SectionHeader title="力量举专项" icon={Dumbbell} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DataCell label="深蹲" value={sportCards.powerlifting.squat} unit="kg" />
                        <DataCell label="卧推" value={sportCards.powerlifting.bench} unit="kg" />
                        <DataCell label="硬拉" value={sportCards.powerlifting.deadlift} unit="kg" />
                        <DataCell label="三大项总和" value={getPowerliftingTotal(sportCards.powerlifting)} unit="kg" highlight />
                    </div>
                </div>
            )}

            {/* 2. 街头力量举 */}
            {sportCards.activeCards.includes('streetlifting') && sportCards.streetlifting && (
                <div className="space-y-4">
                    <SectionHeader title="街头力量举" icon={Dumbbell} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DataCell label="负重引体" value={sportCards.streetlifting.weightedPullup} unit="kg" />
                        <DataCell label="负重双杠" value={sportCards.streetlifting.weightedDip} unit="kg" />
                        <DataCell label="负重双力臂" value={sportCards.streetlifting.weightedMuscleUp} unit="kg" />
                        <DataCell label="深蹲" value={sportCards.streetlifting.squat} unit="kg" />
                    </div>
                </div>
            )}

            {/* 3. 街头健身 */}
            {sportCards.activeCards.includes('calisthenics') && sportCards.calisthenics && (
                <div className="space-y-4">
                    <SectionHeader title="街头健身" icon={User} />
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <DataCell label="最大引体" value={sportCards.calisthenics.maxPullups} unit="次" />
                        <DataCell label="最大双杠" value={sportCards.calisthenics.maxDips} unit="次" />
                        <DataCell label="双力臂" value={sportCards.calisthenics.maxMuscleUps} unit="次" />
                        <DataCell label="前水平" value={sportCards.calisthenics.frontLever} unit="秒" />
                        <DataCell label="俄挺" value={sportCards.calisthenics.planche} unit="秒" />
                        <DataCell label="人旗" value={sportCards.calisthenics.humanFlag} unit="秒" />
                    </div>
                </div>
            )}

            {/* 4. 举重 */}
            {sportCards.activeCards.includes('weightlifting') && sportCards.weightlifting && (
                <div className="space-y-4">
                    <SectionHeader title="举重" icon={Dumbbell} />
                    <div className="grid grid-cols-3 gap-3">
                        <DataCell label="抓举" value={sportCards.weightlifting.snatch} unit="kg" />
                        <DataCell label="挺举" value={sportCards.weightlifting.cleanAndJerk} unit="kg" />
                        <DataCell label="总成绩" value={getWeightliftingTotal(sportCards.weightlifting)} unit="kg" highlight />
                    </div>
                </div>
            )}

            {/* 5. 健美/形体 */}
            {sportCards.activeCards.includes('bodybuilding') && sportCards.bodybuilding && (
                <div className="space-y-4">
                    <SectionHeader title="健美/形体" icon={User} />
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        <DataCell label="体脂率" value={sportCards.bodybuilding.bodyfat} unit="%" highlight />
                        <DataCell label="胸围" value={sportCards.bodybuilding.chest} unit="cm" />
                        <DataCell label="臂围" value={sportCards.bodybuilding.arm} unit="cm" />
                        <DataCell label="腰围" value={sportCards.bodybuilding.waist} unit="cm" />
                        <DataCell label="臀围" value={sportCards.bodybuilding.hip} unit="cm" />
                        <DataCell label="大腿围" value={sportCards.bodybuilding.thigh} unit="cm" />
                        <DataCell label="小腿围" value={sportCards.bodybuilding.calf} unit="cm" />
                    </div>
                </div>
            )}

            {/* 6. 跑步 */}
            {sportCards.activeCards.includes('running') && sportCards.running && (
                <div className="space-y-4">
                    <SectionHeader title="跑步" icon={Footprints} />
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DataCell label="5公里" value={sportCards.running.fiveK} unit="" />
                        <DataCell label="10公里" value={sportCards.running.tenK} unit="" />
                        <DataCell label="半马" value={sportCards.running.halfMarathon} unit="" />
                        <DataCell label="全马" value={sportCards.running.marathon} unit="" />
                    </div>
                </div>
            )}

            {/* 7. 骑行 */}
            {sportCards.activeCards.includes('cycling') && sportCards.cycling && (
                <div className="space-y-4">
                    <SectionHeader title="骑行" icon={Bike} />
                    <div className="grid grid-cols-3 gap-3">
                        <DataCell label="FTP" value={sportCards.cycling.ftp} unit="W" highlight />
                        <DataCell label="最大功率" value={sportCards.cycling.maxPower} unit="W" />
                        <DataCell label="最长单骑" value={sportCards.cycling.maxDistance} unit="km" />
                    </div>
                </div>
            )}
        </div>
    );
};