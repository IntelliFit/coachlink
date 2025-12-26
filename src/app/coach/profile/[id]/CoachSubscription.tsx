'use client';

import React, { useEffect, useState } from 'react';
import { Inbox, CheckCircle, Package, Bolt, Star, Shield, ArrowRight } from 'lucide-react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// 类型定义
import type { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import type { Product, PricingTier, DurationOption } from '@/app/api/coach/get-pricing/entity';
import type { CoachesRow, CoachSubscriptionRow } from '@/types';
import type { TrainingItem } from '@/types/questionnaires';

// 组件引用
import QuestionnaireForm from './QuestionnaireForm';
import PaymentDialog from '@/components/payment/paymentDialog';

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
    const { data: session } = useSession();

    // 状态管理
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    
    // 弹窗状态
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
    
    // 选择逻辑
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
    const [coachSubscription, setCoachSubscription] = useState<CoachSubscriptionRow | null>(null);

    // 风格配置 (对应 PricingSettings)
    const tierConfig = {
        basic: { label: '特惠基础版', desc: '低价体验，适合自主训练', color: 'blue', icon: <Bolt className="w-5 h-5" /> },
        standard: { label: '专业指导版', desc: '包含教练指导与沟通', color: 'green', icon: <Star className="w-5 h-5" /> },
        vip: { label: '全能指导版', desc: '不限项目，全方位托管服务', color: 'purple', icon: <Shield className="w-5 h-5" /> }
    };

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                setLoading(true);
                const res = await coachService.getPricing({ coachId: coach.id });
                if (res?.products) setProducts(res.products);
            } catch (error) {
                console.error('加载定价失败', error);
            } finally {
                setLoading(false);
            }
        };
        if (coach?.id) fetchPricing();
    }, [coach?.id]);

    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const isRenew = searchParams.get('renew') === 'true' || searchParams.get('extend') === 'true';

    // 订阅流程处理
    const handleSelectProduct = async (product: Product, duration: DurationOption) => {
        setSelectedProduct(product);
        setSelectedDuration(duration);
        
        try {
            setSubscribing(true);
            const activeSub = mySubscriptions.find(sub => sub.coach_id === coach?.id && sub.status === 'active');

            if (activeSub && !isRenew) {
                showToast({ severity: 'info', summary: '您已订阅该教练', detail: '如需续费，请从"我的教练"页发起' });
                return;
            }

            if (isRenew || activeSub) {
                setPaymentDialogVisible(true);
                return;
            }

            const qRes = await coachService.getQuestionnaires({ coachId: coach.id });
            if (qRes?.questionnaires?.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                setPaymentDialogVisible(true);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '启动订阅流程失败' });
        } finally {
            setSubscribing(false);
        }
    };

    const handlePaymentSuccess = async (note?: string) => {
        if (!selectedProduct || !selectedDuration) return;
        
        if (isRenew) {
            const activeSub = mySubscriptions.find(sub => sub.coach_id === coach?.id && sub.status === 'active');
            if (activeSub) {
                await subscriptionService.renewSubscription({
                    subscriptionId: activeSub.id,
                    renewType: 'extend',
                    additionalWeeks: selectedDuration.months * 4,
                    amount: selectedDuration.price
                });
                showToast({ severity: 'success', summary: '续费成功' });
                setTimeout(() => router.push('/dashboard/student/profile'), 1500);
                return;
            }
        }

        const res = await subscriptionService.updateSubscription({
            id: coachSubscription?.id,
            status: 'waiting',
            has_remind_coach: true,
            remind_coach_note: note || ''
        });

        if (res) {
            onSubscribeSuccess(selectedProduct.tier === 'basic' ? 1 : selectedProduct.tier === 'standard' ? 2 : 3);
            setPaymentDialogVisible(false);
        }
    };

    // 渲染产品卡片 (与 PricingSettings 镜像)
    const renderProductCard = (product: Product) => (
        <div key={product.id} className="bg-white border border-surface-200 rounded-2xl p-6 hover:border-primary-400 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
            <div>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xl text-surface-900">{product.name}</h4>
                        {product.type === 'combo' && <Tag value="套餐" rounded className="text-[10px]" />}
                    </div>
                </div>
                
                <p className="text-sm text-surface-500 mb-6 leading-relaxed">
                    {product.description || '暂无详细描述'}
                </p>

                {product.type === 'combo' && product.included_products && (
                    <div className="mb-6 flex flex-wrap gap-2">
                        {product.included_products.map((item, i) => (
                            <span key={i} className="flex items-center text-[11px] text-surface-400 bg-surface-50 px-2 py-1 rounded-md">
                                <Package className="w-3 h-3 mr-1" /> {item}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <p className="text-xs font-bold text-surface-400 uppercase tracking-widest ml-1">选择计划梯度</p>
                <div className="grid grid-cols-1 gap-2">
                    {product.duration_options.map((opt, idx) => (
                        <button
                            key={idx}
                            onClick={() => handleSelectProduct(product, opt)}
                            disabled={subscribing}
                            className="w-full flex justify-between items-center p-3 rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-primary-50 hover:border-primary-200 transition-all group"
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-surface-700">{opt.months}个月</span>
                                {opt.months >= 3 && <Tag value="推荐" className="text-[9px] px-1 h-4" />}
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-lg font-black text-primary">¥{opt.price}</span>
                                <ArrowRight className="w-4 h-4 text-surface-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    const renderTierSection = (tier: PricingTier) => {
        const config = tierConfig[tier];
        const tierProducts = products.filter(p => p.tier === tier);
        if (tierProducts.length === 0) return null;

        return (
            <div className="mb-10">
                <div className="flex items-center gap-4 mb-6 px-1">
                    <div className={`w-12 h-12 rounded-2xl bg-${config.color}-50 flex items-center justify-center text-${config.color}-500 shadow-sm`}>
                        {config.icon}
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-surface-900 tracking-tight">{config.label}</h3>
                        <p className="text-sm text-surface-400 font-medium">{config.desc}</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tierProducts.map(renderProductCard)}
                </div>
            </div>
        );
    };

    if (loading) return (
        <div className="max-w-7xl mx-auto p-8 space-y-8">
            <Skeleton width="30%" height="2rem" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Skeleton height="300px" borderRadius="1.5rem" />
                <Skeleton height="300px" borderRadius="1.5rem" />
                <Skeleton height="300px" borderRadius="1.5rem" />
            </div>
        </div>
    );

    return (
        <div className="max-w-7xl mx-auto px-4 py-12">
            {products.length === 0 ? (
                <div className="py-20 text-center bg-surface-50 rounded-3xl border-2 border-dashed border-surface-200">
                    <Inbox className="w-16 h-16 text-surface-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-surface-900">暂无可用方案</h3>
                    <p className="text-surface-400">该教练尚未配置任何订阅产品</p>
                </div>
            ) : (
                <>
                    {renderTierSection('basic')}
                    <Divider className="my-12" />
                    {renderTierSection('standard')}
                    <Divider className="my-12" />
                    {renderTierSection('vip')}
                </>
            )}

            {/* 逻辑组件 */}
            <QuestionnaireForm
                visible={questionnaireVisible}
                onHide={() => setQuestionnaireVisible(false)}
                questions={questionnaireQuestions}
                coach={coach}
                onSubmit={async (answers) => {
                    const res = await subscriptionService.createSubscription({
                        coachId: coach.id,
                        tier: selectedProduct?.tier === 'basic' ? 1 : selectedProduct?.tier === 'standard' ? 2 : 3,
                        monthlyPrice: selectedDuration?.price || 0,
                        status: 'inactive',
                        subscribeData: answers,
                        productId: selectedProduct?.id,
                        productName: selectedProduct?.name,
                        productTier: selectedProduct?.tier,
                        subscribedWeeks: (selectedDuration?.months || 1) * 4
                    });
                    if (res) {
                        setCoachSubscription(res.subscription);
                        setQuestionnaireVisible(false);
                        setPaymentDialogVisible(true);
                    }
                }}
                loading={subscribing}
            />

            <PaymentDialog
                visible={paymentDialogVisible}
                onHide={() => setPaymentDialogVisible(false)}
                amount={selectedDuration?.price || 0}
                coachId={coach.id}
                onSuccess={handlePaymentSuccess}
                onCancel={() => setPaymentDialogVisible(false)}
            />
        </div>
    );
};

export default CoachSubscription;