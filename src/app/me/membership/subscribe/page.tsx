'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { studentMembershipService } from '@/app/service/studentMembershipService';
import { Check, Sparkles, Database } from 'lucide-react';
import { useToastContext } from '@/context/ToastContext';
import { useSearchParams } from 'next/navigation';

type ProductKey =
    | 'monthly_basic'
    | 'monthly_premium'
    | 'ai_pack_basic'
    | 'storage_pack_basic';

const PRODUCT_TAB_INDEX: Record<ProductKey, 0 | 1> = {
    monthly_basic: 0,
    monthly_premium: 0,
    ai_pack_basic: 1,
    storage_pack_basic: 1,
};

const PRODUCT_LABEL: Record<ProductKey, string> = {
    monthly_basic: '基础会员',
    monthly_premium: '高级会员',
    ai_pack_basic: '智能导入加油包',
    storage_pack_basic: '存储扩容包',
};

const VALID_PRODUCT_KEYS = new Set<ProductKey>([
    'monthly_basic',
    'monthly_premium',
    'ai_pack_basic',
    'storage_pack_basic',
]);

type AutoPurchaseStatus = 'idle' | 'pending' | 'failed' | 'skipped';

function isProductKey(value: string | null): value is ProductKey {
    return !!value && VALID_PRODUCT_KEYS.has(value as ProductKey);
}

