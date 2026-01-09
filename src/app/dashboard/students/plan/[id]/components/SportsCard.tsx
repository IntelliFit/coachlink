import React from 'react';
import { Dumbbell, User, Activity } from 'lucide-react';

interface SportCards {
    activeCards: string[];
    powerlifting?: { squat: number | null; bench: number | null; deadlift: number | null };
    bodybuilding?: { chest: number | null; arm: number | null; waist: number | null; hip: number | null; bodyfat: number | null };
    fitness?: { pullups: number | null; pushups: number | null; plank: number | null; restingHR: number | null };
}

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
            <span className={`text-[10px] font-bold ml-0.5 ${highlight ? 'text-primary-200' : 'text-surface-400'}`}>
                {unit}
            </span>
        </div>
    </div>
);

export const SportCard: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
    if (!sportCards?.activeCards || sportCards.activeCards.length === 0) return null;

    const getPowerliftingTotal = () => {
        const pl = sportCards.powerlifting;
        return pl ? (pl.squat || 0) + (pl.bench || 0) + (pl.deadlift || 0) : 0;
    };

    return (
        <div className="space-y-8">
            {/* 1. 力量举专项 - 强调 SBD 总和 */}
            {sportCards.activeCards.includes('powerlifting') && sportCards.powerlifting && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Dumbbell size={18} className="text-primary-500" strokeWidth={2.5} />
                        <h3 className="text-sm font-bold tracking-tight text-surface-900">力量举专项</h3>
                        <div className="h-px flex-1 bg-surface-100/60 ml-2" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DataCell label="深蹲" value={sportCards.powerlifting.squat} unit="kg" />
                        <DataCell label="卧推" value={sportCards.powerlifting.bench} unit="kg" />
                        <DataCell label="硬拉" value={sportCards.powerlifting.deadlift} unit="kg" />
                        <DataCell label="三大项总和" value={getPowerliftingTotal()} unit="kg" highlight />
                    </div>
                </div>
            )}

            {/* 2. 健美/形体专项 - 强调体脂率 */}
            {sportCards.activeCards.includes('bodybuilding') && sportCards.bodybuilding && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <User size={18} className="text-primary-500" strokeWidth={2.5} />
                        <h3 className="text-sm font-bold tracking-tight text-surface-900">健美/形体数据</h3>
                        <div className="h-px flex-1 bg-surface-100/60 ml-2" />
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                        <DataCell label="胸围" value={sportCards.bodybuilding.chest} unit="cm" />
                        <DataCell label="臂围" value={sportCards.bodybuilding.arm} unit="cm" />
                        <DataCell label="腰围" value={sportCards.bodybuilding.waist} unit="cm" />
                        <DataCell label="臀围" value={sportCards.bodybuilding.hip} unit="cm" />
                        <DataCell label="体脂率" value={sportCards.bodybuilding.bodyfat} unit="%" highlight />
                    </div>
                </div>
            )}

            {/* 3. 一般体能专项 - 强调静态心率 */}
            {sportCards.activeCards.includes('fitness') && sportCards.fitness && (
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Activity size={18} className="text-primary-500" strokeWidth={2.5} />
                        <h3 className="text-sm font-bold tracking-tight text-surface-900">一般体能素质</h3>
                        <div className="h-px flex-1 bg-surface-100/60 ml-2" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <DataCell label="引体向上" value={sportCards.fitness.pullups} unit="次" />
                        <DataCell label="俯卧撑" value={sportCards.fitness.pushups} unit="次" />
                        <DataCell label="平板支撑" value={sportCards.fitness.plank} unit="秒" />
                        <DataCell label="晨脉/心率" value={sportCards.fitness.restingHR} unit="bpm" highlight />
                    </div>
                </div>
            )}
        </div>
    );
};