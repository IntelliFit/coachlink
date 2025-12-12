'use client';

import React from 'react';
import { Award, Star } from 'lucide-react';
import { CoachesRow } from '@/types';
import { UpdateCoachProfileDto } from '@/app/api/coach/update-coach-profile/entity';

interface CoachAboutPanelProps {
    coach: CoachesRow;
}

const CoachAboutPanel: React.FC<CoachAboutPanelProps> = ({
    coach
}) => {
    // 安全默认值，避免真实教练缺少字段导致崩溃
    const safeAchievements = Array.isArray(coach.achievements) ? coach.achievements : [];

    const profile = (coach.profile || {}) as UpdateCoachProfileDto['profile'];

    return (
        <div className="space-y-6 min-h-[400px]">
            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">教学理念</h3>
                <p className="text-surface-600 leading-relaxed">
                    {profile.teachingPhilosophy || '无'}
                </p>
            </div>

            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">成就奖项</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(profile.achievements || []).map((achievement, index) => (
                        <div key={index} className="flex items-center space-x-3 p-4 bg-primary-50 border border-primary-300 dark:bg-primary-800 dark:border-primary-700 rounded-lg">
                            <Star className="w-6 h-6 text-primary-600" />
                            <span className="text-surface-700">{achievement}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CoachAboutPanel;