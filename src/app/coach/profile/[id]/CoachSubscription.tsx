'use client';

import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';

interface SubscriptionTier {
    tier: number;
    name: string;
    price: number;
    features: string[];
    popular: boolean;
}

interface CoachSubscriptionProps {
    coach: any;
    mySubscriptions: QueryCoachSubscription[];
    onSubscribeSuccess: (tier: number) => void;
    isSubscribing: boolean;
    setIsSubscribing: (isSubscribing: boolean) => void;
}

const CoachSubscription: React.FC<CoachSubscriptionProps> = ({
    coach,
    mySubscriptions,
    onSubscribeSuccess,
    isSubscribing,
    setIsSubscribing
}) => {
    const { showToast } = useToastContext();

    const price1 = typeof coach.subscription_price_tier1 === 'number' ? coach.subscription_price_tier1 : 99;
    const price2 = typeof coach.subscription_price_tier2 === 'number' ? coach.subscription_price_tier2 : 199;
    const price3 = typeof coach.subscription_price_tier3 === 'number' ? coach.subscription_price_tier3 : 399;

    const subscriptionTiers: SubscriptionTier[] = [
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
                onSubscribeSuccess(tier);
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-surface-900 mb-2">选择您的订阅计划</h2>
                <p className="text-surface-500">选择最适合您需求的服务层级</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {subscriptionTiers.map((tier) => (
                    <div
                        key={tier.tier}
                        className={`relative p-6 rounded-xl border-2 ${tier.popular
                            ? 'border-primary-500 bg-primary-50 shadow-lg'
                            : 'border-surface-200 bg-surface hover:shadow-md'
                            } transition-all duration-200`}
                    >
                        {tier.popular && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <span className="bg-primary-500 text-surface px-3 py-1 rounded-full text-sm font-medium">
                                    推荐
                                </span>
                            </div>
                        )}

                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-surface-900 mb-2">{tier.name}</h3>
                            <div className="flex items-baseline justify-center">
                                <span className="text-3xl font-bold text-surface-900">¥{tier.price}</span>
                                <span className="text-surface-500 ml-1">/月</span>
                            </div>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {tier.features.map((feature, index) => (
                                <li key={index} className="flex items-start">
                                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                    <span className="text-surface-700 text-sm">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            label={isSubscribing ? '处理中...' : '立即订阅'}
                            onClick={() => onSubscribe(tier.tier)}
                            disabled={isSubscribing}
                            className={`w-full ${tier.popular
                                ? 'p-button-primary'
                                : 'p-button-secondary'
                                }`}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default CoachSubscription;