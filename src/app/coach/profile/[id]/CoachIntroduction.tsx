'use client';

import React from 'react';
import { Star, Users, Award, Calendar, Clock, CheckCircle, Heart, Play } from 'lucide-react';
import { CoachesRow } from '@/types';
import { ContactCoachButton } from '@/components/chat';

interface CoachIntroductionProps {
    coach: CoachesRow;
    userSubscription: any;
}

const CoachIntroduction: React.FC<CoachIntroductionProps> = ({ coach, userSubscription }) => {    
    // 安全默认值，避免真实教练缺少字段导致崩溃
    const safeSpecialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const safeTitle = coach.title || '专业健身教练';
    const safeRating = typeof coach.rating === 'number' ? coach.rating : 4.8;
    const safeStudents = typeof coach.total_students === 'number' ? coach.total_students : 0;
    const safeYears = typeof coach.years_experience === 'number' ? coach.years_experience : 1;
    const safeRespHrs = (coach as any).response_time_hours ?? 24;
    const safeFitnessLevel = (coach as any).fitness_level || '专业级';

    return (
        <div className="bg-surface">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* 头像和基本信息 */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 bg-gradient-to-r from-primary-500 to-red-600 rounded-full flex items-center justify-center mb-4">
                            {coach.avatar_url ? (
                                <img src={coach.avatar_url} alt={coach.name} className="w-full h-full rounded-full object-cover" />
                            ) : (
                                <span className="text-4xl font-bold text-surface">{coach.name.charAt(0)}</span>
                            )}
                        </div>

                        {(coach as any).featured_video_url && (
                            <div className="relative rounded-lg overflow-hidden">
                                <video className="w-full h-24 object-cover" poster="/api/placeholder/200/100">
                                    <source src={(coach as any).featured_video_url} type="video/mp4" />
                                </video>
                                <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                    <Play className="w-8 h-8 text-surface" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 详细信息 */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h1 className="text-3xl font-bold text-surface-900 mb-2">{coach.name}</h1>
                                <p className="text-xl text-surface-600 mb-2">{safeTitle}</p>
                                <div className="flex items-center space-x-4 text-sm text-surface-500">
                                    <div className="flex items-center space-x-1">
                                        <Star className="w-4 h-4 text-yellow-400 fill-current" />
                                        <span>{safeRating}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Users className="w-4 h-4" />
                                        <span>{safeStudents} 学员</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{safeYears} 年经验</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <Clock className="w-4 h-4" />
                                        <span>{safeRespHrs}h 回复</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 items-end">
                                {userSubscription && (
                                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                        已订阅 Tier {userSubscription.tier}
                                    </div>
                                )}
                                <ContactCoachButton 
                                    coachId={coach.id}
                                    label="联系教练"
                                    icon="pi pi-comment"
                                />
                            </div>
                        </div>

                        {/* 专业领域 */}
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-surface-700 mb-2">专业领域</h3>
                            <div className="flex flex-wrap gap-2">
                                {safeSpecialties.map((specialty, index) => (
                                    <span
                                        key={index}
                                        className="px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                                    >
                                        {specialty}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* 成就认证 */}
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-surface-700 mb-2">认证与成就</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center space-x-2">
                                    <Award className="w-4 h-4 text-yellow-600" />
                                    <span>{(coach as any).success_stories || 0} 成功案例</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <span>专业认证</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Star className="w-4 h-4 text-purple-600" />
                                    <span>{safeFitnessLevel}</span>
                                </div>
                                {coach.is_featured && (
                                    <div className="flex items-center space-x-2">
                                        <Heart className="w-4 h-4 text-red-600" />
                                        <span>明星教练</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 简介 */}
                        <div>
                            <h3 className="text-sm font-semibold text-surface-700 mb-2">教练简介</h3>
                            <p className="text-surface-600 leading-relaxed">{coach.bio}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoachIntroduction;