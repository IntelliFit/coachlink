'use client';

import React, { useState, useEffect } from 'react';
import {
    Star,
    Users,
    Award,
    Calendar,
    MessageCircle,
    Brain,
    Clock,
    CheckCircle,
    Heart,
    Share2,
    ArrowLeft,
    Play,
    Image,
    ThumbsUp,
    Eye,
    Lock
} from 'lucide-react';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types'; // 添加这一行导入
// import { contentService, ServiceCoachContent } from '@/app/service/contentService'; // 补充导入

const CoachProfilePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'about' | 'content' | 'reviews'>('about');
    const [coachContent, setCoachContent] = useState<ServiceCoachContent[]>([]);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [mySubscriptions, setMySubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [selectedTier, setSelectedTier] = useState<number | null>(null);
    const [coach, setCoach] = useState<CoachesRow | null>(null);
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
                const response = await contentService.getCoachContent({
                    coachId: coach.id,
                    userId: getCurrentUserId(),
                    limit: 20,
                    offset: 0
                });

                setCoachContent(response.contents);
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

    // 临时函数：获取当前用户ID（需要根据实际认证系统实现）
    const getCurrentUserId = (): string | undefined => {
        // 这里需要从你的认证系统获取当前用户ID
        // 可能从localStorage、Context或其他地方获取
        return localStorage.getItem('current_user_id') || undefined;
    };

    // 添加骨架屏组件
    const renderCoachSkeleton = () => (
        <div className="bg-white animate-pulse">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* 头像区域骨架 */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 bg-gray-200 rounded-full mb-4"></div>
                        <div className="w-20 h-20 bg-gray-200 rounded-lg"></div>
                    </div>

                    {/* 详细信息区域骨架 */}
                    <div className="flex-1">
                        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>

                        {/* 统计信息骨架 */}
                        <div className="flex space-x-4 mb-6">
                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                            <div className="h-4 bg-gray-200 rounded w-16"></div>
                        </div>

                        {/* 专业领域骨架 */}
                        <div className="space-y-3 mb-6">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="flex space-x-2">
                                <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                                <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                                <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                            </div>
                        </div>

                        {/* 简介骨架 */}
                        <div className="space-y-3">
                            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                            <div className="h-4 bg-gray-200 rounded w-full"></div>
                            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    // 在教练信息加载完成前显示骨架屏
    if (isLoadingCoach) {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* 顶部导航骨架 */}
                <div className="bg-white shadow-sm border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16">
                            <div className="flex items-center space-x-2">
                                <div className="h-5 w-5 bg-gray-200 rounded"></div>
                                <div className="h-4 w-20 bg-gray-200 rounded"></div>
                            </div>
                            <div className="flex items-center space-x-4">
                                <div className="h-5 w-5 bg-gray-200 rounded"></div>
                                <div className="h-5 w-5 bg-gray-200 rounded"></div>
                            </div>
                        </div>
                    </div>
                </div>
                {renderCoachSkeleton()}
            </div>
        );
    }


    // 安全默认值，避免真实教练缺少字段导致崩溃
    const safeSpecialties = Array.isArray(coach.specialties) ? coach.specialties : [];
    const safeAchievements = Array.isArray(coach.achievements) ? coach.achievements : [];
    const safeCertification = Array.isArray((coach as any).certification) ? (coach as any).certification : [];
    const price1 = typeof coach.subscription_price_tier1 === 'number' ? coach.subscription_price_tier1 : 99;
    const price2 = typeof coach.subscription_price_tier2 === 'number' ? coach.subscription_price_tier2 : 199;
    const price3 = typeof coach.subscription_price_tier3 === 'number' ? coach.subscription_price_tier3 : 399;
    const safeTitle = coach.title || '专业健身教练';
    const safeRating = typeof coach.rating === 'number' ? coach.rating : 4.8;
    const safeStudents = typeof coach.total_students === 'number' ? coach.total_students : 0;
    const safeYears = typeof coach.years_experience === 'number' ? coach.years_experience : 1;
    const safeRespHrs = (coach as any).response_time_hours ?? 24;
    const safeFitnessLevel = (coach as any).fitness_level || '专业级';

    const subscriptionTiers = [
        {
            tier: 1,
            name: 'AI训练计划',
            price: price1,
            features: [
                '个性化AI训练计划生成',
                '基础动作指导',
                '每月计划更新',
                '社区讨论权限'
            ],
            popular: false
        },
        {
            tier: 2,
            name: 'AI计划 + 视频点评',
            price: price2,
            features: [
                '包含第一层所有功能',
                '上传训练视频',
                '专业动作点评',
                '语音/文字反馈',
                '训练建议优化'
            ],
            popular: true
        },
        {
            tier: 3,
            name: '全方位私教服务',
            price: price3,
            features: [
                '包含前两层所有功能',
                '一对一实时聊天',
                '24小时内回复',
                '私人定制计划',
                '营养指导建议',
                '优先客服支持'
            ],
            popular: false
        }
    ];

    const onSubscribe = async (tier: number) => {
        if (!session?.user?.id) {
            showToast({ severity: 'error', summary: '请先登录' });
            return;
        }

        try {
            setIsSubscribing(true);

            // 检查是否已有活跃订阅
            const existingSubscription = mySubscriptions.find(
                sub => sub.coach_id === coach?.id && sub.status === 'active'
            );

            if (existingSubscription) {
                showToast({ severity: 'info', summary: '您已订阅该教练' });
                return;
            }

            // 执行订阅操作
            const result = await subscriptionService.subscribe(
                coach!.id,
                tier,
                tier === 1 ? price1 : tier === 2 ? price2 : price3
            );

            if (result.success) {
                showToast({ severity: 'success', summary: '订阅成功' });
                // 刷新订阅列表
                await initSubscriptions();
            } else {
                showToast({ severity: 'error', summary: result.message || '订阅失败' });
            }
        } catch (error) {
            console.error('订阅过程中出现错误:', error);
            showToast({ severity: 'error', summary: '订阅过程中出现错误' });
        } finally {
            setIsSubscribing(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 顶部导航 */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center space-x-2">
                            <ArrowLeft
                                className="h-5 w-5 text-gray-500 hover:text-gray-700 cursor-pointer"
                                onClick={() => router.push('/coach')}
                            />
                            <div className="text-gray-700 font-bold">{safeTitle}</div>
                        </div>
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-1 text-gray-500">
                                <Star className="h-5 w-5" />
                                <div>{safeRating}</div>
                            </div>
                            <div className="flex items-center space-x-1 text-gray-500">
                                <Users className="h-5 w-5" />
                                <div>{safeStudents}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 主体内容 */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* 头像区域 */}
                    <div className="flex-shrink-0">
                        <div className="w-32 h-32 bg-gray-200 rounded-full mb-4">
                            <img
                                src={coach.avatar_url || '/default-avatar.png'}
                                alt={`${coach.name} avatar`}
                                className="w-full h-full rounded-full object-cover"
                            />
                        </div>
                        <div className="w-20 h-20 bg-gray-200 rounded-lg">
                            <img
                                src={coach.featured_video_url || '/default-video.png'}
                                alt={`${coach.name} featured video`}
                                className="w-full h-full rounded-lg object-cover"
                            />
                        </div>
                    </div>

                    {/* 详细信息区域 */}
                    <div className="flex-1">
                        <div className="text-gray-700 font-bold text-2xl mb-4">{coach.name}</div>
                        <div className="text-gray-500 text-lg mb-6">{coach.bio}</div>

                        {/* 统计信息 */}
                        <div className="flex space-x-4 mb-6">
                            <div className="flex items-center space-x-1 text-gray-500">
                                <Award className="h-4 w-4" />
                                <div>{coach.success_stories} 成功案例</div>
                            </div>
                            <div className="flex items-center space-x-1 text-gray-500">
                                <Calendar className="h-4 w-4" />
                                <div>{safeYears} 年经验</div>
                            </div>
                            <div className="flex items-center space-x-1 text-gray-500">
                                <MessageCircle className="h-4 w-4" />
                                <div>{safeRespHrs} 小时响应</div>
                            </div>
                            <div className="flex items-center space-x-1 text-gray-500">
                                <Brain className="h-4 w-4" />
                                <div>{safeFitnessLevel}</div>
                            </div>
                        </div>

                        {/* 专业领域 */}
                        <div className="space-y-3 mb-6">
                            <div className="text-gray-700 font-bold">专业领域</div>
                            <div className="flex space-x-2">
                                {safeSpecialties.map((specialty, index) => (
                                    <div key={index} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full">
                                        {specialty}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 简介 */}
                        <div className="space-y-3">
                            <div className="text-gray-700 font-bold">简介</div>
                            <div className="text-gray-500">{coach.bio}</div>
                            <div className="text-gray-500">{coach.training_philosophy}</div>
                        </div>
                    </div>
                </div>
            </div>
            {/* 订阅计划区域 */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">选择您的订阅计划</h2>
                    <p className="text-gray-500">选择最适合您需求的服务层级</p>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {subscriptionTiers.map((tier) => (
                        <div
                            key={tier.tier}
                            className={`relative p-6 rounded-xl border-2 ${tier.popular
                                    ? 'border-blue-500 bg-blue-50 shadow-lg'
                                    : 'border-gray-200 bg-white hover:shadow-md'
                                } transition-all duration-200`}
                        >
                            {tier.popular && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                                        推荐
                                    </span>
                                </div>
                            )}

                            <div className="text-center mb-6">
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                                <div className="flex items-baseline justify-center">
                                    <span className="text-3xl font-bold text-gray-900">¥{tier.price}</span>
                                    <span className="text-gray-500 ml-1">/月</span>
                                </div>
                            </div>

                            <ul className="space-y-3 mb-8">
                                {tier.features.map((feature, index) => (
                                    <li key={index} className="flex items-start">
                                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                        <span className="text-gray-700 text-sm">{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => onSubscribe(tier.tier)}
                                disabled={isSubscribing}
                                className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${tier.popular
                                        ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl'
                                        : 'bg-gray-900 text-white hover:bg-gray-800'
                                    } ${isSubscribing ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {isSubscribing ? '处理中...' : '立即订阅'}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>

    );
};

export default CoachProfilePage;
