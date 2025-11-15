import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
    TrendingUp,
    Award,
    Calendar,
    Target,
    Activity,
    Clock,
    CheckCircle,
    XCircle,
    RotateCcw
} from 'lucide-react';

interface TrainingProgressDashboardProps {
    userId: string;
    trainingPlanId?: string;
}

interface ProgressStats {
    totalSessions: number;
    completedSessions: number;
    skippedSessions: number;
    currentStreak: number;
    totalExercises: number;
    completedExercises: number;
    totalVolume: number;
    avgRPE: number;
    progressPercentage: number;
    lastTrainingDate?: string;
}

interface PersonalRecord {
    id: string;
    exercise_name: string;
    max_weight: number;
    max_reps: number;
    date_achieved: string;
    notes?: string;
}

interface WeeklyProgress {
    week: number;
    completed: number;
    total: number;
    percentage: number;
}

const TrainingProgressDashboard: React.FC<TrainingProgressDashboardProps> = ({
    userId,
    trainingPlanId
}) => {
    const [stats, setStats] = useState<ProgressStats | null>(null);
    const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
    const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTimeRange, setSelectedTimeRange] = useState<'week' | 'month' | 'all'>('week');

    useEffect(() => {
        loadProgressData();
    }, [userId, trainingPlanId, selectedTimeRange]);

    const loadProgressData = async () => {
        try {
            setLoading(true);
            await loadTrainingStats();
            await loadPersonalRecords();
            await loadWeeklyProgress();
        } catch (error) {
            console.error('加载训练数据失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTrainingStats = async () => {
        // 以真实数据为准：training_plan_details + workout_logs
        // 1) 计划总天次
        const { data: details } = await supabase
            .from('training_plan_details')
            .select('week_number, day_of_week, main_exercises, accessory_exercises')
            .eq('training_plan_id', trainingPlanId);

        const totalSessions = details?.length || 0;
        const totalExercises = (details || []).reduce((sum: number, d: any) => {
            const mainCount = Array.isArray(d?.main_exercises) ? d.main_exercises.length : 0;
            const accCount = Array.isArray(d?.accessory_exercises) ? d.accessory_exercises.length : 0;
            return sum + mainCount + accCount;
        }, 0);

        // 2) 已完成天次和训练量、最近一次训练
        const { data: logs } = await supabase
            .from('workout_logs')
            .select('id, week_number, log_date, entries')
            .eq('user_id', userId)
            .eq('training_plan_id', trainingPlanId);

        const completedSessions = logs?.length || 0;
        const lastTrainingDate = logs && logs.length > 0
            ? logs.map((l: any) => l.log_date).sort().slice(-1)[0]
            : undefined;

        // 估算总训练量：对 entries 中的每个动作，取 load_actual*reps_completed 的和
        const parseReps = (val: any): number => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                const m = val.match(/\d+/g);
                return m ? m.map(Number).reduce((a, b) => a + b, 0) : 0;
            }
            return 0;
        };
        const totalVolume = (logs || []).reduce((sum: number, log: any) => {
            const list = Array.isArray(log.entries) ? log.entries : [];
            const vol = list.reduce((s: number, e: any) => {
                const reps = parseReps(e?.reps_completed ?? e?.reps_planned ?? 0);
                const load = Number(e?.load_actual ?? e?.load_planned ?? 0) || 0;
                return s + reps * load;
            }, 0);
            return sum + vol;
        }, 0);

        // 3) 连续天数：从今天起向前检查连续有日志的天数
        const logSet = new Set((logs || []).map((l: any) => String(l.log_date)));
        let currentStreak = 0;
        const today = new Date();
        for (let i = 0; i < 30; i++) { // 最多回溯30天
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            if (logSet.has(key)) currentStreak++;
            else break;
        }

        const progressPercentage = totalSessions > 0
            ? Math.min(100, Math.round((completedSessions / totalSessions) * 100))
            : 0;

        setStats({
            totalSessions,
            completedSessions,
            skippedSessions: Math.max(0, totalSessions - completedSessions),
            currentStreak,
            totalExercises,
            completedExercises: 0,
            totalVolume,
            avgRPE: 0,
            progressPercentage,
            lastTrainingDate,
        });
    };

    const loadPersonalRecords = async () => {
        const { data, error } = await supabase
            .from('personal_records')
            .select('*')
            .eq('user_id', userId)
            .order('date_achieved', { ascending: false })
            .limit(10);

        if (!error && data) {
            setPersonalRecords(data);
        }
    };

    const loadWeeklyProgress = async () => {
        // 以计划明细和日志聚合构建每周进度
        const { data: plan } = await supabase
            .from('training_plans')
            .select('duration_weeks')
            .eq('id', trainingPlanId)
            .single();
        const durationWeeks = plan?.duration_weeks || 6;

        const { data: details } = await supabase
            .from('training_plan_details')
            .select('week_number')
            .eq('training_plan_id', trainingPlanId);
        const totalPerWeek: Record<number, number> = {};
        (details || []).forEach((d: any) => {
            totalPerWeek[d.week_number] = (totalPerWeek[d.week_number] || 0) + 1;
        });

        const { data: logs } = await supabase
            .from('workout_logs')
            .select('week_number')
            .eq('user_id', userId)
            .eq('training_plan_id', trainingPlanId);
        const completedPerWeek: Record<number, number> = {};
        (logs || []).forEach((l: any) => {
            completedPerWeek[l.week_number] = (completedPerWeek[l.week_number] || 0) + 1;
        });

        const allWeeks: WeeklyProgress[] = [];
        for (let w = 1; w <= durationWeeks; w++) {
            const total = totalPerWeek[w] || 0;
            const completed = Math.min(total, completedPerWeek[w] || 0);
            allWeeks.push({
                week: w,
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
            });
        }

        // 根据选择范围筛选显示
        const latestWeek = (logs || []).reduce((m: number, l: any) => Math.max(m, l.week_number || 1), 1) || 1;
        let display: WeeklyProgress[] = allWeeks;
        if (selectedTimeRange === 'week') {
            display = allWeeks.filter(w => w.week === latestWeek);
        } else if (selectedTimeRange === 'month') {
            const start = Math.max(1, latestWeek);
            const end = Math.min(durationWeeks, start + 3);
            display = allWeeks.filter(w => w.week >= start && w.week <= end);
        }

        setWeeklyProgress(display);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN', {
            month: 'short',
            day: 'numeric'
        });
    };

    const getDaysSinceLastTraining = () => {
        if (!stats?.lastTrainingDate) return '从未训练';
        const lastDate = new Date(stats.lastTrainingDate);
        const today = new Date();
        const diffTime = Math.abs(today.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return '今天';
        if (diffDays === 1) return '昨天';
        return `${diffDays}天前`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 头部统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-100 text-sm">完成进度</p>
                            <p className="text-2xl font-bold">{stats?.progressPercentage || 0}%</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-blue-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-100 text-sm">连续训练</p>
                            <p className="text-2xl font-bold">{stats?.currentStreak || 0}天</p>
                        </div>
                        <Activity className="w-8 h-8 text-green-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-100 text-sm">总训练量</p>
                            <p className="text-2xl font-bold">{Math.round(stats?.totalVolume || 0)}kg</p>
                        </div>
                        <Target className="w-8 h-8 text-purple-200" />
                    </div>
                </div>

                <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-orange-100 text-sm">最后训练</p>
                            <p className="text-2xl font-bold">{getDaysSinceLastTraining()}</p>
                        </div>
                        <Clock className="w-8 h-8 text-orange-200" />
                    </div>
                </div>
            </div>

            {/* 周进度 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">周进度</h3>
                    <div className="flex space-x-2">
                        {['week', 'month', 'all'].map(range => (
                            <button
                                key={range}
                                onClick={() => setSelectedTimeRange(range as any)}
                                className={`px-3 py-1 text-sm rounded-lg ${selectedTimeRange === range ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                    }`}
                            >
                                {range === 'week' ? '本周' : range === 'month' ? '本月' : '全部'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {weeklyProgress.map((week) => (
                        <div key={week.week} className="flex items-center space-x-4">
                            <div className="w-16 text-sm text-gray-600">第{week.week}周</div>
                            <div className="flex-1">
                                <div className="bg-gray-200 rounded-full h-2">
                                    <div
                                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${week.percentage}%` }}
                                    />
                                </div>
                            </div>
                            <div className="w-20 text-sm text-gray-600">
                                {week.completed}/{week.total}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 个人记录 */}
            {personalRecords.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900">个人记录</h3>
                        <Award className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="space-y-3">
                        {personalRecords.map((record) => (
                            <div key={record.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-gray-900">{record.exercise_name}</p>
                                    <p className="text-sm text-gray-600">
                                        {record.max_weight}kg × {record.max_reps}次
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900">{formatDate(record.date_achieved)}</p>
                                    {record.notes && <p className="text-xs text-gray-600">{record.notes}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 详细统计 */}
            <div className="bg-white rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">详细统计</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900">{stats?.totalSessions || 0}</div>
                        <div className="text-sm text-gray-600">总训练次数</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats?.completedSessions || 0}</div>
                        <div className="text-sm text-gray-600">已完成</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats?.skippedSessions || 0}</div>
                        <div className="text-sm text-gray-600">已跳过</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{stats?.avgRPE || 0}</div>
                        <div className="text-sm text-gray-600">平均RPE</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingProgressDashboard;