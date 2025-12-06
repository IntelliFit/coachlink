'use client';

import React from 'react';
import { Card } from 'primereact/card';

interface RestDayCardProps {
    dayIndex: number;
}

const RestDayCard: React.FC<RestDayCardProps> = ({ dayIndex }) => {
    return (
        <Card className="shadow-lg">
            <div className="text-center py-12">
                <div className="inline-block p-6 bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 rounded-full shadow-2xl mb-6">
                    <span className="text-8xl">😌</span>
                </div>
                
                <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                    今日休息日
                </h2>
                
                <p className="text-xl md:text-2xl text-gray-600 font-medium mb-8">
                    休息不是懒惰，而是成长的必经之路
                </p>

                <div className="max-w-3xl mx-auto bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-2xl p-8 shadow-xl border-2 border-purple-200">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">为什么休息如此重要？</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white rounded-xl p-6 shadow-lg">
                            <div className="text-5xl mb-4">💪</div>
                            <h4 className="text-xl font-bold text-gray-900 mb-3">肌肉重建</h4>
                            <p className="text-gray-600">
                                训练撕裂肌肉纤维，休息时肌肉修复并超量恢复，变得更加强壮有力
                            </p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-6 shadow-lg">
                            <div className="text-5xl mb-4">🔋</div>
                            <h4 className="text-xl font-bold text-gray-900 mb-3">能量储备</h4>
                            <p className="text-gray-600">
                                补充肌糖原储备，恢复ATP能量系统，为下次爆发蓄力
                            </p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-6 shadow-lg">
                            <div className="text-5xl mb-4">🧠</div>
                            <h4 className="text-xl font-bold text-gray-900 mb-3">神经修复</h4>
                            <p className="text-gray-600">
                                中枢神经系统需要恢复，降低过度训练风险，保持长期进步
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 p-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl">
                        <h4 className="text-xl font-bold mb-4">💡 休息日行动指南</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p>😴 充足睡眠 - 7-9小时深度睡眠</p>
                                <p>🥩 优质营养 - 充足蛋白质和碳水</p>
                                <p>🚶 主动恢复 - 散步、瑜伽、拉伸</p>
                            </div>
                            <div>
                                <p>💧 充分补水 - 2-3升水分</p>
                                <p>🧘 身心放松 - 冥想、阅读、音乐</p>
                                <p>📝 计划复盘 - 回顾训练进展</p>
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-lg text-gray-600 italic mt-8">
                    "强者懂得何时发力，智者懂得何时休息"
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    明天，你会因为今天的休息而变得更强 💪
                </p>
            </div>
        </Card>
    );
};

export default RestDayCard;
