import React from 'react';
import { CheckCircle, Scale } from 'lucide-react';
import { Card } from 'primereact/card';

interface WeeklyProgressProps {
    completedSessions: number;
    totalSessions: number;
    totalVolume: number; // 总容量（吨）
}

const WeeklyProgress: React.FC<WeeklyProgressProps> = ({
    completedSessions,
    totalSessions,
    totalVolume
}) => {
    const completionPercentage = totalSessions > 0 
        ? Math.round((completedSessions / totalSessions) * 100) 
        : 0;

    return (
        <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                本周进度
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
                {/* 已完成训练 */}
                <Card className="shadow-sm">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-300 rounded-full">
                            <CheckCircle className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                {completedSessions}/{totalSessions}
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                已完成训练
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                完成度 {completionPercentage}%
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 总容量 */}
                <Card className="shadow-sm">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-full">
                            <Scale className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                {totalVolume.toFixed(1)}t
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                总容量
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                本周累计
                            </div>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default WeeklyProgress;
