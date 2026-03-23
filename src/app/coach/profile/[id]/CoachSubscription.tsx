'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Inbox, CheckCircle, Package, Bolt, Star, Shield, ArrowRight, ShoppingCart } from 'lucide-react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Divider } from 'primereact/divider';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCart } from '@/context/CartContext';

// 类型定义
import type { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import type { Product, PricingTier, DurationOption } from '@/app/api/coach/get-pricing/entity';
import type { CoachesRow, CoachSubscriptionRow } from '@/types';
import type { TrainingItem } from '@/types/questionnaires';

// 组件引用
import QuestionnaireForm from './QuestionnaireForm';
import PaymentDialog, { OfflinePaymentData } from '@/components/payment/paymentDialog';
import { useGuideStore } from '@/stores/useGuideStore';
import { supportsOfflinePaymentForCoach } from '@/lib/offlinePaymentPolicy';

interface CoachSubscriptionProps {
    coach: CoachesRow;
    mySubscriptions: QueryCoachSubscription[];
    onSubscribeSuccess: (tier?: number) => void;
}

const CoachSubscription: React.FC<CoachSubscriptionProps> = ({
    coach,
    mySubscriptions,
    onSubscribeSuccess,
}) => {
    const { showToast } = useToastContext();
    const router = useRouter();
    const { data: session } = useSession();
    const { startGuide, hasCompletedGuide, isLoading: isGuideLoading } = useGuideStore();
    const { addToCart } = useCart();

    // 状态管理
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [subscribing, setSubscribing] = useState(false);
    
    // 弹窗状态
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [paymentDialogVisible, setPaymentDialogVisible] = useState(false);
    const [isOfflinePaymentMode, setIsOfflinePaymentMode] = useState(false);
    
    // 选择逻辑
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [selectedDuration, setSelectedDuration] = useState<DurationOption | null>(null);
    const [coachSubscription, setCoachSubscription] = useState<CoachSubscriptionRow | null>(null);
    const [renewMode, setRenewMode] = useState(false);
    const autoSubscribeOnceRef = useRef(false);

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

    // When dialogs open, show action-specific guides (in-context, not just homepage tour)
    useEffect(() => {
        if (isGuideLoading) return;
        if (questionnaireVisible && !hasCompletedGuide('student_questionnaire')) {
            const t = setTimeout(() => startGuide('STUDENT_QUESTIONNAIRE_GUIDE'), 200);
            return () => clearTimeout(t);
        }
    }, [questionnaireVisible, hasCompletedGuide, startGuide, isGuideLoading]);

    useEffect(() => {
        if (isGuideLoading) return;
        if (paymentDialogVisible && !hasCompletedGuide('student_payment')) {
            const t = setTimeout(() => startGuide('STUDENT_PAYMENT_GUIDE'), 200);
            return () => clearTimeout(t);
        }
    }, [paymentDialogVisible, hasCompletedGuide, startGuide, isGuideLoading]);

    const searchParams = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const isRenewFromUrl = searchParams.get('renew') === 'true' || searchParams.get('extend') === 'true';

    // Derive the active subscription for this coach (used by renewal flow)
    const activeSub = mySubscriptions.find(
        (sub) => sub.coach_id === coach?.id && sub.status === 'active',
    );
    const allowOfflinePayment = supportsOfflinePaymentForCoach({
        coachName: coach?.name || coach?.title,
    });

    useEffect(() => {
        if (isRenewFromUrl) setRenewMode(true);
    }, [isRenewFromUrl]);

    const enterRenewMode = () => {
        setRenewMode(true);
        // Ensure URL is shareable / consistent with existing deep links
        router.push(`/coach/profile/${coach.id}?renew=true`);
        // Optional: scroll to pricing selector
        setTimeout(() => {
            try {
                document.getElementById('choose-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch { }
        }, 50);
    };

    // 订阅流程处理
    const handleSelectProduct = async (product: Product, duration: DurationOption) => {
        setSelectedProduct(product);
        setSelectedDuration(duration);
        setIsOfflinePaymentMode(false);
        
        try {
            setSubscribing(true);

            // 登录保护：订阅/支付/购物车均需要登录
            if (!session?.user?.id) {
                try {
                    const redirect = typeof window !== 'undefined'
                        ? `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
                        : `/coach/profile/${coach.id}?tab=1`; // 订阅价格现在在第二栏（index 1）
                    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
                } catch {
                    router.push('/login');
                }
                return;
            }

            if (activeSub && !renewMode) {
                showToast({ severity: 'info', summary: '您已订阅该教练', detail: '点击上方【续费】即可延长订阅' });
                return;
            }

            if (renewMode || activeSub) {
                setPaymentDialogVisible(true);
                return;
            }

            const qRes = await coachService.getQuestionnaires({ coachId: coach.id });
            if (qRes?.questionnaires?.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                // 无问卷时，也必须先创建订阅记录（否则平台支付无法绑定 subscriptionId，且后续无法自动确认）
                if (!renewMode) {
                    const res = await subscriptionService.createSubscription({
                        coachId: coach.id,
                        tier: product.tier === 'basic' ? 1 : product.tier === 'standard' ? 2 : 3,
                        monthlyPrice: duration.price || 0,
                        status: 'inactive',
                        subscribeData: [],
                        productId: product.id,
                        productName: product.name,
                        productTier: product.tier,
                        subscribedWeeks: (duration.months || 1) * 4
                    });
                    if (res) {
                        setCoachSubscription(res.subscription);
                    }
                }

                setPaymentDialogVisible(true);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '启动订阅流程失败' });
        } finally {
            setSubscribing(false);
        }
    };

    // 购物车/市场页跳转进来：自动选中商品并触发订阅流程（一次性）
    useEffect(() => {
        if (autoSubscribeOnceRef.current) return;
        if (loading) return;
        if (!products || products.length === 0) return;
        if (typeof window === 'undefined') return;

        const sp = new URLSearchParams(window.location.search);
        const autoSubscribe = sp.get('autoSubscribe') === '1';
        const productId = sp.get('productId') || '';
        const months = Number(sp.get('months') || '');
        if (!autoSubscribe || !productId || !Number.isFinite(months)) return;

        const product = products.find((p) => p.id === productId);
        const duration = product?.duration_options?.find((o) => Number(o.months) === months);
        if (!product || !duration) return;

        autoSubscribeOnceRef.current = true;
        // 确保滚动到订阅区域
        try {
            document.getElementById('choose-pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch { }
        void handleSelectProduct(product, duration);
    }, [loading, products]);

    const handlePaymentSuccess = async (note?: string, offlinePaymentData?: OfflinePaymentData) => {
        const isOffline = Boolean(offlinePaymentData);
        if (!isOffline && (!selectedProduct || !selectedDuration)) return;
        
        const additionalWeeks = selectedDuration ? selectedDuration.months * 4 : 0;
        const targetSubscriptionId = renewMode
            ? (activeSub?.id || coachSubscription?.id)
            : (coachSubscription?.id || activeSub?.id);

        if (!targetSubscriptionId) return;

        // NOTE: 平台支付（alipay_api）不再走 onSuccess；只会在支付成功回调中自动确认并生效。
        // 这里的 onSuccess 仅用于“个人收款码/线下已支付”这类无法自动验款的流程。

        // 支付相关信息统一写入 payment_data（不要污染 subscribe_data，避免覆盖问卷/档案数据）
        const nowIso = new Date().toISOString();
        const currentPaymentData = (renewMode ? (activeSub as any)?.payment_data : coachSubscription?.payment_data) as any;
        const basePaymentData =
            currentPaymentData && typeof currentPaymentData === 'object' && !Array.isArray(currentPaymentData)
                ? currentPaymentData
                : {};

        const nextPaymentData: any = {
            ...basePaymentData,
            offline_payment: offlinePaymentData || null,
            pending_renew: renewMode && selectedDuration
                ? {
                      additional_weeks: additionalWeeks,
                      amount: selectedDuration.price,
                      requested_at: nowIso,
                  }
                : null,
        };

        const res = await subscriptionService.updateSubscription({
            id: targetSubscriptionId,
            status: 'waiting',
            has_remind_coach: true,
            remind_coach_note: note || '',
            payment_method: offlinePaymentData ? 'offline' : 'personal_qrcode',
            payment_data: nextPaymentData as any,
            ...(offlinePaymentData?.expires_at ? { end_date: offlinePaymentData.expires_at } : {}),
        });

        if (res) {
            if (!isOffline && selectedProduct) {
                onSubscribeSuccess(selectedProduct.tier === 'basic' ? 1 : selectedProduct.tier === 'standard' ? 2 : 3);
            } else {
                onSubscribeSuccess(undefined);
            }
            setPaymentDialogVisible(false);
        }
    };

    // 处理线下支付（直接从套餐选择页面触发）
    const handleOfflinePayment = async (product: Product, duration: DurationOption) => {
        if (!allowOfflinePayment) {
            showToast({
                severity: 'warn',
                summary: '该教练仅支持线上支付',
                detail: '请使用扫码或平台支付完成订阅。',
            });
            return;
        }

        setSelectedProduct(product);
        setSelectedDuration(duration);
        setIsOfflinePaymentMode(true); // 标记为线下支付模式
        
        try {
            setSubscribing(true);

            // 登录保护：订阅/支付均需要登录
            if (!session?.user?.id) {
                try {
                    const redirect = typeof window !== 'undefined'
                        ? `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
                        : `/coach/profile/${coach.id}?tab=1`; // 订阅价格现在在第二栏（index 1）
                    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
                } catch {
                    router.push('/login');
                }
                return;
            }

            if (activeSub && !renewMode) {
                showToast({ severity: 'info', summary: '您已订阅该教练', detail: '点击上方【续费】即可延长订阅' });
                return;
            }

            // 如果是续费模式，直接打开支付对话框
            if (renewMode || activeSub) {
                setPaymentDialogVisible(true);
                return;
            }

            // 检查是否有问卷
            const qRes = await coachService.getQuestionnaires({ coachId: coach.id });
            if (qRes?.questionnaires?.length > 0) {
                // 有问卷时，先填写问卷
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                // 无问卷时，直接创建订阅记录并打开支付对话框
                const res = await subscriptionService.createSubscription({
                    coachId: coach.id,
                    tier: product.tier === 'basic' ? 1 : product.tier === 'standard' ? 2 : 3,
                    monthlyPrice: duration.price || 0,
                    status: 'inactive',
                    subscribeData: [],
                    productId: product.id,
                    productName: product.name,
                    productTier: product.tier,
                    subscribedWeeks: duration.months * 4
                });
                if (res) {
                    setCoachSubscription(res.subscription);
                    setPaymentDialogVisible(true);
                }
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '启动订阅流程失败' });
        } finally {
            setSubscribing(false);
        }
    };

    const handleOfflineEntry = async () => {
        if (!allowOfflinePayment) {
            showToast({
                severity: 'warn',
                summary: '该教练仅支持线上支付',
                detail: '当前教练不支持线下已付续费。',
            });
            return;
        }

        setIsOfflinePaymentMode(true);
        setSelectedProduct(null);
        setSelectedDuration(null);
        try {
            setSubscribing(true);
            // 登录保护：订阅/支付均需要登录
            if (!session?.user?.id) {
                try {
                    const redirect = typeof window !== 'undefined'
                        ? `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
                        : `/coach/profile/${coach.id}?tab=1`; // 订阅价格现在在第二栏（index 1）
                    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
                } catch {
                    router.push('/login');
                }
                return;
            }

            if (activeSub) {
                setPaymentDialogVisible(true);
                return;
            }

            const qRes = await coachService.getQuestionnaires({ coachId: coach.id });
            if (qRes?.questionnaires?.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
                return;
            }

            if (!coachSubscription) {
                const res = await subscriptionService.createSubscription({
                    coachId: coach.id,
                    tier: 1,
                    monthlyPrice: 0,
                    status: 'inactive',
                    subscribeData: [],
                });
                if (res) {
                    setCoachSubscription(res.subscription);
                }
            }
            setPaymentDialogVisible(true);
        } catch (error) {
            showToast({ severity: 'error', summary: '启动订阅流程失败' });
        } finally {
            setSubscribing(false);
        }
    };

    // 渲染产品卡片 (与 PricingSettings 镜像)
    const renderProductCard = (product: Product) => (
        <div key={product.id} className="bg-surface border border-surface-200 rounded-2xl p-6 hover:border-primary-400 hover:shadow-md transition-all duration-300 flex flex-col justify-between">
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
                        <div key={idx} className="flex gap-2">
                            <button
                                onClick={() => handleSelectProduct(product, opt)}
                                disabled={subscribing}
                                className="flex-1 flex justify-between items-center p-3 rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-primary-50 hover:border-primary-200 dark:hover:bg-primary-800/50 dark:hover:border-primary-700 transition-all group"
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
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await addToCart({
                                            coachId: coach.id,
                                            coachName: coach.name || '教练',
                                            productId: product.id,
                                            productName: product.name,
                                            productTier: product.tier,
                                            durationMonths: opt.months,
                                            price: opt.price,
                                        });
                                        showToast({
                                            severity: 'success',
                                            summary: '已加入购物车',
                                            detail: `${product.name} - ${opt.months}个月`,
                                        });
                                    } catch (error: any) {
                                        showToast({
                                            severity: 'error',
                                            summary: '添加失败',
                                            detail: error.message || '请稍后重试',
                                        });
                                    }
                                }}
                                className="p-3 rounded-xl border border-surface-100 bg-surface-50/50 hover:bg-primary-50 hover:border-primary-200 dark:hover:bg-primary-800/50 dark:hover:border-primary-700 transition-all group"
                                title="加入购物车"
                            >
                                <ShoppingCart className="w-5 h-5 text-surface-400 group-hover:text-primary transition-colors" />
                            </button>
                        </div>
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
            {/* Anchor for "scroll to pricing" behaviors (mobile CTA / content lock CTA) */}
            <div id="choose-pricing" className="scroll-mt-24" />

            {/* Renewal entry: keep it primarily on coach profile page */}
            {activeSub && (
                <div className="mb-6 rounded-3xl border border-surface-200 bg-surface-50/60 p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-widest text-surface-500">订阅管理</div>
                        <div className="text-lg font-black text-surface-900 tracking-tight mt-1">
                            您已订阅该教练
                        </div>
                        <div className="text-sm text-surface-500 mt-1">
                            {renewMode ? '续费模式已开启：请选择任意方案与时长完成续费。' : '如需延长订阅，请点击右侧【续费】。'}
                        </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        {!renewMode ? (
                            <Button
                                label="续费"
                                icon="pi pi-refresh"
                                className="rounded-2xl"
                                onClick={enterRenewMode}
                            />
                        ) : (
                            <Button
                                label="已开启续费"
                                icon="pi pi-check"
                                outlined
                                className="rounded-2xl"
                                onClick={() => {
                                    // keep user in renewal mode; this is just an affordance
                                    enterRenewMode();
                                }}
                            />
                        )}
                    </div>
                </div>
            )}

            <div className="flex justify-end mb-4">
                <Button
                    icon="pi pi-question-circle"
                    label="新手引导"
                    outlined
                    size="small"
                    onClick={() => startGuide('STUDENT_SUBSCRIBE_FLOW_GUIDE')}
                />
            </div>
            {allowOfflinePayment ? (
                <div className="mb-6 rounded-3xl border border-green-200/60 bg-green-50/40 p-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                    <div className="min-w-0">
                        <div className="text-xs font-black uppercase tracking-widest text-green-600/80">线下已支付</div>
                        <div className="text-lg font-black text-surface-900 tracking-tight mt-1">
                            上传凭证后订阅
                        </div>
                        <div className="text-sm text-surface-500 mt-1">线下已付款需上传凭证，若教练设置了问卷则需先填写</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                        <Button
                            label="线下已支付"
                            icon="pi pi-wallet"
                            className="rounded-2xl p-button-success"
                            onClick={handleOfflineEntry}
                            disabled={subscribing}
                        />
                    </div>
                </div>
            ) : (
                <div className="mb-6 rounded-3xl border border-blue-200/60 bg-blue-50/40 p-5">
                    <div className="text-xs font-black uppercase tracking-widest text-blue-600/80">支付说明</div>
                    <div className="text-lg font-black text-surface-900 tracking-tight mt-1">
                        该教练仅支持线上支付
                    </div>
                    <div className="text-sm text-surface-500 mt-1">
                        请在支付弹窗中使用扫码支付或平台支付完成订阅/续费。
                    </div>
                </div>
            )}
            {products.length === 0 ? (
                <div className="py-20 text-center bg-surface-50 rounded-3xl border-2 border-dashed border-surface-200">
                    <Inbox className="w-16 h-16 text-surface-200 mx-auto mb-4" />
                    <h3 className="text-xl font-bold text-surface-900">暂无可用方案</h3>
                    <p className="text-surface-400">该教练尚未配置任何订阅产品</p>
                </div>
            ) : (
                <>
                    <div id="guide-subscribe-products">
                        {renderTierSection('basic')}
                        {renderTierSection('standard')}
                        {renderTierSection('vip')}
                    </div>
                </>
            )}

            {/* 逻辑组件 */}
            <QuestionnaireForm
                visible={questionnaireVisible}
                onHide={() => setQuestionnaireVisible(false)}
                questions={questionnaireQuestions}
                coach={coach}
                onSubmit={async (answers) => {
                    const isOfflineWithoutProduct = isOfflinePaymentMode && !selectedProduct;
                    const res = await subscriptionService.createSubscription({
                        coachId: coach.id,
                        tier: isOfflineWithoutProduct
                            ? 1
                            : selectedProduct?.tier === 'basic'
                                ? 1
                                : selectedProduct?.tier === 'standard'
                                    ? 2
                                    : 3,
                        monthlyPrice: isOfflineWithoutProduct ? 0 : (selectedDuration?.price || 0),
                        status: 'inactive',
                        subscribeData: answers,
                        productId: isOfflineWithoutProduct ? undefined : selectedProduct?.id,
                        productName: isOfflineWithoutProduct ? undefined : selectedProduct?.name,
                        productTier: isOfflineWithoutProduct ? undefined : selectedProduct?.tier,
                        subscribedWeeks: isOfflineWithoutProduct ? undefined : (selectedDuration?.months || 1) * 4
                    });
                    if (res) {
                        setCoachSubscription(res.subscription);
                        setQuestionnaireVisible(false);
                        setPaymentDialogVisible(true);
                        // 注意：isOfflinePaymentMode状态已经在handleOfflinePayment中设置，这里不需要重置
                    }
                }}
                loading={subscribing}
            />

            <PaymentDialog
                visible={paymentDialogVisible}
                onHide={() => {
                    setPaymentDialogVisible(false);
                    setIsOfflinePaymentMode(false); // 关闭时重置状态
                }}
                amount={selectedDuration?.price || 0}
                coachId={coach.id}
                subscriptionId={renewMode
                    ? (activeSub?.id || coachSubscription?.id || undefined)
                    : (coachSubscription?.id || activeSub?.id || undefined)
                }
                subscriptionFlow={renewMode ? 'renew' : 'subscribe'}
                renewAdditionalWeeks={renewMode ? (selectedDuration?.months || 1) * 4 : undefined}
                defaultPaymentMethod={isOfflinePaymentMode && allowOfflinePayment ? 'offline' : undefined}
                allowOfflinePayment={allowOfflinePayment}
                onSuccess={handlePaymentSuccess}
                onCancel={() => {
                    setPaymentDialogVisible(false);
                    setIsOfflinePaymentMode(false); // 取消时重置状态
                }}
            />
        </div>
    );
};

export default CoachSubscription;
