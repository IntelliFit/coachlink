import React, { useState, useEffect } from 'react';
import { userService } from '@/app/service/userService';
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
import type { GetTrainingProgressResponseDto } from '@/app/api/user/get-training-progress/entity';
import type { GetPersonalRecordsResponseDto } from '@/app/api/user/get-personal-records/entity';
import type { GetWeeklyProgressResponseDto } from '@/app/api/user/get-weekly-progress/entity';
import { Skeleton } from 'primereact/skeleton';

interface TrainingProgressDashboardProps {
    userId: string;
    trainingPlanId?: string;
}

const TrainingProgressDashboard: React.FC<TrainingProgressDashboardProps> = ({
    userId,
    trainingPlanId
}) => {
    const [stats, setStats] = useState<GetTrainingProgressResponseDto | null>(null);
    const [personalRecords, setPersonalRecords] = useState<GetPersonalRecordsResponseDto['personalRecords']>([]);
    const [weeklyProgress, setWeeklyProgress] = useState<GetWeeklyProgressResponseDto['weeklyProgress']>([]);
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
        try {
            const data = await userService.getTrainingProgress({ 
                training_plan_id: trainingPlanId 
            });
            
            if (data) {
                setStats(data);
            }
        } catch (error) {
            console.error('加载训练统计数据失败:', error);
        }
    };

    const loadPersonalRecords = async () => {
        try {
            const data = await userService.getPersonalRecords({ user_id: userId });
            
            if (data) {
                setPersonalRecords(data.personalRecords);
            }
        } catch (error) {
            console.error('加载个人记录失败:', error);
        }
    };

    const loadWeeklyProgress = async () => {
        try {
            const data = await userService.getWeeklyProgress({ 
                training_plan_id: trainingPlanId,
                time_range: selectedTimeRange
            });
            
            if (data) {
                setWeeklyProgress(data.weeklyProgress);
            }
        } catch (error) {
            console.error('加载周进度失败:', error);
        }
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
            <div className="space-y-6">
                {/* 头部统计卡片骨架屏 */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Skeleton width="100%" height="6rem" />
                    <Skeleton width="100%" height="6rem" />
                    <Skeleton width="100%" height="6rem" />
                    <Skeleton width="100%" height="6rem" />
                </div>
                
                {/* 周进度骨架屏 */}
                <Skeleton width="100%" height="12rem" />
                
                {/* 个人记录骨架屏 */}
                <Skeleton width="100%" height="10rem" />
                
                {/* 详细统计骨架屏 */}
                <Skeleton width="100%" height="8rem" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 头部统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-primary-100 text-sm">完成进度</p>
                            <p className="text-2xl font-bold">{stats?.progressPercentage || 0}%</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-primary-200" />
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
            <div className="bg-surface rounded-lg shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-900">周进度</h3>
                    <div className="flex space-x-2">
                        {['week', 'month', 'all'].map(range => (
                            <button
                                key={range}
                                onClick={() => setSelectedTimeRange(range as any)}
                                className={`px-3 py-1 text-sm rounded-lg ${selectedTimeRange === range ? 'bg-primary-600 text-white' : 'bg-surface-100 text-700 hover:bg-surface-200'
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
                            <div className="w-16 text-sm text-600">第{week.week}周</div>
                            <div className="flex-1">
                                <div className="bg-surface-200 rounded-full h-2">
                                    <div
                                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                        style={{ width: `${week.percentage}%` }}
                                    />
                                </div>
                            </div>
                            <div className="w-20 text-sm text-600">
                                {week.completed}/{week.total}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* 个人记录 */}
            {personalRecords.length > 0 && (
                <div className="bg-surface rounded-lg shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-900">个人记录</h3>
                        <Award className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="space-y-3">
                        {personalRecords.map((record) => (
                            <div key={record.id} className="flex items-center justify-between p-3 bg-surface-50 rounded-lg">
                                <div>
                                    <p className="font-medium text-900">{record.exercise_name}</p>
                                    <p className="text-sm text-600">
                                        {record.max_weight}kg × {record.max_reps}次
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-900">{formatDate(record.date_achieved)}</p>
                                    {record.notes && <p className="text-xs text-600">{record.notes}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 详细统计 */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
                <h3 className="text-lg font-semibold text-900 mb-4">详细统计</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                        <div className="text-2xl font-bold text-900">{stats?.totalSessions || 0}</div>
                        <div className="text-sm text-600">总训练次数</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{stats?.completedSessions || 0}</div>
                        <div className="text-sm text-600">已完成</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{stats?.skippedSessions || 0}</div>
                        <div className="text-sm text-600">已跳过</div>
                    </div>
                    <div className="text-center">
                        <div className="text-2xl font-bold text-primary-600">{stats?.avgRPE || 0}</div>
                        <div className="text-sm text-600">平均RPE</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TrainingProgressDashboard;