'use client';

import React, { useState, useEffect } from 'react';
import {
    Star,
    Users,
    Award,
    MessageCircle,
    ArrowLeft
} from 'lucide-react';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';
import CoachIntroduction from './CoachIntroduction';
import CoachContent from './CoachContent';
import CoachSubscription from './CoachSubscription';

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

const CoachProfilePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'about' | 'content' | 'reviews'>('about');
    const [coachContent, setCoachContent] = useState<ServiceCoachContent[]>([]);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [mySubscriptions, setMySubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [userSubscription, setUserSubscription] = useState<QueryCoachSubscription | null>(null);

    const [selectedTier, setSelectedTier] = useState<number | null>(null);
    const [coach, setCoach] = useState<CoachesRow>({
        achievements: [],
        avatar_url: null,
        bio: null,
        created_at: null,
        id: '',
        is_featured: null,
        name: '',
        rating: null,
        search_vector: '',
        specialties: [],
        status: null,
        title: null,
        total_students: null,
        updated_at: null,
        user_id: null,
        years_experience: null,
    });
    const safeAchievements = Array.isArray(coach.achievements) ? coach.achievements : [];
    const safeCertification = Array.isArray((coach as any).certification) ? (coach as any).certification : [];
    const [isLoadingCoach, setIsLoadingCoach] = useState(true);

    const router = useRouter();
    const params = useParams();
    const coachId = params.id;
    if (!coachId) {
        router.push('/coach');
    }

    const { showToast } = useToastContext();
    const { data: session } = useSession();

    // 初始化教练信息
    const initCoach = async () => {
        try {
            setIsLoadingCoach(true);
            const res = await coachService.getCoach({ id: coachId?.toString() || '' });
            if (res) {
                setCoach(res.coach);
            } else {
                showToast({ severity: 'error', summary: '获取教练信息失败' });
            }
        } catch (error) {
            console.error('获取教练信息失败:', error);
            showToast({ severity: 'error', summary: '获取教练信息失败' });
        } finally {
            setIsLoadingCoach(false);
        }
    };

    const initSubscriptions = async () => {
        const res = await subscriptionService.getCoachSubscriptions({ studentId: session?.user.id || '' });
        if (res) {
            setMySubscriptions(res.subscriptions || []);
            setUserSubscription(res.subscriptions.find(sub => sub.coach_id === coachId) || null);
        }
    }

    // 初始化拉取订阅与教练内容
    useEffect(() => {
        initSubscriptions();
        initCoach();
    }, []);

    // 获取教练内容
    useEffect(() => {
        const loadCoachContent = async () => {
            if (activeTab !== 'content' || !coach) return;

            setIsLoadingContent(true);
            setContentError(null);

            try {
                // TODO: 实现获取教练内容的逻辑
                // const response = await contentService.getCoachContent({
                //     coachId: coach.id,
                //     userId: getCurrentUserId(),
                //     limit: 20,
                //     offset: 0
                // });

                // setCoachContent(response.contents);

                // 临时模拟数据
                setCoachContent([
                    {
                        id: '1',
                        title: '高强度间歇训练指南',
                        content: '本指南将教你如何进行高效的HIIT训练，帮助你在短时间内燃烧更多卡路里，提高心肺功能。',
                        required_tier: 2,
                        is_featured: true,
                        views_count: 1250,
                        likes_count: 86,
                        comments_count: 12,
                        created_at: '2023-06-15T10:30:00Z',
                        tags: ['HIIT', '燃脂', '心肺功能'],
                        media_urls: [],
                        thumbnail_url: null,
                        content_type: 'article'
                    },
                    {
                        id: '2',
                        title: '增肌饮食计划',
                        content: '科学的增肌饮食是健身成功的关键。本计划将为你提供详细的营养建议和食谱。',
                        required_tier: 3,
                        is_featured: false,
                        views_count: 980,
                        likes_count: 64,
                        comments_count: 8,
                        created_at: '2023-06-10T14:15:00Z',
                        tags: ['增肌', '营养', '饮食'],
                        media_urls: [],
                        thumbnail_url: null,
                        content_type: 'article'
                    }
                ]);
            } catch (error) {
                console.error('获取教练内容失败:', error);
                setContentError('获取内容失败，请稍后重试');
                // 如果API失败，使用模拟数据
                setCoachContent([]);
            } finally {
                setIsLoadingContent(false);
            }
        };

        loadCoachContent();
    }, [activeTab, coach]);

    // 添加骨架屏组件
    const renderCoachSkeleton = () => (
        <div className="bg-surface animate-pulse">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* 头像区域骨架 */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 bg-surface-200 rounded-full mb-4"></div>
                        <div className="w-20 h-20 bg-surface-200 rounded-lg"></div>
                    </div>

                    {/* 详细信息区域骨架 */}
                    <div className="flex-1">
                        <div className="h-8 bg-surface-200 rounded w-1/3 mb-4"></div>
                        <div className="h-6 bg-surface-200 rounded w-1/4 mb-6"></div>

                        {/* 统计信息骨架 */}
                        <div className="flex space-x-4 mb-6">
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                            <div className="h-4 bg-surface-200 rounded w-16"></div>
                        </div>

                        {/* 专业领域骨架 */}
                        <div className="space-y-3 mb-6">
                            <div className="h-4 bg-surface-200 rounded w-1/4"></div>
                            <div className="flex space-x-2">
                                <div className="h-6 bg-surface-200 rounded-full w-16"></div>
                                <div className="h-6 bg-surface-200 rounded-full w-20"></div>
                                <div className="h-6 bg-surface-200 rounded-full w-16"></div>
                            </div>
                        </div>

                        {/* 简介骨架 */}
                        <div className="space-y-3">
                            <div className="h-4 bg-surface-200 rounded w-1/4"></div>
                            <div className="h-4 bg-surface-200 rounded w-full"></div>
                            <div className="h-4 bg-surface-200 rounded w-5/6"></div>
                            <div className="h-4 bg-surface-200 rounded w-4/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // 在教练信息加载完成前显示骨架屏
    if (isLoadingCoach) {
        return (
            <div className="min-h-screen bg-surface-50">
                {/* 顶部导航骨架 */}
                <div className="bg-surface shadow-sm border-b border-surface-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center space-x-2">
                                <div className="h-5 w-5 bg-surface-200 rounded"></div>
                                <div className="h-4 w-20 bg-surface-200 rounded"></div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="h-5 w-5 bg-surface-200 rounded"></div>
                                <div className="h-5 w-5 bg-surface-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
                {renderCoachSkeleton()}
            </div>
        );
    }

    const handleSubscribeSuccess = (tier?: number) => {
        // 如果传入了tier，说明是订阅操作，需要刷新订阅列表
        if (tier !== undefined) {
            initSubscriptions();
        }
        // 如果没有传入tier，说明是内容订阅，只需刷新当前组件
    };

    return (
        <div className="min-h-screen bg-surface-50">
            {/* 顶部导航 */}
            <div className="bg-surface shadow-sm border-b border-surface-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2">
                            <ArrowLeft
                                className="h-5 w-5 text-surface-500 hover:text-surface-700 cursor-pointer"
                                onClick={() => router.push('/coach')}
                            />
                            <div className="text-surface-700 font-bold">{coach.title || '专业健身教练'}</div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1 text-surface-500">
                                <Star className="h-5 w-5" />
                                <div>{typeof coach.rating === 'number' ? coach.rating : 4.8}</div>
                            </div>
                            <div className="flex items-center space-x-1 text-surface-500">
                                <Users className="h-5 w-5" />
                                <div>{typeof coach.total_students === 'number' ? coach.total_students : 0}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 教练介绍部分 */}
            <CoachIntroduction
                coach={coach}
                userSubscription={userSubscription}
            />

            {/* 标签页导航 */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="border-b border-surface-200">
                    <nav className="-mb-px flex space-x-8">
                        <button
                            onClick={() => setActiveTab('about')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'about'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                                }`}
                        >
                            关于教练
                        </button>
                        <button
                            onClick={() => setActiveTab('content')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'content'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                                }`}
                        >
                            教学内容
                        </button>
                        <button
                            onClick={() => setActiveTab('reviews')}
                            className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'reviews'
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                                }`}
                        >
                            学员评价
                        </button>
                    </nav>
                </div>
            </div>

            {/* 标签页内容 */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {activeTab === 'about' && (
                    <div className="space-y-6">
                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4">训练理念</h3>
                            <p className="text-gray-600 leading-relaxed">
                                {coach.training_philosophy || '专注于科学训练方法，结合个人特点制定专属计划，追求效率与安全的完美平衡。'}
                            </p>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4">专业认证</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {safeCertification.map((cert: string, index: number) => (
                                    <div key={index} className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                                        <Award className="w-6 h-6 text-yellow-600" />
                                        <span className="text-gray-700">{cert}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xl font-bold text-gray-900 mb-4">成就奖项</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {safeAchievements.map((achievement, index) => (
                                    <div key={index} className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                                        <Star className="w-6 h-6 text-blue-600" />
                                        <span className="text-gray-700">{achievement}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 教学内容 */}
                {activeTab === 'content' && (
                    <CoachContent
                        coachId={coach.id}
                        userSubscription={userSubscription}
                        isLoading={isLoadingContent}
                        contentError={contentError}
                        coachContent={coachContent}
                        onSubscribeSuccess={() => handleSubscribeSuccess()}
                    />
                )}

                {/* 学员评价 */}
                {activeTab === 'reviews' && (
                    <div className="space-y-6">
                        <div className="text-center py-12">
                            <MessageCircle className="w-16 h-16 text-surface-400 mx-auto mb-4" />
                            <p className="text-surface-600 text-lg">学员评价功能正在开发中...</p>
                        </div>
                    </div>
                )}
            </div>

            {/* 订阅计划区域 */}
            <CoachSubscription
                coach={coach}
                mySubscriptions={mySubscriptions}
                onSubscribeSuccess={(tier) => handleSubscribeSuccess(tier)}
                isSubscribing={isSubscribing}
                setIsSubscribing={setIsSubscribing}
            />
        </div>
    );
};

export default CoachProfilePage;