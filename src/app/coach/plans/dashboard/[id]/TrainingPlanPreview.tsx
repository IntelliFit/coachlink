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
    onStart?: () => void; // 新增：开始训练
    onEdit?: () => void;  // 新增：编辑计划
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

    // 数据验证
    if (!plan || !plan.weeks || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">训练计划数据无效</h3>
                <p className="text-gray-600">请检查训练计划格式是否正确</p>
            </div>
        );
    }

    const currentWeekData = plan.weeks.find((w: any) => w.week === currentWeek);

    if (!currentWeekData || !currentWeekData.sessions) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">当前周数据缺失</h3>
                <p className="text-gray-600">请选择其他周次查看</p>
            </div>
        );
    }

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

    const renderWeekSelector = () => (
        <div className="flex items-center justify-between mb-6">
            <button
                onClick={() => setCurrentWeek(Math.max(1, currentWeek - 1))}
                disabled={currentWeek === 1}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex space-x-2">
                {Array.from({ length: plan.meta.duration_weeks }, (_, i) => i + 1).map(week => (
                    <button
                        key={week}
                        onClick={() => setCurrentWeek(week)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentWeek === week
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                    >
                        第{week}周
                    </button>
                ))}
            </div>

            <button
                onClick={() => setCurrentWeek(Math.min(plan.meta.duration_weeks, currentWeek + 1))}
                disabled={currentWeek === plan.meta.duration_weeks}
                className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </div>
    );

    const renderSessionCard = (session: any, dayIndex: number) => {
        const isSelected = selectedDay === `${currentWeek}-${session.day}-${dayIndex}`;

        return (
            <div
                key={`${currentWeek}-${session.day}-${dayIndex}`}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                onClick={() => setSelectedDay(isSelected ? null : `${currentWeek}-${session.day}-${dayIndex}`)}
            >
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-900">{getDayName(session.day)}</h3>
                            <p className="text-sm text-gray-600">{session.focus}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Clock className="w-4 h-4" />
                        <span>{(session.main || []).reduce((sum: number, e: any) => sum + (e.rest_sec || 0), 0) / 60}分钟</span>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* 主项训练 */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-900 flex items-center">
                            <Zap className="w-4 h-4 mr-1 text-yellow-500" />
                            主项训练
                        </h4>
                        {(session.main || []).map((exercise: any, idx: number) => (
                            <div key={idx} className="bg-gray-50 rounded p-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">{exercise.name}</span>
                                    <span className="text-sm text-gray-600">{exercise.sets}×{exercise.reps}</span>
                                </div>
                                {exercise.load_value && (
                                    <div className="text-sm text-gray-600 mt-1">
                                        负重: {exercise.load_value}kg ({exercise.load_type})
                                    </div>
                                )}
                                {exercise.notes && (
                                    <div className="text-sm text-gray-500 mt-1">{exercise.notes}</div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* 辅项训练 */}
                    {session.accessories && session.accessories.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-900 flex items-center">
                                <Check className="w-4 h-4 mr-1 text-green-500" />
                                辅助训练
                            </h4>
                            {session.accessories.map((exercise: any, idx: number) => (
                                <div key={idx} className="bg-blue-50 rounded p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium">{exercise.name}</span>
                                        <span className="text-sm text-gray-600">{exercise.sets}×{exercise.reps}</span>
                                    </div>
                                    {exercise.notes && (
                                        <div className="text-sm text-gray-500 mt-1">{exercise.notes}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* 增强说明 */}
                    {isSelected && session.notes && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <h5 className="text-sm font-medium text-blue-900 mb-2">今日重点</h5>
                            <p className="text-sm text-blue-800">{session.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderSummary = () => (
        <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">训练概览</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{plan.meta.duration_weeks}</div>
                    <div className="text-sm text-gray-600">训练周期</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{plan.meta.frequency_per_week}</div>
                    <div className="text-sm text-gray-600">每周次数</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{plan.weeks.reduce((acc: number, w: any) => acc + w.sessions.length, 0)}</div>
                    <div className="text-sm text-gray-600">总训练次数</div>
                </div>
                <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{plan.meta.experience_level || '-'}</div>
                    <div className="text-sm text-gray-600">难度等级</div>
                </div>
            </div>

            {plan.meta.safety_notes && plan.meta.safety_notes.length > 0 && (
                <div className="mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">安全提醒</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                        {plan.meta.safety_notes.map((note: string, idx: number) => (
                            <li key={idx}>{note}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );

    const handleSave = async () => {
        if (onSave) {
            await onSave(plan);
            setSaved(true);
        }
    };

    return (
        <div className="space-y-6">
            {/* 头部 */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">{plan.meta.title}</h2>
                    <p className="text-gray-600">{plan.meta.duration_weeks}周周期化训练计划</p>
                </div>
                {onBack && (
                    <button
                        onClick={onBack}
                        className="flex items-center text-gray-600 hover:text-gray-900"
                    >
                        <X className="w-5 h-5 mr-1" />
                        关闭
                    </button>
                )}
            </div>

            {/* 概览 */}
            {renderSummary()}

            {/* 周选择器 */}
            {renderWeekSelector()}

            {/* 周训练内容 */}
            {currentWeekData && (
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900">第{currentWeek}周训练安排</h3>
                    <div className="grid gap-4">
                        {currentWeekData.sessions.map((session: any, idx: number) => (
                            renderSessionCard(session, idx)
                        ))}
                    </div>
                </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end space-x-3 pt-4">
                {showSaveButton && (
                    <button
                        onClick={handleSave}
                        disabled={saved}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                        {saved ? (
                            <>
                                <Check className="w-5 h-5 inline mr-2" />已保存
                            </>
                        ) : (
                            <>
                                <Save className="w-5 h-5 inline mr-2" />保存计划
                            </>
                        )}
                    </button>
                )}
                {onEdit && (
                    <button
                        onClick={onEdit}
                        className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                    >
                        <Edit className="w-4 h-4 inline mr-2" />编辑
                    </button>
                )}
                {onStart && (
                    <button
                        onClick={onStart}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                        <Play className="w-4 h-4 inline mr-2" />开始训练
                    </button>
                )}
            </div>
        </div>
    );
};

export default TrainingPlanPreview;