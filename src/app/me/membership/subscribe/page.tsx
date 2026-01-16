'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { TabView, TabPanel } from 'primereact/tabview';
import { studentMembershipService } from '@/app/service/studentMembershipService';
import { Check, Sparkles, Database } from 'lucide-react';
import { useToastContext } from '@/context/ToastContext';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SubscribePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [currentTier, setCurrentTier] = useState<string>('free');
    
    const initialIndex = searchParams.get('tab') === 'addon' ? 1 : 0;
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    useEffect(() => {
        // Fetch current membership status
        studentMembershipService.getMembership().then(res => {
            if (res && res.tier) {
                setCurrentTier(res.tier);
            }
        }).catch(err => console.error('Failed to fetch membership status', err));
    }, []);

    const handlePurchase = async (productKey: string) => {
        setLoading(true);
        try {
            const res = await studentMembershipService.createOrder({
                productKey,
                paymentMethod: 'alipay'
            });            
            
            if (res?.paymentHtml) {
                // Render the Alipay form and auto-submit
                const div = document.createElement('div');
                div.innerHTML = res.paymentHtml;
                document.body.appendChild(div);
                const form = div.querySelector('form');
                if (form) {
                    form.submit();
                } else {
                    // Fallback if not a form (e.g. url) although our API returns form
                    console.error("Invalid payment response");
                }
            } else {
                showToast({
                    severity: 'error',
                    summary: "创建订单失败",
                    detail: "请稍后重试"
                });
            }
        } catch (error) {
            console.error(error);
            showToast({
                severity: 'error',
                summary: "系统错误",
                detail: "请联系客服"
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl py-10">
            <h1 className="text-3xl font-bold text-center mb-2 text-surface-900">选择适合您的计划</h1>
            <p className="text-surface-500 text-center mb-8">解锁智能潜能，让训练更科学、更高效</p>

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
                        <div className="border border-blue-200 bg-blue-50/30 rounded-xl p-6 flex flex-col h-full shadow-sm">
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-blue-700">基础会员</h3>
                                <p className="text-sm text-surface-500">适合自主训练的爱好者</p>
                                <div className="text-3xl font-bold mt-2 text-blue-700">¥19.9<span className="text-sm font-normal text-surface-500"> /月</span></div>
                            </div>
                            <ul className="space-y-3 text-sm flex-grow mb-6">
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />**全部** 基础+个人动作库</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />每月 **10 次** 智能计划生成</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />**无限** 历史数据查询</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-green-500" />30 条/月 视频存储</li>
                            </ul>
                            {currentTier === 'basic' ? (
                                <Button label="当前计划" outlined disabled className="w-full" />
                            ) : (
                                <Button label={currentTier === 'premium' ? "降级" : "立即订阅"} className="w-full bg-blue-600 border-blue-600 hover:bg-blue-700 hover:border-blue-700" onClick={() => handlePurchase('monthly_basic')} loading={loading} />
                            )}
                        </div>

                        {/* Premium Tier */}
                        <div className="border border-purple-200 bg-purple-50/30 rounded-xl p-6 flex flex-col h-full shadow-lg relative overflow-hidden">
                            <div className="absolute top-0 right-0 bg-purple-600 text-white text-xs px-3 py-1 rounded-bl-lg">推荐</div>
                            <div className="mb-4">
                                <h3 className="text-xl font-bold text-purple-700">高级会员</h3>
                                <p className="text-sm text-surface-500">极致体验与深度洞察</p>
                                <div className="text-3xl font-bold mt-2 text-purple-700">¥39.9<span className="text-sm font-normal text-surface-500"> /月</span></div>
                            </div>
                            <ul className="space-y-3 text-sm font-medium flex-grow mb-6">
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-purple-600" />**无限次** 智能计划生成</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-purple-600" />**智能深度洞察报告**</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-purple-600" />优先使用新功能模板</li>
                                <li className="flex items-center"><Check className="mr-2 h-4 w-4 text-purple-600" />100 条/月 视频存储</li>
                                <li className="flex items-center text-purple-800"><Check className="mr-2 h-4 w-4" />订阅真人教练享 **9折**</li>
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
                        <div className="border border-surface-200 rounded-xl p-6 bg-surface-0 shadow-sm flex flex-col">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-yellow-100 rounded-lg"><Sparkles className="w-6 h-6 text-yellow-600"/></div>
                                <h3 className="text-xl font-bold text-surface-900">智能导入加油包</h3>
                            </div>
                            <p className="text-sm text-surface-500 mb-4">单次购买，永不过期</p>
                            <div className="text-2xl font-bold mb-4 text-surface-900">¥2.0 <span className="text-base font-normal text-surface-500">/ 3次</span></div>
                            <p className="text-sm text-surface-600 mb-6 flex-grow">当月度配额用完时，可购买加油包继续使用智能生成计划功能。</p>
                            <Button label="购买" outlined severity="secondary" onClick={() => handlePurchase('ai_pack_basic')} loading={loading} className="w-full" />
                        </div>

                        <div className="border border-surface-200 rounded-xl p-6 bg-surface-0 shadow-sm flex flex-col">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 bg-blue-100 rounded-lg"><Database className="w-6 h-6 text-blue-600"/></div>
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
