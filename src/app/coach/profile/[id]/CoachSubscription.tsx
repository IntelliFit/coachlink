'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useRouter } from 'next/navigation';
import { Pricing } from '@/app/api/coach/get-pricing/entity';

interface CoachSubscriptionProps {
    coach: any;
    mySubscriptions: QueryCoachSubscription[];
    onSubscribeSuccess: (tier: number) => void;
    isSubscribing: boolean;
    setIsSubscribing: (isSubscribing: boolean) => void;
    isOwnProfile: boolean;
}

const CoachSubscription: React.FC<CoachSubscriptionProps> = ({
    coach,
    mySubscriptions,
    onSubscribeSuccess,
    isSubscribing,
    setIsSubscribing,
    isOwnProfile
}) => {
    const { showToast } = useToastContext();
    const router = useRouter();
    const [subscriptionTiers, setSubscriptionTiers] = useState<Pricing[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                setLoading(true);
                const res = await coachService.getPricing({ coachId: coach.id });
                
                if (res) {
                    setSubscriptionTiers(res.pricings);
                } else {
                    showToast({ severity: 'error', summary: '获取定价信息失败' })
                }
                
            } catch (error) {
                console.error('加载定价信息失败:', error);
            } finally {
                setLoading(false);
            }
        };

        if (coach?.id) {
            fetchPricing();
        }
    }, [coach?.id]);

    const onSubscribe = async (index: number) => {
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

            // 获取选中的定价档位
            const selectedTier = subscriptionTiers[index];
            
            // 执行订阅操作（这里简化处理，实际应该根据业务逻辑调整）
            const tierNumber = index + 1; // 假设索引对应tier编号
            const result = await subscriptionService.subscribe(
                coach!.id,
                tierNumber,
                selectedTier.price
            );

            if (result.success) {
                showToast({ severity: 'success', summary: '订阅成功' });
                onSubscribeSuccess(tierNumber);
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

    const handleEditPricing = () => {
        router.push('/dashboard/pricing');
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center mb-8">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mx-auto mb-4 animate-pulse"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/3 mx-auto animate-pulse"></div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="border-2 border-gray-200 rounded-xl p-6 animate-pulse">
                            <div className="h-6 bg-gray-200 rounded w-3/4 mb-6 mx-auto"></div>
                            <div className="h-10 bg-gray-200 rounded w-1/2 mb-8 mx-auto"></div>
                            <div className="space-y-3 mb-8">
                                {[1, 2, 3, 4, 5].map((feature) => (
                                    <div key={feature} className="h-4 bg-gray-200 rounded w-full"></div>
                                ))}
                            </div>
                            <div className="h-10 bg-gray-200 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-surface-900 mb-2">选择您的订阅计划</h2>
                <p className="text-surface-500">选择最适合您需求的服务层级</p>
                {isOwnProfile && (
                    <div className="mt-4">
                        <Button 
                            label="编辑定价策略" 
                            icon="pi pi-pencil" 
                            onClick={handleEditPricing}
                            className="p-button-outlined"
                        />
                    </div>
                )}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
                {subscriptionTiers.map((tier, index) => (
                    <div
                        key={index}
                        className={`relative p-6 rounded-xl border-2 ${tier.is_recommend
                            ? 'border-primary-500 bg-primary-50 shadow-lg'
                            : 'border-surface-200 bg-surface hover:shadow-md'
                            } transition-all duration-200`}
                    >
                        {tier.is_recommend && (
                            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                <span className="bg-primary-500 text-surface px-3 py-1 rounded-full text-sm font-medium">
                                    推荐
                                </span>
                            </div>
                        )}

                        <div className="text-center mb-6">
                            <h3 className="text-xl font-bold text-surface-900 mb-2">{tier.title}</h3>
                            <div className="flex items-baseline justify-center">
                                <span className="text-3xl font-bold text-surface-900">¥{tier.price}</span>
                                <span className="text-surface-500 ml-1">/月</span>
                            </div>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {tier.features.map((feature, featureIndex) => (
                                <li key={featureIndex} className="flex items-start">
                                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                                    <span className="text-surface-700 text-sm">{feature}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            label={isSubscribing ? '处理中...' : '立即订阅'}
                            onClick={() => onSubscribe(index)}
                            disabled={isSubscribing}
                            className={`w-full ${tier.is_recommend
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