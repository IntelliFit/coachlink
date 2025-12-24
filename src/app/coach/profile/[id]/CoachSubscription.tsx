'use client';

import React, { useEffect, useState } from 'react';
import { Inbox, CheckCircle, Clock, Package } from 'lucide-react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { useRouter } from 'next/navigation';
import { Pricing, Product, PricingTier, DurationOption } from '@/app/api/coach/get-pricing/entity';
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

const tierLabels: Record<PricingTier, string> = {
    basic: '特惠基础版',
    standard: '专业指导版',
    vip: '全能指导版'
};

const tierDescriptions: Record<PricingTier, string> = {
    basic: '低价体验，适合自主训练',
    standard: '包含教练指导与沟通',
    vip: '不限项目，全方位托管服务'
};

const tierColors: Record<PricingTier, string> = {
    basic: 'border-green-500 bg-green-50 dark:bg-green-900',
    standard: 'border-primary-500 bg-primary-50 dark:bg-primary-900',
    vip: 'border-purple-500 bg-purple-50 dark:bg-purple-900'
};

const tierBadgeColors: Record<PricingTier, string> = {
    basic: 'bg-green-500',
    standard: 'bg-primary-500',
    vip: 'bg-purple-500'
};

const CoachSubscription: React.FC<CoachSubscriptionProps> = ({
    coach,
    mySubscriptions,
    onSubscribeSuccess,
}) => {
    const { showToast } = useToastContext();
    const router = useRouter();
    
    // 新版：产品列表
    const [products, setProducts] = useState<Product[]>([]);
    // 旧版：兼容
    const [subscriptionTiers, setSubscriptionTiers] = useState<Pricing[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);

    const { data: session } = useSession();

    // 时长选择对话框
    const [durationDialogVisible, setDurationDialogVisible] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
    
    // 订阅状态
    const [subscribing, setSubscribing] = useState(false);
    const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
    const [coachSubscription, setCoachSubscription] = useState<CoachSubscriptionRow | null>(null);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                setLoading(true);
                const res = await coachService.getPricing({
                    coachId: coach.id
                });

                if (res) {
                    // 优先使用新版 products
                    if (res.products && res.products.length > 0) {
                        setProducts(res.products);
                    }
                    // 兼容旧版 pricings
                    if (res.pricings) {
                        setSubscriptionTiers(res.pricings);
                    }
                } else {
                    showToast({ severity: 'error', summary: '获取定价信息失败' });
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

    const getProductsByTier = (tier: PricingTier) => {
        return products.filter(p => p.tier === tier);
    };

    const getMinPrice = (product: Product) => {
        if (!product.duration_options || product.duration_options.length === 0) return 0;
        return Math.min(...product.duration_options.map(opt => opt.price));
    };

    const handleSelectProduct = (product: Product) => {
        setSelectedProduct(product);
        // 如果只有一个时长选项，直接进入订阅流程
        if (product.duration_options.length === 1) {
            setSelectedDuration(product.duration_options[0]);
            handleProceedToSubscribe(product, product.duration_options[0]);
        } else {
            setDurationDialogVisible(true);
        }
    };

    const handleSelectDuration = (duration: DurationOption) => {
        setSelectedDuration(duration);
    };

    const handleConfirmDuration = () => {
        if (selectedProduct && selectedDuration) {
            setDurationDialogVisible(false);
            handleProceedToSubscribe(selectedProduct, selectedDuration);
        }
    };

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isRenew = searchParams.get('renew') === 'true';
    const isExtend = searchParams.get('extend') === 'true'; // extend=true也视为续费
    
    // ...

    const handleProceedToSubscribe = async (product: Product, duration: DurationOption) => {
        try {
            setSubscribing(true);

            // 检查是否已有活跃订阅
            const activeSub = mySubscriptions.find(
                sub => sub.coach_id === coach?.id && sub.status === 'active'
            );

            // 如果不是续费模式且有活跃订阅，提示并阻止
            if (activeSub && !isRenew && !isExtend) {
                showToast({ severity: 'info', summary: '您已订阅该教练', detail: '如需续费，请从"我的教练"页点击续费按钮' });
                return;
            }

            if (mySubscriptions.find(
                sub => sub.coach_id === coach?.id && sub.status === 'waiting'
            )) {
                showToast({ severity: 'info', summary: '您已订阅该教练，请等待激活' });
                return;
            }

            // 如果是续费模式，直接进入支付（不需要填问卷）
            if (isRenew || (isExtend && activeSub)) {
                setPaymentDialogVisible(true);
                return;
            }

            // 获取问卷
            const qRes = await coachService.getQuestionnaires({
                coachId: coach.id
            });

            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                // 直接进入支付
                setPaymentDialogVisible(true);
            }
        } catch (error) {
            console.error('订阅过程中出现错误:', error);
            showToast({ severity: 'error', summary: '订阅过程中出现错误' });
        } finally {
            setSubscribing(false);
        }
    };

    const handlePaymentSuccess = async (note?: string) => {
        if (selectedProduct && selectedDuration) {
            
            // 续费逻辑
            if (isRenew || isExtend) {
                const activeSub = mySubscriptions.find(
                    sub => sub.coach_id === coach?.id && sub.status === 'active'
                );
                
                if (activeSub) {
                    const weeks = selectedDuration.months * 4;
                    const res = await subscriptionService.renewSubscription({
                        subscriptionId: activeSub.id,
                        renewType: 'extend',
                        additionalWeeks: weeks,
                        amount: selectedDuration.price
                    });
                    
                    if (res) {
                        onSubscribeSuccess(Number(activeSub.tier)); // 保持原有tier显示
                        showToast({ severity: 'success', summary: '续费成功' });
                        // 续费成功后刷新页面或跳转回首页
                        setTimeout(() => router.push('/dashboard/student/profile'), 1500);
                    } else {
                         showToast({ severity: 'error', summary: '续费失败' });
                    }
                    setPaymentDialogVisible(false);
                    return;
                }
            }

            // 新购逻辑
            // 这里需要根据产品tier映射到旧的tier number，暂时用1
            const tierNumber = selectedProduct.tier === 'basic' ? 1 : selectedProduct.tier === 'standard' ? 2 : 3;
            
            const res = await subscriptionService.updateSubscription({
                id: coachSubscription?.id,
                status: 'waiting',
                has_remind_coach: true,
                remind_coach_note: note || ''
            });

            if (res?.subscription) {
                onSubscribeSuccess(tierNumber);
                setCoachSubscription(res.subscription);
            } else {
                showToast({ severity: 'error', summary: '订阅失败' });
            }
        }
        setPaymentDialogVisible(false);
        setSelectedProduct(null);
        setSelectedDuration(null);
    };
    
    const handlePaymentCancel = () => {
        setPaymentDialogVisible(false);
        setSelectedProduct(null);
        setSelectedDuration(null);
    };

    const handleQuestionnaireSubmit = async (answers: TrainingItem[]) => {
        if (!selectedProduct || !selectedDuration) return;
        
        const tierNumber = selectedProduct.tier === 'basic' ? 1 : selectedProduct.tier === 'standard' ? 2 : 3;

        const weeks = selectedDuration.months * 4; // 估算周数

        const res = await subscriptionService.createSubscription({
            coachId: coach.id,
            tier: tierNumber,
            monthlyPrice: selectedDuration.price,
            status: 'inactive',
            subscribeData: answers,
            // 新增产品字段
            productId: selectedProduct.id,
            productName: selectedProduct.name,
            productTier: selectedProduct.tier,
            subscribedWeeks: weeks
        });

        if (res) {
            setCoachSubscription(res.subscription);
            setQuestionnaireVisible(false);
            setPaymentDialogVisible(true);
        } else {
            showToast({ severity: 'error', summary: '保存订阅问卷失败', detail: '请刷新页面重试' });
        }
    };

    const handleEditPricing = () => {
        router.push('/dashboard/pricing');
    };

    // 渲染产品卡片
    const renderProductCard = (product: Product) => {
        const minPrice = getMinPrice(product);
        const isCombo = product.type === 'combo';
        
        return (
            <div
                key={product.id}
                className="p-4 border-2 border-surface-200 rounded-xl bg-surface hover:shadow-md transition-all duration-200"
            >
                <div className="mb-3">
                    {isCombo && (
                        <span className="inline-flex items-center text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full mb-2">
                            <Package className="w-3 h-3 mr-1" />
                            组合套餐
                        </span>
                    )}
                    <h4 className="font-bold text-lg text-surface-900">{product.name}</h4>
                    {product.description && (
                        <p className="text-sm text-surface-600 mt-1">{product.description}</p>
                    )}
                    {isCombo && product.included_products && (
                        <p className="text-xs text-surface-500 mt-1">
                            包含: {product.included_products.join(' + ')}
                        </p>
                    )}
                </div>
                
                <div className="flex items-baseline mb-4">
                    <span className="text-2xl font-bold text-surface-900">¥{minPrice}</span>
                    <span className="text-surface-500 ml-1 text-sm">
                        /{product.duration_options[0]?.months || 1}个月起
                    </span>
                </div>

                <Button
                    label="选择"
                    onClick={() => handleSelectProduct(product)}
                    loading={subscribing && selectedProduct?.id === product.id}
                    className="w-full p-button-primary"
                />
            </div>
        );
    };

    // 渲染层级分组
    const renderTierSection = (tier: PricingTier) => {
        const tierProducts = getProductsByTier(tier);
        if (tierProducts.length === 0) return null;

        return (
            <div key={tier} className="mb-8">
                <div className={`rounded-xl p-4 mb-4 ${tierColors[tier]}`}>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`text-white text-xs px-2 py-0.5 rounded-full ${tierBadgeColors[tier]}`}>
                            {tierLabels[tier]}
                        </span>
                    </div>
                    <p className="text-sm text-surface-600 dark:text-surface-300">{tierDescriptions[tier]}</p>
                </div>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tierProducts.map(renderProductCard)}
                </div>
            </div>
        );
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
                            <div className="h-6 bg-surface-200 rounded w-3/4 mb-6"></div>
                            <div className="h-10 bg-surface-200 rounded w-1/2 mb-8"></div>
                            <div className="h-10 bg-surface-200 rounded w-full"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 如果没有新版products，也没有旧版pricings，显示空状态
    const hasProducts = products.length > 0;
    const hasPricings = subscriptionTiers.length > 0;

    if (!loading && !hasProducts && !hasPricings) {
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

            {/* 新版：按层级展示产品 */}
            {hasProducts && (
                <>
                    {renderTierSection('basic')}
                    {renderTierSection('standard')}
                    {renderTierSection('vip')}
                </>
            )}

            {/* 旧版兼容：如果没有新版数据，显示旧版 */}
            {!hasProducts && hasPricings && (
                <div className="grid md:grid-cols-3 gap-6">
                    {subscriptionTiers.map((tier, index) => (
                        <div
                            key={index}
                            className={`relative p-6 rounded-xl border-2 flex flex-col justify-between
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
                                label='立即订阅'
                                onClick={() => {
                                    // 转换为Product格式
                                    const mockProduct: Product = {
                                        id: `legacy_${index}`,
                                        tier: 'standard',
                                        type: 'single',
                                        name: tier.title,
                                        duration_options: [{ months: 1, price: tier.price }]
                                    };
                                    handleSelectProduct(mockProduct);
                                }}
                                className="w-full p-button-primary"
                            />
                        </div>
                    ))}
                </div>
            )}

            {/* 时长选择对话框 */}
            <Dialog
                header="选择订阅时长"
                visible={durationDialogVisible}
                style={{ width: '450px' }}
                onHide={() => {
                    setDurationDialogVisible(false);
                    setSelectedProduct(null);
                    setSelectedDuration(null);
                }}
            >
                {selectedProduct && (
                    <div>
                        <p className="mb-4 text-surface-600">
                            您选择了: <strong>{selectedProduct.name}</strong>
                        </p>
                        <div className="grid grid-cols-1 gap-3 mb-4">
                            {selectedProduct.duration_options.map((opt, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => handleSelectDuration(opt)}
                                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all
                                        ${selectedDuration === opt 
                                            ? 'border-primary-500 bg-primary-50' 
                                            : 'border-surface-200 hover:border-surface-400'}`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-surface-500" />
                                            <span className="font-medium">{opt.months}个月</span>
                                            {opt.is_recommend && (
                                                <span className="text-xs bg-primary-500 text-white px-2 py-0.5 rounded-full">推荐</span>
                                            )}
                                        </div>
                                        <span className="text-xl font-bold">¥{opt.price}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button
                            label="确认选择"
                            onClick={handleConfirmDuration}
                            disabled={!selectedDuration}
                            className="w-full"
                        />
                    </div>
                )}
            </Dialog>

            <QuestionnaireForm
                visible={questionnaireVisible}
                onHide={() => setQuestionnaireVisible(false)}
                questions={questionnaireQuestions}
                coach={coach}
                onSubmit={handleQuestionnaireSubmit}
                loading={subscribing}
            />

            <PaymentDialog
                visible={paymentDialogVisible}
                onHide={() => setPaymentDialogVisible(false)}
                amount={selectedDuration?.price || 0}
                coachId={coach.id}
                onSuccess={handlePaymentSuccess}
                onCancel={handlePaymentCancel}
            />
        </div>
    );
};

export default CoachSubscription;