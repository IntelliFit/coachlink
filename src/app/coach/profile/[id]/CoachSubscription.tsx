'use client';

import React, { useEffect, useState } from 'react';
import { Inbox, CheckCircle, Zap } from 'lucide-react';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useRouter } from 'next/navigation';
import { Pricing } from '@/app/api/coach/get-pricing/entity';
import QuestionnaireForm from './QuestionnaireForm';
import PaymentDialog from '@/components/payment/paymentDialog';
import type { CreateAlipayOrderDto } from '@/app/api/payment/alipay/create/entity';
import { CoachesRow, CoachSubscriptionRow } from '@/types';
import { useSession } from 'next-auth/react';
import { TrainingItem } from '@/types/questionnaires';

interface CoachSubscriptionProps {
    coach: CoachesRow;
    mySubscriptions: QueryCoachSubscription[];
    onSubscribeSuccess: (tier: number) => void;
}

const CoachSubscription: React.FC<CoachSubscriptionProps> = ({
    coach,
    mySubscriptions,
    onSubscribeSuccess,
}) => {
    const { showToast } = useToastContext();
    const router = useRouter();
    const [subscriptionTiers, setSubscriptionTiers] = useState<Pricing[]>([]);
    const [loading, setLoading] = useState(true);
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);

    const { data: session } = useSession();

    // 为每个订阅选项维护独立的加载状态
    const [subscribingStates, setSubscribingStates] = useState<boolean[]>([]);
    // 支付对话框相关状态
    const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
    const [pendingOrderDetails, setPendingOrderDetails] = useState<CreateAlipayOrderDto | null>(null);
    const [selectedTierForPayment, setSelectedTierForPayment] = useState<{ index: number } | null>(null);
    const [currentTierIndex, setCurrentTierIndex] = useState<number | null>(null);

    const [coachSubscription, setCoachSubscription] = useState<CoachSubscriptionRow | null>(null);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                setLoading(true);
                const res = await coachService.getPricing({
                    coachId: coach.id
                });

                if (res) {
                    setSubscriptionTiers(res.pricings);
                    // 初始化每个订阅选项的加载状态
                    setSubscribingStates(new Array(res.pricings.length).fill(false));
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
            // 设置当前选项为加载状态
            setCurrentTierIndex(index);
            const newSubscribingStates = [...subscribingStates];
            newSubscribingStates[index] = true;
            setSubscribingStates(newSubscribingStates);

            // 检查是否已有活跃订阅
            if (mySubscriptions.find(
                sub => sub.coach_id === coach?.id && sub.status === 'active'
            )) {
                showToast({ severity: 'info', summary: '您已订阅该教练' });
                return;
            }

            if (mySubscriptions.find(
                sub => sub.coach_id === coach?.id && sub.status === 'waiting'
            )) {
                showToast({ severity: 'info', summary: '您已订阅该教练，请等待激活' });
                return;
            }

            // 获取选中的定价档位
            const selectedTier = subscriptionTiers[index];

            // 先尝试获取问卷：如果存在问卷，则先展示问卷；否则直接走付款流程
            const qRes = await coachService.getQuestionnaires({
                coachId: coach.id
            });

            setSelectedTierForPayment({ index });

            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                // 设置待处理的订单详情和选中的套餐（直接付款）
                const orderDetails: CreateAlipayOrderDto = {
                    subject: `订阅教练 ${coach?.name}`,
                    totalAmount: selectedTier.price,
                    orderType: '教练服务订阅',
                    orderData: {
                        coachId: coach?.id,
                        tierId: selectedTier.id
                    },
                    // TODO: 等待测试完成，切换为 common
                    createMode: 'test'
                };

                setPendingOrderDetails(orderDetails);
                setPaymentDialogVisible(true);
            }
        } catch (error) {
            console.error('订阅过程中出现错误:', error);
            showToast({ severity: 'error', summary: '订阅过程中出现错误' });
        } finally {
            // 取消当前选项的加载状态
            const newSubscribingStates = [...subscribingStates];
            newSubscribingStates[index] = false;
            setSubscribingStates(newSubscribingStates);
        }
    };

    const handlePaymentSuccess = async (note?: string) => {
        if (selectedTierForPayment) {
            const { index } = selectedTierForPayment;
            const tier = index + 1;
            // 更新订阅信息
            const res = await subscriptionService.updateSubscription({
                id: coachSubscription.id,
                status: 'waiting',
                has_remind_coach: true,
                remind_coach_note: note || ''
            });

            if (res?.subscription) {
                // 更新订阅列表
                onSubscribeSuccess(tier);
                setCoachSubscription(res.subscription);

            } else {
                showToast({ severity: 'error', summary: '订阅失败' });
            }
        }
        setPaymentDialogVisible(false);
        setPendingOrderDetails(null);
        setSelectedTierForPayment(null);
    };

    const handlePaymentCancel = () => {
        setPaymentDialogVisible(false);
        setPendingOrderDetails(null);
        setSelectedTierForPayment(null);
    };

    const handleQuestionnaireSubmit = async (answers: TrainingItem[]) => {
        const { index } = selectedTierForPayment;
        const tier = index + 1;
        const monthlyPrice = subscriptionTiers[index].price;

        const res = await subscriptionService.createSubscription({
            coachId: coach.id,
            tier,
            monthlyPrice,
            status: 'inactive',
            subscribeData: answers,
        });

        if (res) {
            setCoachSubscription(res.subscription);
            setQuestionnaireVisible(false);
            setPaymentDialogVisible(true);
        } else {
            showToast({ severity: 'error', summary: '报错订阅问卷失败', detail: '请刷洗页面重试' });
            return;
        }
    };

    const handleEditPricing = () => {
        router.push('/dashboard/pricing');
    };

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="text-center mb-8">
                    <div className="h-8 bg-surface-200 rounded w-1/4 mx-auto mb-4 animate-pulse"></div>
                    <div className="h-4 bg-surface-200 rounded w-1/3 mx-auto animate-pulse"></div>
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                    {[1, 2, 3].map((item) => (
                        <div key={item} className="border-2 border-surface-200 rounded-xl p-6 animate-pulse">
                            <div className="h-6 bg-surface-200 rounded w-3/4 mb-6 mx-auto"></div>
                            <div className="h-10 bg-surface-200 rounded w-1/2 mb-8 mx-auto"></div>
                            <div className="space-y-3 mb-8">
                                {[1, 2, 3, 4, 5].map((feature) => (
                                    <div key={feature} className="h-4 bg-surface-200 rounded w-full"></div>
                                ))}
                            </div>
                            <div className="h-10 bg-surface-200 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 添加空状态检查
    if (!loading && (!subscriptionTiers || subscriptionTiers.length === 0)) {
        return (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-surface-900 mb-2" id='choose-pricing'>选择您的订阅计划</h2>
                    <p className="text-surface-500">选择最适合您需求的服务层级</p>
                    {(session?.user?.id === coach.user_id) && (
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
                
                {/* 空状态显示 */}
                <div className="flex flex-col items-center justify-center py-12">
                    <div className="bg-surface-100 dark:bg-surface-800 rounded-full p-4 mb-6">
                        <Inbox className="h-12 w-12 text-surface-500 dark:text-surface-0" />
                    </div>
                    <h3 className="text-xl font-medium text-surface-900 mb-2">暂无订阅计划</h3>
                    <p className="text-surface-500 dark:text-surface-400 mb-6 text-center max-w-md">
                        {session?.user?.id === coach.user_id 
                            ? "您还没有设置任何订阅计划，请先创建定价策略" 
                            : "该教练尚未设置订阅计划"}
                    </p>
                    {session?.user?.id === coach.user_id && (
                        <Button 
                            label="创建定价策略" 
                            icon="pi pi-plus" 
                            onClick={handleEditPricing}
                            className="p-button-primary"
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-surface-900 mb-2" id='choose-pricing'>选择您的订阅计划</h2>
                <p className="text-surface-500">选择最适合您需求的服务层级</p>
                {(session?.user?.id === coach.user_id) && (
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
                {subscriptionTiers.map((tier, index) => {
                    // 检查用户是否已经订阅了该教练
                    const isSubscribed = mySubscriptions.some(
                        sub => sub.coach_id === coach?.id && sub.status === 'active'
                    );

                    return (
                        <div
                            key={index}
                            className={`relative p-6 rounded-xl border-2
                                flex flex-col justify-between
                                ${(tier.is_recommend)
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900 shadow-lg'
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

                            {tier.is_ai_plan && !tier.is_recommend && (
                                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                                    <span className="bg-purple-500 text-surface px-3 py-1 rounded-full text-sm font-medium">
                                        AI 计划
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

                            {(mySubscriptions.some(
                                sub => sub.coach_id === coach?.id &&
                                    sub.status === 'active' &&
                                    sub.tier === (index + 1)
                            )) ? (
                                <Button
                                    label="已经订阅"
                                    disabled={true}
                                    className={`w-full ${(tier.is_recommend)
                                        ? 'bg-red-500' :
                                        tier.is_ai_plan ? 'bg-purple-500'
                                            : 'p-button-primary'
                                        }`}
                                />
                            ) : (
                                <Button
                                    label='立即订阅'
                                    onClick={() => onSubscribe(index)}
                                    loading={subscribingStates[index]}
                                    disabled={subscribingStates[index]}
                                    className={`w-full ${tier.is_recommend ? 'bg-primary'
                                        : tier.is_ai_plan ? 'bg-purple-500 border border-purple-500' :
                                            'p-button-primary'
                                        }`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            <QuestionnaireForm
                visible={questionnaireVisible}
                onHide={() => setQuestionnaireVisible(false)}
                questions={questionnaireQuestions}
                coach={coach}
                onSubmit={handleQuestionnaireSubmit}
                loading={subscribingStates.some(state => state)} // 如果有任何一个处于加载状态，则禁用问卷提交
            />

            <PaymentDialog
                visible={paymentDialogVisible}
                onHide={() => setPaymentDialogVisible(false)}
                amount={subscriptionTiers[currentTierIndex]?.price}
                coachId={coach.id}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
            />
        </div>
    );
};

export default CoachSubscription;