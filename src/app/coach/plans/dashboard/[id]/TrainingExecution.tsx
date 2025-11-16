import React, { useState, useEffect } from 'react';

import TrainingVideoUploader from '@/components/video/TrainingVideoUploader';

import {
    Play,
    Pause,
    Check,
    X,
    Clock,
    Target,
    Edit3,
    Save,
    RotateCcw,
    TrendingUp,
    Award
} from 'lucide-react';
import { userService } from '@/app/service/userService';
import { useToastContext } from '@/context/ToastContext';
import studentService from '@/app/service/studentService';
import { Skeleton } from 'primereact/skeleton';

interface Exercise {
    id?: string;
    name: string;
    exercise_type: 'main' | 'accessory' | 'warmup' | 'cooldown';
    sets_planned: number;
    reps_planned: string;
    load_planned?: number;
    sets_completed?: number;
    reps_completed?: string;
    load_actual?: number;
    rest_time?: number;
    notes?: string;
    difficulty_rating?: number;
}

interface TrainingSession {
    id?: string;
    week_number: number;
    day_of_week: string;
    session_focus: string;
    scheduled_date: string;
    status: 'scheduled' | 'in_progress' | 'completed' | 'skipped';
    exercises: Exercise[];
    notes?: string;
    rpe?: number;
    energy_level?: number;
}

interface TrainingExecutionProps {
    trainingPlanId: string;
    userId: string;
    onSessionComplete?: (session: TrainingSession) => void;
}

