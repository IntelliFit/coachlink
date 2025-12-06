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

export const SportCardsDisplay: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
    if (!sportCards?.activeCards || sportCards.activeCards.length === 0) {
        return null;
    }

    // 计算力量举总和
    const getPowerliftingTotal = () => {
        const pl = sportCards.powerlifting;
        if (!pl) return 0;
        return (pl.squat || 0) + (pl.bench || 0) + (pl.deadlift || 0);
    };

    return (
        <div className="space-y-4">
            {/* 力量举卡片 */}
            {sportCards.activeCards.includes('powerlifting') && sportCards.powerlifting && (
                <div className="bg-surface rounded-2xl shadow-sm overflow-hidden border border-surface-200">
                    <div className="px-5 py-3 border-b border-surface-200">
                        <h3 className="text-base font-bold flex items-center gap-2 text-surface-900">
                            <Dumbbell className="w-5 h-5 text-primary" />
                            力量举
                        </h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">深蹲</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.powerlifting.squat || '-'}
                                </div>
                                <div className="text-xs text-surface-500">kg</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">卧推</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.powerlifting.bench || '-'}
                                </div>
                                <div className="text-xs text-surface-500">kg</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">硬拉</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.powerlifting.deadlift || '-'}
                                </div>
                                <div className="text-xs text-surface-500">kg</div>
                            </div>
                            <div className="bg-surface-100 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">总和</div>
                                <div className="text-xl font-bold text-surface-900">
                                    {getPowerliftingTotal()}
                                </div>
                                <div className="text-xs text-surface-500">kg</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 健美卡片 */}
            {sportCards.activeCards.includes('bodybuilding') && sportCards.bodybuilding && (
                <div className="bg-surface rounded-2xl shadow-sm overflow-hidden border border-surface-200">
                    <div className="px-5 py-3 border-b border-surface-200">
                        <h3 className="text-base font-bold flex items-center gap-2 text-surface-900">
                            <User className="w-5 h-5 text-primary" />
                            健美/形体
                        </h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-5 gap-3">
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">胸围</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.bodybuilding.chest || '-'}
                                </div>
                                <div className="text-xs text-surface-500">cm</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">臂围</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.bodybuilding.arm || '-'}
                                </div>
                                <div className="text-xs text-surface-500">cm</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">腰围</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.bodybuilding.waist || '-'}
                                </div>
                                <div className="text-xs text-surface-500">cm</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">臀围</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.bodybuilding.hip || '-'}
                                </div>
                                <div className="text-xs text-surface-500">cm</div>
                            </div>
                            <div className="bg-surface-100 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">体脂率</div>
                                <div className="text-xl font-bold text-surface-900">
                                    {sportCards.bodybuilding.bodyfat || '-'}
                                </div>
                                <div className="text-xs text-surface-500">%</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 体能卡片 */}
            {sportCards.activeCards.includes('fitness') && sportCards.fitness && (
                <div className="bg-surface rounded-2xl shadow-sm overflow-hidden border border-surface-200">
                    <div className="px-5 py-3 border-b border-surface-200">
                        <h3 className="text-base font-bold flex items-center gap-2 text-surface-900">
                            <Activity className="w-5 h-5 text-primary" />
                            一般体能
                        </h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">引体向上</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.fitness.pullups || '-'}
                                </div>
                                <div className="text-xs text-surface-500">次</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">俯卧撑</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.fitness.pushups || '-'}
                                </div>
                                <div className="text-xs text-surface-500">次</div>
                            </div>
                            <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">平板支撑</div>
                                <div className="text-xl font-bold text-primary">
                                    {sportCards.fitness.plank || '-'}
                                </div>
                                <div className="text-xs text-surface-500">秒</div>
                            </div>
                            <div className="bg-surface-100 rounded-xl p-4 text-center border border-surface-200">
                                <div className="text-xs text-surface-600 mb-1 font-medium">静态心率</div>
                                <div className="text-xl font-bold text-surface-900">
                                    {sportCards.fitness.restingHR || '-'}
                                </div>
                                <div className="text-xs text-surface-500">bpm</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};