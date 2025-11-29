import React from 'react';
import { Brain, MessageCircle, Star, Clock, Play, BookOpen } from 'lucide-react';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';

interface Coach {
    id: string;
    name: string;
    title?: string;
    rating?: number;
    avatarUrl?: string;
}

interface Exercise {
    name: string;
    sets: string;
}

interface TrainingSession {
    id: string;
    title: string;
    duration: number; // 分钟
    exerciseCount: number;
    exercises: Exercise[];
    planId: string;
}

interface CoachTrainingCardProps {
    coach: Coach;
    session: TrainingSession | null;
}

const CoachTrainingCard: React.FC<CoachTrainingCardProps> = ({ coach, session }) => {
    const router = useRouter();

    if (!session) {
        // 今天没有训练安排
        return (
            <div className="rounded-lg overflow-hidden p-card mb-4 border-l-4 border-gray-300">
                <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-gray-600 dark:text-gray-300">
                            {coach.name.charAt(0)}
                        </span>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">
                            教练: {coach.name}
                        </div>
                        {coach.title && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{coach.title}</div>
                        )}
                    </div>
                </div>
                <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <div className="text-2xl mb-2">😌</div>
                    <div className="text-sm">今日休息日</div>
                    <div className="text-xs opacity-70">休息不是懈怠，而是成长的必经之路</div>
                </div>
            </div>
        );
    }

    return (
        <div className="rounded-lg overflow-hidden p-card mb-4 border-l-4 border-primary-500 hover:shadow-lg transition-shadow">
            {/* 教练标签 */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-primary-600 dark:text-primary-300">
                            {coach.name.charAt(0)}
                        </span>
                    </div>
                    <div>
                        <div className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                            教练: {coach.name}
                        </div>
                        {coach.title && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{coach.title}</div>
                        )}
                    </div>
                </div>
                {coach.rating && (
                    <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                        <span className="text-sm text-gray-600 dark:text-gray-400">{coach.rating}</span>
                    </div>
                )}
            </div>

            {/* 训练标题和信息 */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {session.title}
            </h3>
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-4">
                <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>预计时长 {session.duration} 分钟</span>
                </div>
                <div className="flex items-center space-x-1">
                    <Brain className="w-4 h-4" />
                    <span>{session.exerciseCount} 个动作</span>
                </div>
            </div>

            {/* 动作预览 */}
            <div className="space-y-2 mb-4">
                {session.exercises.slice(0, 2).map((exercise, idx) => (
                    <div key={idx} className="flex items-center space-x-3 bg-gray-50 dark:bg-gray-800 p-2 rounded">
                        <div className="w-6 h-6 bg-white dark:bg-gray-700 rounded flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300">
                            {idx + 1}
                        </div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">{exercise.name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{exercise.sets}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 操作按钮 */}
            <div className="flex items-center justify-between">
                <Button
                    label="查看计划"
                    icon="pi pi-book"
                    className="p-button-text p-button-sm"
                    onClick={() => router.push(`/coach/plans/dashboard/${session.planId}`)}
                />
                <Button
                    label="开始训练"
                    icon="pi pi-play"
                    className="p-button-primary"
                    onClick={() => router.push(`/coach/plans/dashboard/${session.planId}/training-execution`)}
                />
            </div>
        </div>
    );
};

export default CoachTrainingCard;