export default function SubscribePage() {
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<string>('free');
    const [membershipLoaded, setMembershipLoaded] = useState(false);
    const [autoPurchaseStatus, setAutoPurchaseStatus] = useState<AutoPurchaseStatus>('idle');
    const [autoPurchaseError, setAutoPurchaseError] = useState('');

    const queryState = useMemo(() => {
        const tab = searchParams.get('tab');
        const productKeyRaw = searchParams.get('productKey');
        const productKey = isProductKey(productKeyRaw) ? productKeyRaw : null;
        const autoPurchase =
            searchParams.get('autoPurchase') === '1' ||
            searchParams.get('autoPurchase') === 'true';
        return { tab, productKey, autoPurchase };
    }, [searchParams]);

    const [activeIndex, setActiveIndex] = useState<number>(() => {
        if (queryState.productKey) return PRODUCT_TAB_INDEX[queryState.productKey];
        return queryState.tab === 'addon' ? 1 : 0;
    });
    const [highlightedProductKey, setHighlightedProductKey] = useState<ProductKey | null>(
        queryState.productKey,
    );
    const autoPurchaseOnceRef = useRef(false);

    useEffect(() => {
        // Fetch current membership status
        studentMembershipService.getMembership().then(res => {
            if (res && res.tier) {
                setCurrentTier(res.tier);
            }
        }).catch(err => console.error('Failed to fetch membership status', err))
            .finally(() => setMembershipLoaded(true));
    }, []);

    useEffect(() => {
        if (queryState.productKey) {
            setActiveIndex(PRODUCT_TAB_INDEX[queryState.productKey]);
            setHighlightedProductKey(queryState.productKey);
        } else {
            setActiveIndex(queryState.tab === 'addon' ? 1 : 0);
            setHighlightedProductKey(null);
        }
    }, [queryState.productKey, queryState.tab]);

    useEffect(() => {
        autoPurchaseOnceRef.current = false;
        setAutoPurchaseStatus('idle');
        setAutoPurchaseError('');
    }, [queryState.productKey, queryState.autoPurchase]);

    const handlePurchase = useCallback(async (
        productKey: ProductKey,
        options?: { silent?: boolean },
    ) => {
        if (loading) return;

        setLoading(true);
        try {
            const res = await studentMembershipService.createOrder({
                productKey,
                paymentMethod: 'alipay',
            });

            if (res?.paymentHtml) {
                // Render the Alipay form and auto-submit
                const div = document.createElement('div');
                div.innerHTML = res.paymentHtml;
                document.body.appendChild(div);
                const form = div.querySelector('form');
                if (form) {
                    form.submit();
                    return { ok: true as const };
                } else {
                    if (!options?.silent) {
                        showToast({
                            severity: 'error',
                            summary: "拉起支付失败",
                            detail: "请刷新页面后重试",
                        });
                    }
                    console.error("Invalid payment response");
                    return { ok: false as const, message: '支付页面拉起失败，请点击重试。' };
                }
            } else {
                if (!options?.silent) {
                    showToast({
                        severity: 'error',
                        summary: "创建订单失败",
                        detail: "请稍后重试",
                    });
                }
                return { ok: false as const, message: '创建订单失败，请稍后重试。' };
            }
        } catch (error) {
            console.error(error);
            if (!options?.silent) {
                showToast({
                    severity: 'error',
                    summary: "系统错误",
                    detail: "请联系客服",
                });
            }
            return { ok: false as const, message: '网络异常或系统错误，请点击重试。' };
        } finally {
            setLoading(false);
        }
        return { ok: false as const, message: '支付发起失败，请点击重试。' };
    }, [loading, showToast]);

    useEffect(() => {
        if (!membershipLoaded) return;
        if (!queryState.autoPurchase || !queryState.productKey) return;
        if (autoPurchaseOnceRef.current) return;

        const isSameTierPlan =
            (queryState.productKey === 'monthly_basic' && currentTier === 'basic') ||
            (queryState.productKey === 'monthly_premium' && currentTier === 'premium');

        autoPurchaseOnceRef.current = true;
        setAutoPurchaseStatus('pending');
        setAutoPurchaseError('');

        if (isSameTierPlan) {
            setAutoPurchaseStatus('skipped');
            setAutoPurchaseError('当前已是该方案，无需重复发起支付。');
            showToast({
                severity: 'info',
                summary: '当前已是该方案',
                detail: '请按需选择其他会员方案或加油包',
            });
            return;
        }

        void (async () => {
            const result = await handlePurchase(queryState.productKey!, { silent: true });
            if (!result.ok) {
                setAutoPurchaseStatus('failed');
                setAutoPurchaseError(result.message || '自动拉起支付失败，请点击重试。');
            }
        })();
    }, [
        membershipLoaded,
        queryState.autoPurchase,
        queryState.productKey,
        currentTier,
        handlePurchase,
        showToast,
    ]);

    const highlightedCardClass = useCallback((productKey: ProductKey) => (
        highlightedProductKey === productKey
            ? 'ring-2 ring-orange-400 ring-offset-2 shadow-xl'
            : ''
    ), [highlightedProductKey]);

    const handleRetryAutoPurchase = useCallback(async () => {
        if (!queryState.productKey || loading) return;
        setAutoPurchaseStatus('pending');
        setAutoPurchaseError('');
        const result = await handlePurchase(queryState.productKey, { silent: true });
        if (!result.ok) {
            setAutoPurchaseStatus('failed');
            setAutoPurchaseError(result.message || '自动拉起支付失败，请点击重试。');
        }
    }, [queryState.productKey, loading, handlePurchase]);

    return (
        <div className="container mx-auto p-4 max-w-4xl py-10">
            <h1 className="text-3xl font-bold text-center mb-2 text-surface-900">选择适合您的计划</h1>
            <p className="text-surface-500 text-center mb-8">解锁智能潜能，让训练更科学、更高效</p>
            {highlightedProductKey && (
                <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 text-center">
                    已定位到「{PRODUCT_LABEL[highlightedProductKey]}」
                    {queryState.autoPurchase ? '，正在为您拉起支付...' : '，可直接点击购买。'}
                </div>
            )}
            {queryState.autoPurchase && queryState.productKey && (
                <div className="mb-6 rounded-xl border px-4 py-3 text-sm">
                    {autoPurchaseStatus === 'pending' && (
                        <div className="flex items-center justify-between gap-3 text-blue-700 border-blue-200 bg-blue-50 rounded-lg px-3 py-2">
                            <span>支付发起中，请稍候...</span>
                        </div>
                    )}
                    {autoPurchaseStatus === 'failed' && (
                        <div className="flex items-center justify-between gap-3 text-red-700 border-red-200 bg-red-50 rounded-lg px-3 py-2">
                            <span>{autoPurchaseError || '支付发起失败，请重试。'}</span>
                            <Button
                                label={loading ? '重试中...' : '重试'}
                                outlined
                                severity="danger"
                                size="small"
                                onClick={handleRetryAutoPurchase}
                                disabled={loading}
                            />
                        </div>
                    )}
                    {autoPurchaseStatus === 'skipped' && (
                        <div className="text-orange-700 border-orange-200 bg-orange-50 rounded-lg px-3 py-2">
                            {autoPurchaseError}
                        </div>
                    )}
                </div>
            )}

            <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
                <TabPanel header="会员订阅">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
                        {/* Free Tier */}
                        <div className="border border-surface-200 rounded-xl p-6 bg-surface-0 flex flex-col h-full shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-surface-900">免费体验</h3>
                                <p className="text-sm text-surface-500">适合初次尝试的用户</p>
                                <div className="text-3xl font-bold mt-2 text-surface-900">¥0<span className="text-sm font-normal text-surface-500"> /月</span></div>
                            </div>
                            <ul className="space-y-3 text-sm flex-grow mb-6">
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />内建基础动作库</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />每月 2 次智能计划生成</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />近 7 天数据分析</li>
                                <li className="flex items-center text-surface-400"><Check className="mr-2 h-4 w-4" />仅 3 条视频存储</li>
                            </ul>
                            <Button label={currentTier === 'free' ? "当前计划" : "免费版"} outlined disabled={currentTier === 'free'} className="w-full" />
                        </div>

                        {/* Basic Tier */}
                        <div className={`border border-blue-200 bg-blue-50/30 rounded-xl p-6 flex flex-col h-full shadow-sm ${highlightedCardClass('monthly_basic')}`}>
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-blue-700">基础会员</h3>
                                <p className="text-sm text-surface-500">适合自主训练的爱好者</p>
                                <div className="text-3xl font-bold mt-2 text-blue-700">¥19.9<span className="text-sm font-normal text-surface-500"> /月</span></div>
                            </div>
                            <ul className="space-y-3 mb-6">
                                <li className="flex items-center text-surface-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="mr-2 h-4 w-4 text-green-500">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    <span><strong className="font-bold">全部</strong> 基础+个人动作库</span>
                                </li>

                                <li className="flex items-center text-surface-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="mr-2 h-4 w-4 text-green-500">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    <span>每月 <strong className="font-bold">10 次</strong> 智能计划生成</span>
                                </li>

                                <li className="flex items-center text-surface-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="mr-2 h-4 w-4 text-green-500">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    <span><strong className="font-bold">无限</strong> 历史数据查询</span>
                                </li>

                                <li className="flex items-center text-surface-700">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="mr-2 h-4 w-4 text-green-500">
                                        <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                    <span>30 条/月 视频存储</span>
                                </li>
                            </ul>

                            {currentTier === 'basic' ? (
                                <Button label="当前计划" outlined disabled className="w-full" />
                            ) : (
                                <Button label={currentTier === 'premium' ? "降级" : "立即订阅"} className="w-full bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700" onClick={() => handlePurchase('monthly_basic')} loading={loading} />
                            )}
                        </div>

                        {/* Premium Tier */}
                        <div className={`border border-purple-200 bg-purple-50/30 rounded-xl p-6 flex flex-col h-full shadow-lg relative overflow-hidden ${highlightedCardClass('monthly_premium')}`}>
                            <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs px-3 py-1 rounded-bl-lg">推荐</div>
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-purple-700">高级会员</h3>
                                <p className="text-sm text-surface-500">极致体验与深度洞察</p>
                                <div className="text-3xl font-bold mt-2 text-purple-700">¥39.9<span className="text-sm font-normal text-surface-500"> /月</span></div>
                            </div>
                            <ul className="space-y-3 text-sm font-medium flex-grow mb-6">
                                <li className="flex items-center text-surface-700">
                                    <Check className="mr-2 h-4 w-4 text-purple-600 flex-shrink-0" />
                                    <span>
                                        <strong className="font-bold text-surface-900">无限次</strong> 智能计划生成
                                    </span>
                                </li>

                                <li className="flex items-center text-surface-700">
                                    <Check className="mr-2 h-4 w-4 text-purple-600 flex-shrink-0" />
                                    <span>
                                        <strong className="font-bold text-surface-900">智能深度洞察报告</strong>
                                    </span>
                                </li>

                                <li className="flex items-center text-surface-700">
                                    <Check className="mr-2 h-4 w-4 text-purple-600 flex-shrink-0" />
                                    <span>优先使用新功能模板</span>
                                </li>

                                <li className="flex items-center text-surface-700">
                                    <Check className="mr-2 h-4 w-4 text-purple-600 flex-shrink-0" />
                                    <span>100 条/月 视频存储</span>
                                </li>

                                <li className="flex items-center text-purple-800">
                                    <Check className="mr-2 h-4 w-4 flex-shrink-0" />
                                    <span>
                                        订阅真人教练享 <strong className="font-black italic">9折</strong>
                                    </span>
                                </li>
                            </ul>
                            {currentTier === 'premium' ? (
                                <Button label="当前计划" outlined disabled className="w-full" />
                            ) : (
                                <Button label="立即升级" className="w-full bg-purple-600 border-purple-600 hover:bg-purple-700 hover:border-purple-700" onClick={() => handlePurchase('monthly_premium')} loading={loading} />
                            )}
                        </div>
                    </div>
                </TabPanel>

                <TabPanel header="增值加油包">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto pt-4">
                        <div className={`border border-surface-200 rounded-xl p-6 bg-surface-0 shadow-sm flex flex-col ${highlightedCardClass('ai_pack_basic')}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-yellow-100 rounded-lg"><Sparkles className="w-6 h-6 text-yellow-600" /></div>
                                <h3 className="text-xl font-bold text-surface-900">智能导入加油包</h3>
                            </div>
                            <p className="text-sm text-surface-500 mb-4">单次购买，永不过期</p>
                            <div className="text-2xl font-bold mb-4 text-surface-900">¥2.0 <span className="text-base font-normal text-surface-500">/ 3次</span></div>
                            <p className="text-sm text-surface-600 mb-6 flex-grow">当月度配额用完时，可购买加油包继续使用智能生成计划功能。</p>
                            <Button label="购买" outlined severity="secondary" onClick={() => handlePurchase('ai_pack_basic')} loading={loading} className="w-full" />
                        </div>

                        <div className={`border border-surface-200 rounded-xl p-6 bg-surface-0 shadow-sm flex flex-col ${highlightedCardClass('storage_pack_basic')}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 rounded-lg"><Database className="w-6 h-6 text-blue-600" /></div>
                                <h3 className="text-xl font-bold text-surface-900">存储扩容包</h3>
                            </div>
                            <p className="text-sm text-surface-500 mb-4">永久增加云存储空间</p>
                            <div className="text-2xl font-bold mb-4 text-surface-900">¥9.9 <span className="text-base font-normal text-surface-500">/ 1GB</span></div>
                            <p className="text-sm text-surface-600 mb-6 flex-grow">增加额外的视频和动态存储空间，记录更多高光时刻。</p>
                            <Button label="购买" outlined severity="secondary" onClick={() => handlePurchase('storage_pack_basic')} loading={loading} className="w-full" />
                        </div>
                    </div>
                </TabPanel>
            </TabView>
        </div>
    );
}
