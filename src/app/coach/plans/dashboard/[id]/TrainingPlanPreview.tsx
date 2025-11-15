// ====== 全面优化 + primary 色接管 ======

import React, { useState } from 'react';
import {
    Calendar,
    Clock,
    Target,
    Zap,
    Check,
    X,
    Play,
    Save,
    Edit,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';

interface TrainingPlanPreviewProps {
    plan: any;
    onBack?: () => void;
    onSave?: (plan: any) => void;
    onStart?: () => void;
    onEdit?: () => void;
    showSaveButton?: boolean;
}

const TrainingPlanPreview: React.FC<TrainingPlanPreviewProps> = ({
    plan,
    onBack,
    onSave,
    onStart,
    onEdit,
    showSaveButton = false
}) => {
    const [currentWeek, setCurrentWeek] = useState(1);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    if (!plan || !plan.weeks || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-surface-400" />
                </div>
                <h3 className="text-lg font-medium text-surface-900 mb-2">训练计划数据无效</h3>
                <p className="text-surface-600">请检查训练计划格式是否正确</p>
            </div>
        );
    }

    const currentWeekData = plan.weeks.find((w: any) => w.week === currentWeek);
    if (!currentWeekData) return null;

    const getDayName = (day: string) => {
        const dayMap: Record<string, string> = {
            'Mon': '周一',
            'Tue': '周二',
            'Wed': '周三',
            'Thu': '周四',
            'Fri': '周五',
            'Sat': '周六',
            'Sun': '周日'
        };
        return dayMap[day] || day;
    };

    // ===== 周选择器 =====
    const renderWeekSelector = () => (
        <div className="flex items-center justify-between mb-6">
            <button
                onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                disabled={currentWeek === 1}
                className="p-2 rounded-lg border border-surface-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-100 transition"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex space-x-2">
                {Array.from({ length: plan.meta.duration_weeks }, (_, i) => i + 1).map(week => (
                    <button
                        key={week}
                        onClick={() => setCurrentWeek(week)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            currentWeek === week
                                ? 'bg-primary-600 text-white shadow-sm'
                                : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
                        }`}
                    >
                        第{week}周
                    </button>
                ))}
            </div>

            <button
                onClick={() => setCurrentWeek(Math.min(plan.meta.duration_weeks, currentWeek + 1))}
                disabled={currentWeek === plan.meta.duration_weeks}
                className="p-2 rounded-lg border border-surface-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-100 transition"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );

    // ===== day 训练卡片 =====
    const renderSessionCard = (session: any, dayIndex: number) => {
        const id = `${currentWeek}-${session.day}-${dayIndex}`;
        const isSelected = selectedDay === id;

        return (
            <div
                key={id}
                className={`
                    border rounded-xl p-4 cursor-pointer transition-all bg-surface
                    ${isSelected ? 'border-primary-500 bg-primary-50' : 'border-surface-200'}
                `}
                onClick={() => setSelectedDay(isSelected ? null : id)}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-surface-900">{getDayName(session.day)}</h3>
                            <p className="text-sm text-surface-600">{session.focus}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 text-sm text-surface-500">
                        <Clock className="w-4 h-4" />
                        <span>
                            {((session.main || []).reduce((sum: number, e: any) => sum + (e.rest_sec || 0), 0) / 60).toFixed(0)}分钟
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* 主项训练 */}
                    <div>
                        <h4 className="text-sm font-medium text-surface-900 flex items-center mb-2">
                            <Zap className="w-4 h-4 mr-1 text-primary-500" />
                            主项训练
                        </h4>
                        {session.main?.map((exercise: any, idx: number) => (
                            <div key={idx} className="bg-surface-50 hover:bg-surface-100 rounded-lg p-3 mt-1">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{exercise.name}</span>
                                    <span className="text-sm text-surface-600">{exercise.sets}×{exercise.reps}</span>
                                </div>
                                {exercise.notes && (
                                    <div className="text-sm text-surface-500 mt-1">{exercise.notes}</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 辅助训练 */}
                    {session.accessories?.length > 0 && (
                        <div>
                            <h4 className="text-sm font-medium text-surface-900 flex items-center mb-2">
                                <Check className="w-4 h-4 mr-1 text-green-500" />
                                辅助训练
                            </h4>
                            {session.accessories.map((ex: any, idx: number) => (
                                <div key={idx} className="bg-surface-50 hover:bg-surface-100 rounded-lg p-3 mt-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{ex.name}</span>
                                        <span className="text-sm text-surface-600">{ex.sets}×{ex.reps}</span>
                                    </div>
                                    {ex.notes && <p className="text-sm text-surface-500 mt-1">{ex.notes}</p>}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 今日重点 */}
                    {isSelected && session.notes && (
                        <div className="mt-3 p-3 bg-primary-50 rounded-lg border border-primary-200">
                            <h5 className="text-sm font-medium text-primary-700 mb-1">今日重点</h5>
                            <p className="text-sm text-primary-700">{session.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ===== 概览 =====
    const renderSummary = () => (
        <div className="bg-surface-50 rounded-xl p-6 mb-6">
            <h3 className="text-lg font-semibold text-surface-900 mb-4">训练概览</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">{plan.meta.duration_weeks}</div>
                    <div className="text-sm text-surface-600">训练周期</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">{plan.meta.frequency_per_week}</div>
                    <div className="text-sm text-surface-600">每周次数</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">
                        {plan.weeks.reduce((acc: number, w: any) => acc + w.sessions.length, 0)}
                    </div>
                    <div className="text-sm text-surface-600">总训练次数</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-primary-600">
                        {plan.meta.experience_level || '-'}
                    </div>
                    <div className="text-sm text-surface-600">难度等级</div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* 头部 */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-surface-900">{plan.meta.title}</h2>
                    <p className="text-surface-600">{plan.meta.duration_weeks}周周期化训练计划</p>
                </div>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center text-surface-600 hover:text-surface-900 transition"
                    >
                        <X className="w-5 h-5 mr-1" />
                        关闭
                    </button>
                )}
            </div>

            {renderSummary()}
            {renderWeekSelector()}

            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-surface-900">第{currentWeek}周训练安排</h3>
                <div className="grid gap-4">
                    {currentWeekData.sessions.map((s: any, idx: number) => renderSessionCard(s, idx))}
                </div>
            </div>

            {/* 按钮 */}
            <div className="flex justify-end space-x-3 pt-4">
                {showSaveButton && (
                    <button
                        onClick={onSave}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                        <Save className="w-4 h-4 inline mr-2" />
                        保存计划
                    </button>
                )}
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="px-6 py-2 bg-surface-200 text-surface-800 rounded-lg hover:bg-surface-300 transition"
                    >
                        <Edit className="w-4 h-4 inline mr-2" />
                        编辑
                    </button>
                )}
                {onStart && (
                    <button
                        onClick={onStart}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition shadow-sm"
                    >
                        <Play className="w-4 h-4 inline mr-2" />
                        开始训练
                    </button>
                )}
            </div>
        </div>
    );
};

export default TrainingPlanPreview;