const TrainingExecution: React.FC<TrainingExecutionProps> = ({
    trainingPlanId,
    userId,
    onSessionComplete
}) => {
    const [sessions, setSessions] = useState<TrainingSession[]>([]);
    const [currentSession, setCurrentSession] = useState<TrainingSession | null>(null);
    const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
    const [isResting, setIsResting] = useState(false);
    const [restTimeLeft, setRestTimeLeft] = useState(0);
    const [loading, setLoading] = useState(true);
    const [trainingVideoIds, setTrainingVideoIds] = useState<string[]>([]);
    const [isSubmittingVideo, setIsSubmittingVideo] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const { showToast } = useToastContext();

    useEffect(() => {
        loadTodaySession();
    }, [trainingPlanId, userId]);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isResting && restTimeLeft > 0) {
            interval = setInterval(() => {
                setRestTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (isResting && restTimeLeft === 0) {
            setIsResting(false);
        }
        return () => clearInterval(interval);
    }, [isResting, restTimeLeft]);

    const loadTodaySession = async () => {
        try {
            setLoading(true);
            const today = new Date().toISOString().split('T')[0];
            // 前置校验：props 尚未就绪时不发起请求
            if (!userId || !trainingPlanId) {
                setLoading(false);
                return;
            }
            // 0) 兜底：若本地存在“今日已完成”标记，直接呈现已完成状态
            try {
                const completionKey = `workout_completed_${trainingPlanId}_${today}`;
                if (typeof localStorage !== 'undefined' && localStorage.getItem(completionKey) === '1') {
                    setCurrentSession({
                        id: `virtual-${today}`,
                        week_number: 0,
                        day_of_week: getCurrentDayOfWeek(),
                        session_focus: '今日训练',
                        scheduled_date: today,
                        status: 'completed',
                        exercises: []
                    });
                    setLoading(false);
                    return;
                }
            } catch { }

            // 1) 跳过探针调用，直接生成今日会话

            // 1) 直接从训练计划中生成今日会话，绕过复杂的Edge Function
            await createTodaySessionDirectly();
        } catch (error) {
            console.error('加载训练会话失败:', error);
            setCurrentSession(null);
        } finally {
            setLoading(false);
        }
    };

    const createTodaySessionDirectly = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const todayDay = getCurrentDayOfWeek();

            console.log('今天是:', todayDay);

            // 获取训练计划详情

            const res = await userService.getTrainingPlanDetail({ id: trainingPlanId.toString() });


            if (!res) {
                showToast({ severity: 'error', summary: '获取训练计划详情失败' });
                return;
            }

            const planDetails = res.details;

            if (!planDetails || planDetails.length === 0) {
                console.log('没有找到训练计划详情');
                return;
            }

            console.log('可用的训练日:', planDetails.map(p => p.day_of_week));

            // 找到今日的训练详情
            const todayDetails = planDetails.filter(d => d.day_of_week === todayDay);

            if (todayDetails.length === 0) {
                console.log('今日无训练安排');
                setCurrentSession(null);
                return;
            }

            console.log('找到今日训练:', todayDetails.length, '个');

            // 直接构建今日训练会话，不写入数据库
            const todayDetail = todayDetails[0];
            const exercises: Exercise[] = [];

            // 添加热身动作
            if (todayDetail.warmup && Array.isArray(todayDetail.warmup)) {
                todayDetail.warmup.forEach((ex: any) => {
                    exercises.push({
                        name: ex.name,
                        exercise_type: 'warmup',
                        sets_planned: ex.sets || 1,
                        reps_planned: ex.reps || '1',
                        rest_time: 60,
                        notes: ex.notes || ''
                    });
                });
            }

            // 添加主项动作
            if (todayDetail.main_exercises && Array.isArray(todayDetail.main_exercises)) {
                todayDetail.main_exercises.forEach((ex: any) => {
                    exercises.push({
                        name: ex.name,
                        exercise_type: 'main',
                        sets_planned: ex.sets || 1,
                        reps_planned: ex.reps || '1',
                        load_planned: ex.load_value || 0,
                        rest_time: ex.rest_sec || 180,
                        notes: ex.notes || ''
                    });
                });
            }

            // 添加辅助动作
            if (todayDetail.accessory_exercises && Array.isArray(todayDetail.accessory_exercises)) {
                todayDetail.accessory_exercises.forEach((ex: any) => {
                    exercises.push({
                        name: ex.name,
                        exercise_type: 'accessory',
                        sets_planned: ex.sets || 1,
                        reps_planned: ex.reps || '1',
                        load_planned: ex.load_value || 0,
                        rest_time: ex.rest_sec || 120,
                        notes: ex.notes || ''
                    });
                });
            }

            // 添加拉伸动作
            if (todayDetail.cooldown && Array.isArray(todayDetail.cooldown)) {
                todayDetail.cooldown.forEach((ex: any) => {
                    exercises.push({
                        name: ex.name,
                        exercise_type: 'cooldown',
                        sets_planned: 1,
                        reps_planned: ex.duration_min ? `${ex.duration_min}分钟` : '5分钟',
                        rest_time: 0,
                        notes: ex.notes || ''
                    });
                });
            }

            // 创建虚拟的训练会话（不保存到数据库）
            const virtualSession: TrainingSession = {
                id: `virtual-${today}`,
                week_number: todayDetail.week_number,
                day_of_week: todayDetail.day_of_week,
                session_focus: todayDetail.session_focus || '',
                scheduled_date: today,
                status: 'scheduled',
                exercises: exercises
            };

            console.log('创建虚拟训练会话成功:', virtualSession);
            setCurrentSession(virtualSession);

        } catch (error) {
            console.error('直接创建今日会话失败:', error);
            setCurrentSession(null);
        }
    };

    const createTodaySessionViaFunction = async () => {
        try {
            const { data, error } = await supabase.functions.invoke('create-today-session', {
                body: {
                    training_plan_id: trainingPlanId,
                    user_id: userId
                }
            });

            if (error) throw error;

            if (data?.success) {
                if (data.no_training) {
                    console.log('今日无训练安排');
                    setCurrentSession(null);
                } else {
                    // 重新加载会话数据
                    await loadTodaySession();
                }
            } else {
                throw new Error(data?.message || '创建今日会话失败');
            }
        } catch (error) {
            console.error('通过函数创建今日会话失败:', error);
            setCurrentSession(null);
        }
    };

    const createTodaySession = async () => {
        try {
            // 获取当前周的训练详情
            const res = await userService.getTrainingPlanDetail({ id: trainingPlanId.toString() });

            if (!res) {
                showToast({ severity: 'error', summary: '获取训练计划详情失败' });
                return;
            }

            const detailsData = res.details;

            if (detailsData && detailsData.length > 0) {
                const today = new Date().toISOString().split('T')[0];
                const todayDay = getCurrentDayOfWeek();

                const todayDetails = detailsData.filter(d =>
                    getDayOfWeekFromDate(d.day_of_week) === todayDay
                );

                if (todayDetails.length > 0) {
                    const exercises: Exercise[] = todayDetails.map(detail => ([
                        ...((detail.main_exercises as any[]) || []).map(ex => ({
                            name: ex.name,
                            exercise_type: 'main',
                            sets_planned: ex.sets,
                            reps_planned: ex.reps,
                            load_planned: ex.load_value,
                            rest_time: ex.rest_sec || 180,
                            notes: ex.notes
                        })),
                        ...((detail.accessory_exercises as any[]) || []).map(ex => ({
                            name: ex.name,
                            exercise_type: 'accessory',
                            sets_planned: ex.sets,
                            reps_planned: ex.reps,
                            load_planned: ex.load_value,
                            rest_time: ex.rest_sec || 120,
                            notes: ex.notes
                        }))
                    ])).flat();

                    const newSession: TrainingSession = {
                        week_number: todayDetails[0].week_number,
                        day_of_week: todayDetails[0].day_of_week,
                        session_focus: todayDetails[0].session_focus || '',
                        scheduled_date: today,
                        status: 'scheduled',
                        exercises: exercises
                    };

                    const res = await userService.createTrainingSession({
                        user_id: userId,
                        training_plan_id: trainingPlanId,
                        week_number: newSession.week_number,
                        day_of_week: newSession.day_of_week,
                        session_focus: newSession.session_focus,
                        scheduled_date: newSession.scheduled_date,
                        status: 'scheduled'
                    });

                    if (!res) {
                        throw new Error('Failed to insert training session');
                    } else {
                        const exerciseInserts = exercises.map(ex => ({
                            training_session_id: res.id,
                            exercise_name: ex.name,
                            exercise_type: ex.exercise_type,
                            sets_planned: ex.sets_planned,
                            reps_planned: ex.reps_planned,
                            load_planned: ex.load_planned,
                            rest_time: ex.rest_time,
                            notes: ex.notes
                        }));

                        const { error: exercisesError } = await supabase
                            .from('training_exercises')
                            .insert(exerciseInserts);

                        if (exercisesError) throw exercisesError;

                        await loadTodaySession();
                    }
                } else {
                    console.log('今日无训练安排');
                }
            }
        } catch (error) {
            console.error('创建今日会话失败:', error);
        }
    };

    const startSession = async () => {
        if (!currentSession) return;

        try {
            // 如果是虚拟会话，直接更新状态，不写数据库
            if (currentSession.id?.startsWith('virtual-')) {
                setCurrentSession(prev => prev ? { ...prev, status: 'in_progress' } : null);
                return;
            }

            // 如果是真实会话，更新数据库
            const { error } = await supabase
                .from('training_sessions')
                .update({ status: 'in_progress' })
                .eq('id', currentSession.id);

            if (error) throw error;

            setCurrentSession(prev => prev ? { ...prev, status: 'in_progress' } : null);
        } catch (error) {
            console.error('开始训练失败:', error);
        }
    };

    const startExercise = (exercise: Exercise) => {
        setActiveExercise(exercise);
    };

    const completeSet = (exerciseName: string, setNumber: number, actualReps: string, actualLoad?: number) => {
        if (!currentSession) return;

        const updatedExercises = currentSession.exercises.map(ex => {
            if (ex.name === exerciseName) {
                const completedSets = (ex.sets_completed || 0) + 1;
                const newReps = ex.reps_completed ? `${ex.reps_completed},${actualReps}` : actualReps;

                return {
                    ...ex,
                    sets_completed: completedSets,
                    reps_completed: newReps,
                    load_actual: actualLoad || ex.load_actual
                };
            }
            return ex;
        });

        setCurrentSession(prev => prev ? { ...prev, exercises: updatedExercises } : null);
    };

    const completeExercise = async (exercise: Exercise, notes?: string) => {
        if (!currentSession || !currentSession.id) return;

        try {
            const { error } = await supabase
                .from('training_exercises')
                .update({
                    sets_completed: exercise.sets_completed,
                    reps_completed: exercise.reps_completed,
                    load_actual: exercise.load_actual,
                    notes: notes || exercise.notes
                })
                .eq('training_session_id', currentSession.id)
                .eq('exercise_name', exercise.name);

            if (error) throw error;
        } catch (error) {
            console.error('保存训练动作失败:', error);
        }
    };

    const completeSession = async (notes?: string, rpe?: number, energyLevel?: number) => {
        if (!currentSession || !userId) {
            return;
        }


        // 提交训练总结视频
        try {
            if (trainingVideoIds.length > 0) {
                setMessage({ type: 'success', text: '训练视频已关联！' });
            }
        } catch (error) {
            console.error('处理训练视频失败:', error);
        }

        try {
            // 1) 写入 workout_logs（带上完整的训练数据和视频URL）
            await studentService.submitWorkoutLog({
                training_plan_id: trainingPlanId,
                training_session_id: currentSession.id?.startsWith('virtual-') ? undefined : currentSession.id,
                week_number: currentSession.week_number,
                day_of_week: currentSession.day_of_week,
                log_date: currentSession.scheduled_date,
                entries: currentSession.exercises.map(ex => ({
                    exercise_name: ex.name,
                    exercise_type: ex.exercise_type,
                    sets_planned: ex.sets_planned,
                    reps_planned: ex.reps_planned,
                    load_planned: ex.load_planned,
                    sets_completed: ex.sets_completed || 0,
                    reps_completed: ex.reps_completed || '',
                    load_actual: ex.load_actual || 0,
                    notes: ex.notes || ''
                })),
                notes: notes,
                video_ids: trainingVideoIds,
            });

            // 2) 可选：提示是否上传训练视频，若有视频URL可在此调用（示例注释）
            // const videoService = VideoService.getInstance();
            // await videoService.submitVideo(userId, { video_url: 'https://...', purpose: 'workout' });

            // 3) 标记本地会话完成，并同步更新后端 training_sessions 状态
            setCurrentSession(prev => prev ? { ...prev, status: 'completed', notes, rpe, energy_level: energyLevel } : null);
            // 仅当为真实会话时才更新数据库，虚拟ID不做PATCH
            if (currentSession.id && !currentSession.id.startsWith('virtual-')) {
                try {
                    await supabase.from('training_sessions').update({ status: 'completed', notes }).eq('id', currentSession.id);
                } catch (e) {
                    console.warn('同步更新会话状态失败（忽略继续）:', e);
                }
            }

            if (onSessionComplete) {
                onSessionComplete(currentSession);
            }

            // 4) 维持现有个人记录逻辑
            await updatePersonalRecords();

            // 5) 本地写入完成标记，刷新仍保持“已完成”
            try {
                const today = currentSession.scheduled_date || new Date().toISOString().split('T')[0];
                const completionKey = `workout_completed_${trainingPlanId}_${today}`;
                if (typeof localStorage !== 'undefined') localStorage.setItem(completionKey, '1');
            } catch { }
        } catch (error) {
            console.error('完成训练会话失败:', error);
        }
    };

    const updatePersonalRecords = async () => {
        if (!currentSession) return;

        try {
            // 使用 userService 更新个人记录
            await userService.updatePersonalRecords({
                userId: userId,
                exercises: currentSession.exercises.map(ex => ({
                    name: ex.name,
                    load_actual: ex.load_actual,
                    sets_completed: ex.sets_completed,
                    week_number: currentSession.week_number,
                    day_of_week: currentSession.day_of_week
                }))
            });
        } catch (error) {
            console.error('更新个人记录失败:', error);
            // 不阻塞主要流程
        }
    };

    const skipSession = async (reason?: string) => {
        if (!currentSession || !currentSession.id) return;

        try {
            const { error } = await supabase
                .from('training_sessions')
                .update({
                    status: 'skipped',
                    notes: reason || '用户跳过训练'
                })
                .eq('id', currentSession.id);

            if (error) throw error;

            setCurrentSession(prev => prev ? { ...prev, status: 'skipped', notes: reason } : null);
        } catch (error) {
            console.error('跳过训练失败:', error);
        }
    };

    const getCurrentDayOfWeek = () => {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return days[new Date().getDay()];
    };

    const getDayOfWeekFromDate = (day: string) => {
        const dayMap: Record<string, string> = {
            '周一': 'Mon',
            '周二': 'Tue',
            '周三': 'Wed',
            '周四': 'Thu',
            '周五': 'Fri',
            '周六': 'Sat',
            '周日': 'Sun',
            'Mon': 'Mon',
            'Tue': 'Tue',
            'Wed': 'Wed',
            'Thu': 'Thu',
            'Fri': 'Fri',
            'Sat': 'Sat',
            'Sun': 'Sun'
        };
        return dayMap[day] || day;
    };

    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton width="100%" height="8rem" />
                <Skeleton width="100%" height="4rem" />
                <Skeleton width="100%" height="6rem" />
                <Skeleton width="100%" height="4rem" />
                <Skeleton width="100%" height="6rem" />
            </div>
        );
    }

    if (!currentSession) {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">今日无训练安排</h3>
                <p className="text-gray-600">休息日是恢复的重要部分</p>
            </div>
        );
    }

    if (currentSession.status === 'completed') {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">今日训练已完成！</h3>
                <p className="text-gray-600">继续保持，期待明天的训练</p>
            </div>
        );
    }

    if (currentSession.status === 'skipped') {
        return (
            <div className="text-center py-8">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <RotateCcw className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">今日训练已跳过</h3>
                <p className="text-gray-600">{currentSession.notes || '明天继续加油！'}</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 消息提示 */}
            {message && (
                <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' :
                    message.type === 'error' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'
                    }`}>
                    {message.text}
                    <button
                        onClick={() => setMessage(null)}
                        className="ml-2 text-sm underline"
                    >
                        关闭
                    </button>
                </div>
            )}
            {/* 头部信息 */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold">{currentSession.session_focus}</h2>
                        <p className="text-blue-100">第{currentSession.week_number}周 · {getDayOfWeekFromDate(currentSession.day_of_week)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-blue-100">{currentSession.exercises.length}个动作</p>
                        <p className="text-2xl font-bold">{currentSession.exercises.reduce((acc, ex) => acc + ex.sets_planned, 0)}组</p>
                    </div>
                </div>
            </div>

            {/* 训练控制 */}
            {currentSession.status === 'scheduled' && (
                <div className="flex justify-center">
                    <button
                        onClick={startSession}
                        className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2"
                    >
                        <Play className="w-5 h-5" />
                        <span>开始训练</span>
                    </button>
                </div>
            )}

            {/* 训练动作列表 */}
            {currentSession.status === 'in_progress' && (
                <div className="space-y-4">
                    {currentSession.exercises.map((exercise, index) => (
                        <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <h3 className="font-semibold text-gray-900">{exercise.name}</h3>
                                    <p className="text-sm text-gray-600">{exercise.sets_planned}组 × {exercise.reps_planned}</p>
                                </div>
                                <div className="text-right">
                                    {exercise.load_planned && (
                                        <p className="text-sm font-medium text-gray-900">{exercise.load_planned}kg</p>
                                    )}
                                    <p className="text-sm text-gray-600">休息{exercise.rest_time || 180}s</p>
                                </div>
                            </div>

                            {/* 组数追踪 */}
                            <div className="space-y-2">
                                {Array.from({ length: exercise.sets_planned }, (_, i) => i + 1).map(setNumber => (
                                    <div key={setNumber} className="flex items-center space-x-3">
                                        <div className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-sm font-medium"
                                            style={{
                                                backgroundColor: (exercise.sets_completed || 0) >= setNumber ? '#10B981' : 'transparent',
                                                color: (exercise.sets_completed || 0) >= setNumber ? 'white' : '#374151',
                                                borderColor: (exercise.sets_completed || 0) >= setNumber ? '#10B981' : '#D1D5DB'
                                            }}
                                        >
                                            {(exercise.sets_completed || 0) >= setNumber ? <Check className="w-4 h-4" /> : setNumber}
                                        </div>

                                        {(exercise.sets_completed || 0) >= setNumber ? (
                                            <span className="text-sm text-green-600">已完成 - {exercise.reps_completed?.split(',')[setNumber - 1]}次</span>
                                        ) : (
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="text"
                                                    placeholder={exercise.reps_planned}
                                                    className="w-20 px-2 py-1 border rounded text-sm"
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const input = (e.target as HTMLInputElement).value;
                                                            const actualLoad = prompt('实际负重(kg):', exercise.load_planned?.toString() || '');
                                                            completeSet(exercise.name, setNumber, input, actualLoad ? parseFloat(actualLoad) : undefined);
                                                            (e.target as HTMLInputElement).value = '';
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm text-gray-600">次</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* 动作说明 */}
                            {exercise.notes && (
                                <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
                                    {exercise.notes}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* 休息时间 */}
            {isResting && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 text-center">
                        <Clock className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                        <h3 className="text-xl font-bold mb-2">休息时间</h3>
                        <p className="text-3xl font-mono text-blue-600">{formatTime(restTimeLeft)}</p>
                        <button
                            onClick={() => {
                                setIsResting(false);
                                setRestTimeLeft(0);
                            }}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            跳过休息
                        </button>
                    </div>
                </div>
            )}

            {/* 会话完成 */}
            {currentSession.status === 'in_progress' && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-semibold mb-3">训练完成</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">训练感受 (RPE 1-10)</label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg"
                                onChange={(e) => {
                                    if (currentSession) {
                                        setCurrentSession({ ...currentSession, rpe: parseInt(e.target.value) });
                                    }
                                }}
                            >
                                {[...Array(10)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">精力水平 (1-10)</label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg"
                                onChange={(e) => {
                                    if (currentSession) {
                                        setCurrentSession({ ...currentSession, energy_level: parseInt(e.target.value) });
                                    }
                                }}
                            >
                                {[...Array(10)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                            <textarea
                                className="w-full px-3 py-2 border rounded-lg"
                                rows={2}
                                placeholder="记录今日训练感受..."
                                onChange={(e) => {
                                    if (currentSession) {
                                        setCurrentSession({ ...currentSession, notes: e.target.value });
                                    }
                                }}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">训练视频（可选）</label>
                            <TrainingVideoUploader
                                userId={userId}
                                context={{
                                    type: 'completion',
                                    training_plan_id: trainingPlanId,
                                    training_session_id: currentSession.id?.startsWith('virtual-') ? undefined : currentSession.id,
                                    week_number: currentSession.week_number,
                                    day_of_week: currentSession.day_of_week,
                                    requires_review: true
                                }}
                                onUploadSuccess={(video) => {
                                    setTrainingVideoIds(prev => [...prev, video.id]);
                                    setMessage({ type: 'success', text: '训练视频上传成功！' });
                                }}
                                onUploadError={(error) => {
                                    setMessage({ type: 'error', text: `视频上传失败: ${error.message}` });
                                }}
                                showUrlInput={true}
                            />
                        </div>
                    </div>

                    <div className="flex justify-end space-x-3 mt-4">
                        <button
                            onClick={() => skipSession('用户主动跳过')}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                        >
                            跳过训练
                        </button>
                        <button
                            onClick={async () => {
                                if (!currentSession) return;
                                setIsSubmittingVideo(true);
                                try {
                                    await completeSession(currentSession.notes, currentSession.rpe, currentSession.energy_level);
                                    setMessage({ type: 'success', text: '训练完成提交成功！' });
                                } catch (error) {
                                    console.error('提交训练失败:', error);
                                    setMessage({ type: 'error', text: '提交训练失败，请重试' });
                                } finally {
                                    setIsSubmittingVideo(false);
                                }
                            }}
                            disabled={isSubmittingVideo}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                            {isSubmittingVideo ? '提交中...' : '完成训练'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TrainingExecution;