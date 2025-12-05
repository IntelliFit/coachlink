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
                <div className="bg-surface rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3">
                        <h3 className="text-base font-bold flex items-center gap-2 text-white">
                            <Dumbbell className="w-5 h-5" />
                            力量举
                        </h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-200">
                                <div className="text-xs text-orange-600 mb-1 font-medium">深蹲</div>
                                <div className="text-xl font-bold text-orange-700">
                                    {sportCards.powerlifting.squat || '-'}
                                </div>
                                <div className="text-xs text-orange-500">kg</div>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-200">
                                <div className="text-xs text-orange-600 mb-1 font-medium">卧推</div>
                                <div className="text-xl font-bold text-orange-700">
                                    {sportCards.powerlifting.bench || '-'}
                                </div>
                                <div className="text-xs text-orange-500">kg</div>
                            </div>
                            <div className="bg-orange-50 rounded-xl p-4 text-center border border-orange-200">
                                <div className="text-xs text-orange-600 mb-1 font-medium">硬拉</div>
                                <div className="text-xl font-bold text-orange-700">
                                    {sportCards.powerlifting.deadlift || '-'}
                                </div>
                                <div className="text-xs text-orange-500">kg</div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-center">
                                <div className="text-xs text-white/80 mb-1 font-medium">总和</div>
                                <div className="text-xl font-bold text-white">
                                    {getPowerliftingTotal()}
                                </div>
                                <div className="text-xs text-white/80">kg</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 健美卡片 */}
            {sportCards.activeCards.includes('bodybuilding') && sportCards.bodybuilding && (
                <div className="bg-surface rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-5 py-3">
                        <h3 className="text-base font-bold flex items-center gap-2 text-white">
                            <User className="w-5 h-5" />
                            健美/形体
                        </h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-5 gap-3">
                            <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-200">
                                <div className="text-xs text-purple-600 mb-1 font-medium">胸围</div>
                                <div className="text-xl font-bold text-purple-700">
                                    {sportCards.bodybuilding.chest || '-'}
                                </div>
                                <div className="text-xs text-purple-500">cm</div>
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-200">
                                <div className="text-xs text-purple-600 mb-1 font-medium">臂围</div>
                                <div className="text-xl font-bold text-purple-700">
                                    {sportCards.bodybuilding.arm || '-'}
                                </div>
                                <div className="text-xs text-purple-500">cm</div>
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-200">
                                <div className="text-xs text-purple-600 mb-1 font-medium">腰围</div>
                                <div className="text-xl font-bold text-purple-700">
                                    {sportCards.bodybuilding.waist || '-'}
                                </div>
                                <div className="text-xs text-purple-500">cm</div>
                            </div>
                            <div className="bg-purple-50 rounded-xl p-4 text-center border border-purple-200">
                                <div className="text-xs text-purple-600 mb-1 font-medium">臀围</div>
                                <div className="text-xl font-bold text-purple-700">
                                    {sportCards.bodybuilding.hip || '-'}
                                </div>
                                <div className="text-xs text-purple-500">cm</div>
                            </div>
                            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-center">
                                <div className="text-xs text-white/80 mb-1 font-medium">体脂率</div>
                                <div className="text-xl font-bold text-white">
                                    {sportCards.bodybuilding.bodyfat || '-'}
                                </div>
                                <div className="text-xs text-white/80">%</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 体能卡片 */}
            {sportCards.activeCards.includes('fitness') && sportCards.fitness && (
                <div className="bg-surface rounded-2xl shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 px-5 py-3">
                        <h3 className="text-base font-bold flex items-center gap-2 text-white">
                            <Activity className="w-5 h-5" />
                            一般体能
                        </h3>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-4 gap-3">
                            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200">
                                <div className="text-xs text-green-600 mb-1 font-medium">引体向上</div>
                                <div className="text-xl font-bold text-green-700">
                                    {sportCards.fitness.pullups || '-'}
                                </div>
                                <div className="text-xs text-green-500">次</div>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200">
                                <div className="text-xs text-green-600 mb-1 font-medium">俯卧撑</div>
                                <div className="text-xl font-bold text-green-700">
                                    {sportCards.fitness.pushups || '-'}
                                </div>
                                <div className="text-xs text-green-500">次</div>
                            </div>
                            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-200">
                                <div className="text-xs text-green-600 mb-1 font-medium">平板支撑</div>
                                <div className="text-xl font-bold text-green-700">
                                    {sportCards.fitness.plank || '-'}
                                </div>
                                <div className="text-xs text-green-500">秒</div>
                            </div>
                            <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-center">
                                <div className="text-xs text-white/80 mb-1 font-medium">静态心率</div>
                                <div className="text-xl font-bold text-white">
                                    {sportCards.fitness.restingHR || '-'}
                                </div>
                                <div className="text-xs text-white/80">bpm</div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
