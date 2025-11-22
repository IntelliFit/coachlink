/**
 * ProgressChart 组件 - 训练进步折线图
 * 
 * 显示学员的训练进步情况：
 * - 主项和副项的进步组时间线
 * - 每个进步组的估算1RM
 */

import React, { useEffect, useState } from 'react';
import { trainingService } from '@/app/service/trainingService';
import { Award, TrendingUp, Calendar } from 'lucide-react';
import type { BreakthroughRecord } from '@/app/api/training/get-breakthroughs/entity';

interface ProgressChartProps {
    userId: string;
    trainingPlanId: string;
}

const ProgressChart: React.FC<ProgressChartProps> = ({ userId, trainingPlanId }) => {
    const [breakthroughs, setBreakthroughs] = useState<BreakthroughRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedExercise, setSelectedExercise] = useState<string>('all');
    const [exerciseCount, setExerciseCount] = useState(0);

    useEffect(() => {
        loadProgressData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, trainingPlanId]);

    const loadProgressData = async () => {
        setLoading(true);
        try {
            const result = await trainingService.getBreakthroughs({
                training_plan_id: trainingPlanId,
                user_id: userId
            });

            if (result) {
                setBreakthroughs(result.breakthroughs);
                setExerciseCount(result.exerciseCount);
            }
        } catch (err) {
            console.error('加载进步数据失败:', err);
        } finally {
            setLoading(false);
        }
    };

    // 获取所有涉及的动作
    const exercises = Array.from(new Set(breakthroughs.map(b => b.exercise_name))).sort();

    // 过滤数据
    const filteredBreakthroughs = selectedExercise === 'all'
        ? breakthroughs
        : breakthroughs.filter(b => b.exercise_name === selectedExercise);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (breakthroughs.length === 0) {
        return (
            <div className="bg-surface-50 rounded-lg p-8 text-center">
                <Award className="w-12 h-12 text-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-900 mb-2">还没有进步记录</h3>
                <p className="text-600">
                    在训练时标记进步组，这里就会显示你的进步历程！
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 头部 */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-bold text-900 flex items-center">
                        <TrendingUp className="w-6 h-6 mr-2 text-primary-600" />
                        训练进步历程
                    </h3>
                    <p className="text-sm text-600 mt-1">
                        追踪主项和副项训练的每一次突破
                    </p>
                </div>

                {/* 动作选择器 */}
                {exercises.length > 0 && (
                    <select
                        value={selectedExercise}
                        onChange={(e) => setSelectedExercise(e.target.value)}
                        className="px-4 py-2 border border-surface-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        aria-label="选择训练动作"
                    >
                        <option value="all">所有动作</option>
                        {exercises.map(ex => (
                            <option key={ex} value={ex}>{ex}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* 统计摘要 */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-primary-600">{breakthroughs.length}</div>
                    <div className="text-sm text-600 mt-1">进步组总数</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">
                        {exerciseCount}
                    </div>
                    <div className="text-sm text-600 mt-1">训练动作数</div>
                </div>
            </div>

            {/* 进步组时间线 */}
            {filteredBreakthroughs.length > 0 && (
                <div className="bg-surface rounded-lg border border-surface-200 p-6">
                    <h4 className="text-lg font-bold text-900 mb-4 flex items-center">
                        <Calendar className="w-5 h-5 mr-2 text-orange-600" />
                        进步组时间线
                    </h4>

                    <div className="space-y-4">
                        {filteredBreakthroughs.map((breakthrough, index) => {
                            const date = new Date(breakthrough.date);
                            const formattedDate = date.toLocaleDateString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            });

                            return (
                                <div key={index} className="flex items-start space-x-4">
                                    {/* 时间线点 */}
                                    <div className="flex flex-col items-center">
                                        <div className="w-4 h-4 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-lg" />
                                        {index < filteredBreakthroughs.length - 1 && (
                                            <div className="w-0.5 h-12 bg-surface-300" />
                                        )}
                                    </div>

                                    {/* 内容 */}
                                    <div className="flex-1 pb-4">
                                        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 border border-yellow-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center space-x-2">
                                                    <h5 className="font-bold text-900">{breakthrough.exercise_name}</h5>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${breakthrough.exercise_category === 'main'
                                                        ? 'bg-primary-100 text-primary-700'
                                                        : 'bg-green-100 text-green-700'
                                                        }`}>
                                                        {breakthrough.exercise_category === 'main' ? '主项' : '副项'}
                                                    </span>
                                                </div>
                                                <span className="text-xs text-500">
                                                    第{breakthrough.week_number}周 第{breakthrough.day_number}天
                                                </span>
                                            </div>
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-2xl font-bold text-orange-600">
                                                        {breakthrough.weight}kg × {breakthrough.reps}次
                                                    </span>
                                                    <span className="text-sm text-600">{formattedDate}</span>
                                                </div>
                                                {/* 估算1RM */}
                                                <div className="flex items-center justify-between bg-surface rounded px-3 py-2">
                                                    <span className="text-sm text-600">估算1RM</span>
                                                    <span className="text-lg font-bold text-purple-600">
                                                        {breakthrough.estimated_1rm}kg
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProgressChart;


