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


const CoachProfilePage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'about' | 'content' | 'reviews'>('about');
    const [coachContent, setCoachContent] = useState<ServiceCoachContent[]>([]);
    const [isLoadingContent, setIsLoadingContent] = useState(false);
    const [contentError, setContentError] = useState<string | null>(null);
    const [isSubscribing, setIsSubscribing] = useState(false);
    const [mySubscriptions, setMySubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [selectedTier, setSelectedTier] = useState<number | null>(null);

    const router = useRouter();
    const params = useParams();
    const coachId = params.id;
    if (!coachId) {
        router.push('/coach');
    }

    const { showToast } = useToastContext();
    const { data: session } = useSession();

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

    const onBack = () => {
        router.back();
    }

    const onSubscribe = () => {

    }

    // 初始化拉取订阅与教练内容
    useEffect(() => {
        const init = async () => {

            const res = await subscriptionService.getCoachSubscriptions({
                studentId: session?.user.id
            });

            if (res) {
                setMySubscriptions(res.subscriptions || []);
            } else {
                showToast({ severity: 'error', summary: '获取订阅失败' });
            }
        };
        init();
    }, [coach.id]);

    // 获取教练内容
    useEffect(() => {
        const loadCoachContent = async () => {
            if (activeTab !== 'content') return;

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
    }, [activeTab, coach.id]);

    // 临时函数：获取当前用户ID（需要根据实际认证系统实现）
    const getCurrentUserId = (): string | undefined => {
        // 这里需要从你的认证系统获取当前用户ID
        // 可能从localStorage、Context或其他地方获取
        return localStorage.getItem('current_user_id') || undefined;
    };

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

    // 时间格式化由 contentService 提供

    const canViewContent = (content: ServiceCoachContent) => {
        if (content.required_tier === 0) return true;
        const active = mySubscriptions.find((s) => s.coach_id === coach.id && s.status === 'active');
        if (!active) return false;
        return active.tier >= content.required_tier;
    };

    const getTierBadgeColor = (tier: number): string => {
        const colors = {
            0: 'bg-green-100 text-green-800',
            1: 'bg-blue-100 text-blue-800',
            2: 'bg-purple-100 text-purple-800',
            3: 'bg-amber-100 text-amber-800'
        };
        return colors[tier as keyof typeof colors] || 'bg-gray-100 text-gray-800';
    };

    const renderContentThumbnail = (content: ServiceCoachContent) => {
        if (content.thumbnail_url) {
            return (
                <img
                    src={content.thumbnail_url}
                    alt={content.title}
                    className="w-20 h-20 object-cover rounded-lg"
                />
            );
        }

        switch (content.content_type) {
            case 'video':
                return (
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Play className="w-8 h-8 text-gray-400" />
                    </div>
                );
            case 'image':
                return (
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Image className="w-8 h-8 text-gray-400" />
                    </div>
                );
            case 'plan':
                return (
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Brain className="w-8 h-8 text-gray-400" />
                    </div>
                );
            default:
                return (
                    <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                        <MessageCircle className="w-8 h-8 text-gray-400" />
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* 顶部导航 */}
            <div className="bg-white shadow-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <button
                            onClick={onBack}
                            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            <span>返回教练列表</span>
                        </button>

                        <div className="flex items-center space-x-4">
                            <button className="p-2 text-gray-600 hover:text-gray-900 transition-colors">
                                <Heart className="w-5 h-5" />
                            </button>
                            <button className="p-2 text-gray-600 hover:text-gray-900 transition-colors">
                                <Share2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* 教练头部信息 */}
            <div className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex flex-col md:flex-row gap-8">
                        {/* 头像和基本信息 */}
                        <div className="flex-shrink-0">
                            <div className="w-32 h-32 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mb-4">
                                {coach.avatar_url ? (
                                    <img src={coach.avatar_url} alt={coach.name} className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    <span className="text-4xl font-bold text-white">{coach.name.charAt(0)}</span>
                                )}
                            </div>

                            {coach.featured_video_url && (
                                <div className="relative rounded-lg overflow-hidden">
                                    <video className="w-full h-24 object-cover" poster="/api/placeholder/200/100">
                                        <source src={coach.featured_video_url} type="video/mp4" />
                                    </video>
                                    <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                                        <Play className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 详细信息 */}
                        <div className="flex-1">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900 mb-2">{coach.name}</h1>
                                    <p className="text-xl text-gray-600 mb-2">{safeTitle}</p>
                                    <div className="flex items-center space-x-4 text-sm text-gray-500">
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

                                {userSubscription?.is_active && (
                                    <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                                        已订阅 Tier {userSubscription.tier}
                                    </div>
                                )}
                            </div>

                            {/* 专业领域 */}
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">专业领域</h3>
                                <div className="flex flex-wrap gap-2">
                                    {safeSpecialties.map((specialty, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                        >
                                            {specialty}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 成就认证 */}
                            <div className="mb-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">认证与成就</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div className="flex items-center space-x-2">
                                        <Award className="w-4 h-4 text-yellow-600" />
                                        <span>{coach.success_stories} 成功案例</span>
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
                                <h3 className="text-sm font-semibold text-gray-700 mb-2">教练简介</h3>
                                <p className="text-gray-600 leading-relaxed">{coach.bio}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 订阅服务卡片 */}
            <div className="bg-gray-50 py-12">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900 mb-4">选择订阅服务</h2>
                        <p className="text-gray-600 text-lg">选择适合您的服务等级，获得专业指导</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {subscriptionTiers.map((tier) => (
                            <div
                                key={tier.tier}
                                className={`bg-white rounded-2xl shadow-lg overflow-hidden ${tier.popular ? 'ring-2 ring-blue-500 transform scale-105' : ''
                                    }`}
                            >
                                {tier.popular && (
                                    <div className="bg-blue-500 text-white text-center py-2 text-sm font-medium">
                                        最受欢迎
                                    </div>
                                )}

                                <div className="p-6">
                                    <div
                                        className={`text-center mb-6 cursor-pointer ${selectedTier === tier.tier ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}
                                        onClick={() => setSelectedTier(tier.tier)}
                                    >
                                        <h3 className="text-xl font-bold text-gray-900 mb-2">{tier.name}</h3>
                                        <div className="flex items-baseline justify-center">
                                            <span className="text-3xl font-bold text-gray-900">¥{tier.price}</span>
                                            <span className="text-gray-500 ml-1">/月</span>
                                        </div>
                                    </div>

                                    <ul className="space-y-3 mb-6">
                                        {tier.features.map((feature, index) => (
                                            <li key={index} className="flex items-start space-x-3">
                                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                                <span className="text-gray-600 text-sm">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        onClick={async () => {
                                            try {
                                                setIsSubscribing(true);
                                                await subscriptionService.subscribe(coach.id, tier.tier as any, tier.price);
                                                const subs = await subscriptionService.getMySubscriptions();
                                                setMySubscriptions(subs);
                                                if (typeof (onSubscribed) === 'function') { await onSubscribed(); }
                                                alert('订阅成功');
                                            } catch (e: any) {
                                                alert(e?.message || '订阅失败');
                                            } finally {
                                                setIsSubscribing(false);
                                            }
                                        }}
                                        disabled={isSubscribing}
                                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${tier.popular
                                            ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg hover:shadow-xl'
                                            : 'bg-gray-900 text-white hover:bg-gray-800'
                                            }`}
                                    >
                                        {isSubscribing ? '处理中...' : '立即订阅'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* 内容标签页 */}
            <div className="bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="border-b border-gray-200">
                        <nav className="flex space-x-8">
                            <button
                                onClick={() => setActiveTab('about')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'about'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                训练理念
                            </button>
                            <button
                                onClick={() => setActiveTab('content')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'content'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                教学内容
                            </button>
                            <button
                                onClick={() => setActiveTab('reviews')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'reviews'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                    }`}
                            >
                                学员评价
                            </button>
                        </nav>
                    </div>

                    <div className="py-8">
                        {/* 训练理念 */}
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
                            <div className="space-y-6">
                                {isLoadingContent ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                                        <p className="text-gray-500 mt-4">加载内容中...</p>
                                    </div>
                                ) : contentError ? (
                                    <div className="text-center py-12">
                                        <p className="text-red-500 mb-4">{contentError}</p>
                                        <button
                                            onClick={() => window.location.reload()}
                                            className="text-blue-600 hover:text-blue-700 font-medium"
                                        >
                                            重新加载
                                        </button>
                                    </div>
                                ) : coachContent.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500">该教练还没有发布任何内容</p>
                                    </div>
                                ) : (
                                    coachContent.map((content) => (
                                        <div key={content.id} className="bg-gray-50 rounded-xl p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center space-x-3 mb-2">
                                                        <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
                                                        {content.required_tier > 0 && (
                                                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierBadgeColor(content.required_tier)}`}>
                                                                {contentService.getTierLabel(content.required_tier)}
                                                            </span>
                                                        )}
                                                        {content.is_featured && (
                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                                                ⭐ 精选
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-gray-600 mb-3">
                                                        {content.content.length > 150
                                                            ? content.content.substring(0, 150) + '...'
                                                            : content.content
                                                        }
                                                    </p>

                                                    {/* 标签 */}
                                                    {content.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mb-3">
                                                            {content.tags.slice(0, 3).map((tag, index) => (
                                                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                                                    #{tag}
                                                                </span>
                                                            ))}
                                                            {content.tags.length > 3 && (
                                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                                    +{content.tags.length - 3}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}

                                                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                                                        <div className="flex items-center space-x-1">
                                                            <Eye className="w-4 h-4" />
                                                            <span>{content.views_count}</span>
                                                        </div>
                                                        <div className="flex items-center space-x-1">
                                                            <ThumbsUp className="w-4 h-4" />
                                                            <span>{content.likes_count}</span>
                                                        </div>
                                                        {content.comments_count > 0 && (
                                                            <div className="flex items-center space-x-1">
                                                                <MessageCircle className="w-4 h-4" />
                                                                <span>{content.comments_count}</span>
                                                            </div>
                                                        )}
                                                        <span>{contentService.formatRelativeTime(content.created_at)}</span>
                                                    </div>
                                                </div>

                                                <div className="flex-shrink-0 ml-4">
                                                    {renderContentThumbnail(content)}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between">
                                                {canViewContent(content) ? (
                                                    <button className="text-blue-600 hover:text-blue-700 font-medium">
                                                        查看完整内容
                                                    </button>
                                                ) : (
                                                    <div className="flex items-center space-x-2 text-gray-500">
                                                        <Lock className="w-4 h-4" />
                                                        <span>需要 {contentService.getTierLabel(content.required_tier)} 订阅</span>
                                                        <button
                                                            onClick={async () => {
                                                                try {
                                                                    setIsSubscribing(true);
                                                                    await subscriptionService.subscribe(coach.id, Math.max(1, content.required_tier) as any);
                                                                    const subs = await subscriptionService.getMySubscriptions();
                                                                    setMySubscriptions(subs);
                                                                    alert('订阅成功');
                                                                } catch (e: any) {
                                                                    alert(e?.message || '订阅失败');
                                                                } finally {
                                                                    setIsSubscribing(false);
                                                                }
                                                            }}
                                                            className="text-blue-600 hover:text-blue-700 font-medium"
                                                        >立即订阅</button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* 学员评价 */}
                        {activeTab === 'reviews' && (
                            <div className="space-y-6">
                                <div className="text-center py-12">
                                    <MessageCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                    <p className="text-gray-600 text-lg">学员评价功能正在开发中...</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoachProfilePage;
