'use client';

import React from 'react';
import { ThumbsUp, Eye, MessageCircle, Lock, Play, Image } from 'lucide-react';
import { Button } from 'primereact/button';
import { Toast } from 'primereact/toast';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';

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

interface CoachContentItemProps {
    content: ServiceCoachContent;
    coachId: string;
    userSubscription: any;
    onSubscribeSuccess: () => void;
}

const CoachContentItem: React.FC<CoachContentItemProps> = ({
    content,
    coachId,
    userSubscription,
    onSubscribeSuccess
}) => {
    const { showToast } = useToastContext();
    const [isSubscribing, setIsSubscribing] = React.useState(false);

    // 渲染内容缩略图
    const renderContentThumbnail = () => {
        if (content.thumbnail_url) {
            return (
                <img
                    src={content.thumbnail_url}
                    alt={content.title}
                    className="w-24 h-24 object-cover rounded-lg"
                />
            );
        }

        if (content.content_type === 'video') {
            return (
                <div className="w-24 h-24 bg-gradient-to-r from-primary-500 to-red-600 rounded-lg flex items-center justify-center">
                    <Play className="w-8 h-8 text-white" />
                </div>
            );
        }

        return (
            <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Image className="w-8 h-8 text-white" />
            </div>
        );
    };

    // 获取层级标签颜色
    const getTierBadgeColor = (tier: number) => {
        switch (tier) {
            case 1: return 'bg-blue-100 text-blue-800';
            case 2: return 'bg-purple-100 text-purple-800';
            case 3: return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // 检查是否可以查看内容
    const canViewContent = () => {
        if (!userSubscription) return false;
        return userSubscription.tier >= content.required_tier;
    };

    const handleSubscribe = async () => {
        try {
            setIsSubscribing(true);
            await subscriptionService.subscribe(coachId, Math.max(1, content.required_tier) as any);
            onSubscribeSuccess();
            showToast({ severity: 'success', summary: '订阅成功' });
        } catch (e: any) {
            showToast({ severity: 'error', summary: e?.message || '订阅失败' });
        } finally {
            setIsSubscribing(false);
        }
    };

    return (
        <div className="bg-surface-50 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-surface-900">{content.title}</h3>
                        {content.required_tier > 0 && (
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTierBadgeColor(content.required_tier)}`}>
                                {content.required_tier === 1 ? '基础' : content.required_tier === 2 ? '进阶' : '高级'}
                            </span>
                        )}
                        {content.is_featured && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                ⭐ 精选
                            </span>
                        )}
                    </div>
                    <p className="text-surface-600 mb-3">
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
                                <span className="px-2 py-1 bg-surface-100 text-surface-600 text-xs rounded">
                                    +{content.tags.length - 3}
                                </span>
                            )}
                        </div>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-surface-500">
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
                        <span>{new Date(content.created_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="flex-shrink-0 ml-4">
                    {renderContentThumbnail()}
                </div>
            </div>

            <div className="flex items-center justify-between">
                {canViewContent() ? (
                    <Button
                        label="查看完整内容"
                        className="p-button-text p-0"
                        onClick={() => console.log('查看内容')}
                    />
                ) : (
                    <div className="flex items-center space-x-2 text-surface-500">
                        <Lock className="w-4 h-4" />
                        <span>需要 {content.required_tier === 1 ? '基础' : content.required_tier === 2 ? '进阶' : '高级'} 订阅</span>
                        <Button
                            label={isSubscribing ? '处理中...' : '立即订阅'}
                            onClick={handleSubscribe}
                            disabled={isSubscribing}
                            className="p-button-text p-0"
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoachContentItem;