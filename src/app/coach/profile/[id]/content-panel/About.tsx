'use client';

import React from 'react';
import { Award, Star } from 'lucide-react';

interface CoachAboutPanelProps {
    coach: any;
}

const CoachAboutPanel: React.FC<CoachAboutPanelProps> = ({ coach }) => {
    // 安全默认值，避免真实教练缺少字段导致崩溃
    const safeSpecialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const safeAchievements = Array.isArray(coach.achievements) ? coach.achievements : [];
    const safeCertification = Array.isArray((coach as any).certification) ? (coach as any).certification : [];

    return (
        <div className="space-y-6 min-h-[400px]">
            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">训练理念</h3>
                <p className="text-surface-600 leading-relaxed">
                    {(coach as any).training_philosophy || '专注于科学训练方法，结合个人特点制定专属计划，追求效率与安全的完美平衡。'}
                </p>
            </div>

            {safeCertification.length > 0 && (
                <div>
                    <h3 className="text-xl font-bold text-surface-900 mb-4">专业认证</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {safeCertification.map((cert: string, index: number) => (
                            <div key={index} className="flex items-center space-x-3 p-4 bg-surface-50 rounded-lg">
                                <Award className="w-6 h-6 text-yellow-600" />
                                <span className="text-surface-700">{cert}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">成就奖项</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {safeAchievements.map((achievement, index) => (
                        <div key={index} className="flex items-center space-x-3 p-4 bg-blue-50 border border-blue-300 dark:bg-blue-700/30 dark:border-blue-700 rounded-lg">
                            <Star className="w-6 h-6 text-blue-600" />
                            <span className="text-surface-700">{achievement}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CoachAboutPanel;