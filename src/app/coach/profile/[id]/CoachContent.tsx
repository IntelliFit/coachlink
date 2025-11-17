'use client';

import React, { useState, useEffect } from 'react';
import { TabView, TabPanel, TabViewChangeEvent } from 'primereact/tabview';
import { MessageCircle, Award, Star } from 'lucide-react';
import CoachContentItem from './CoachContentItem';
import CoachContentSkeleton from './CoachContentSkeleton';

// 临时定义ServiceCoachContent类型，直到找到真正的定义
type ServiceCoachContent = {
    id: string;
    title: string;
    content: string;
    required_tier: number;
    is_featured: boolean;
    views_count: number;
    likes_count: number;
    comments_count: number;
    created_at: string;
    tags: string[];
    media_urls: string[];
    thumbnail_url: string | null;
    content_type: string;
};

interface CoachContentProps {
    coach: any;
    coachId: string;
    userSubscription: any;
    isLoading: boolean;
    contentError: string | null;
    coachContent: ServiceCoachContent[];
    onSubscribeSuccess: () => void;
    activeTab: number;
    onTabChange: (tab: number) => void;
}

const CoachContent: React.FC<CoachContentProps> = ({
    coach,
    coachId,
    userSubscription,
    isLoading,
    contentError,
    coachContent,
    onSubscribeSuccess,
    activeTab,
    onTabChange
}) => {
    // 安全默认值，避免真实教练缺少字段导致崩溃
    const safeSpecialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const safeAchievements = Array.isArray(coach.achievements) ? coach.achievements : [];
    const safeCertification = Array.isArray((coach as any).certification) ? (coach as any).certification : [];

    const handleTabChange = (e: TabViewChangeEvent) => {
        onTabChange(e.index);
    };

    if (isLoading) {
        return <CoachContentSkeleton />;
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TabView activeIndex={activeTab} onTabChange={handleTabChange}>
                <TabPanel header="关于教练">
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-surface-900 mb-4">训练理念</h3>
                            <p className="text-surface-600 leading-relaxed">
                                {(coach as any).training_philosophy || '专注于科学训练方法，结合个人特点制定专属计划，追求效率与安全的完美平衡。'}
                            </p>
                        </div>

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

                        <div>
                            <h3 className="text-xl font-bold text-surface-900 mb-4">成就奖项</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {safeAchievements.map((achievement, index) => (
                                    <div key={index} className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                                        <Star className="w-6 h-6 text-blue-600" />
                                        <span className="text-surface-700">{achievement}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </TabPanel>
                <TabPanel header="教学内容">
                    {contentError ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-4">{contentError}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="text-primary-600 hover:text-primary-700 font-medium"
                            >
                                重新加载
                            </button>
                        </div>
                    ) : coachContent.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-surface-500">该教练还没有发布任何内容</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {coachContent.map((content) => (
                                <CoachContentItem
                                    key={content.id}
                                    content={content}
                                    coachId={coachId}
                                    userSubscription={userSubscription}
                                    onSubscribeSuccess={onSubscribeSuccess}
                                />
                            ))}
                        </div>
                    )}
                </TabPanel>
                <TabPanel header="学员评价">
                    <div className="space-y-6">
                        <div className="text-center py-12">
                            <MessageCircle className="w-16 h-16 text-surface-400 mx-auto mb-4" />
                            <p className="text-surface-600 text-lg">学员评价功能正在开发中...</p>
                        </div>
                    </div>
                </TabPanel>
            </TabView>
        </div>
    );
};

export default CoachContent;