'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Info } from 'lucide-react';

interface RestDayCardProps {
    dayIndex: number;
}

const RestDayCard: React.FC<RestDayCardProps> = ({ dayIndex }) => {
    const [showInfo, setShowInfo] = useState(false);

    return (
        <>
            <div className="bg-surface border rounded-2xl border-surface-100/50 p-4 sm:p-6">
                <div className="text-center py-4 sm:py-6">
                    <div className="relative inline-block mb-4">
                        <div className="absolute inset-0 animate-ping opacity-20 bg-primary-400 rounded-full" />
                        <div className="relative inline-block p-3 sm:p-4 bg-surface-50 rounded-full border border-surface-100/50">
                            <span className="text-5xl sm:text-6xl">😌</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <h2 className="text-xl sm:text-2xl font-bold text-surface-900 tracking-tight">
                            今日休息日
                        </h2>
                        <button
                            onClick={() => setShowInfo(true)}
                            className="p-1.5 rounded-full hover:bg-surface-100 transition-colors active:scale-[0.98]"
                            title="了解休息日的重要性"
                        >
                            <Info className="w-4 h-4 text-surface-500" />
                        </button>
                    </div>
                    
                    <p className="text-sm sm:text-base text-surface-600 mb-3">
                        休息不是懒惰，而是成长的必经之路
                    </p>
                    <p className="text-xs sm:text-sm text-surface-500 mb-3">
                        休息日会自动顺延；到训练日会停住，直到你完成/跳过（确认后才继续推进）。
                    </p>
                    <p className="text-xs sm:text-sm text-surface-500 italic">
                        "强者懂得何时发力，智者懂得何时休息"
                    </p>
                </div>
            </div>

            <Dialog
                header="为什么休息如此重要？"
                visible={showInfo}
                onHide={() => setShowInfo(false)}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,600px)]"
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100/50">
                            <div className="text-4xl mb-3">💪</div>
                            <h4 className="text-lg font-bold text-surface-900 mb-2 tracking-tight">肌肉重建</h4>
                            <p className="text-surface-600 text-sm leading-relaxed">
                                训练撕裂肌肉纤维，休息时肌肉修复并超量恢复，变得更加强壮有力
                            </p>
                        </div>
                        
                        <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100/50">
                            <div className="text-4xl mb-3">🔋</div>
                            <h4 className="text-lg font-bold text-surface-900 mb-2 tracking-tight">能量储备</h4>
                            <p className="text-surface-600 text-sm leading-relaxed">
                                补充肌糖原储备，恢复ATP能量系统，为下次爆发蓄力
                            </p>
                        </div>
                        
                        <div className="bg-surface-50 rounded-2xl p-4 border border-surface-100/50">
                            <div className="text-4xl mb-3">🧠</div>
                            <h4 className="text-lg font-bold text-surface-900 mb-2 tracking-tight">神经修复</h4>
                            <p className="text-surface-600 text-sm leading-relaxed">
                                中枢神经系统需要恢复，降低过度训练风险，保持长期进步
                            </p>
                        </div>
                    </div>

                    <div className="p-4 sm:p-6 bg-primary-50 rounded-2xl border border-primary-100/50">
                        <h4 className="text-lg font-bold mb-3 text-primary-900 tracking-tight">💡 休息日行动指南</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div className="space-y-2">
                                <p className="text-surface-700">😴 充足睡眠 - 7-9小时深度睡眠</p>
                                <p className="text-surface-700">🥩 优质营养 - 充足蛋白质和碳水</p>
                                <p className="text-surface-700">🚶 主动恢复 - 散步、瑜伽、拉伸</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-surface-700">💧 充分补水 - 2-3升水分</p>
                                <p className="text-surface-700">🧘 身心放松 - 冥想、阅读、音乐</p>
                                <p className="text-surface-700">📝 计划复盘 - 回顾训练进展</p>
                            </div>
                        </div>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default RestDayCard;
