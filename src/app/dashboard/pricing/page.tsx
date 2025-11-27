'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import PricingSettings from './PricingSettings';
import IntakeQuestionSettings from './QuestionSettings';
import { Card } from 'primereact/card';

const PricingPage = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    
    const [pricing, setPricing] = useState<{ aiPrice: number; premiumPrice: number } | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadPricing = async () => {
            if (coach?.id) {
                try {
                    setLoading(true);
                    const result = await coachService.getPricing({ coach_id: coach.id });
                    
                    if (result?.pricing) {
                        setPricing({
                            aiPrice: result.pricing.ai_monthly || 99,
                            premiumPrice: result.pricing.premium_monthly || 299
                        });
                    } else {
                        // 默认价格
                        setPricing({
                            aiPrice: 99,
                            premiumPrice: 299
                        });
                    }
                } catch (error) {
                    console.error('加载定价信息失败:', error);
                    // 默认价格
                    setPricing({
                        aiPrice: 99,
                        premiumPrice: 299
                    });
                } finally {
                    setLoading(false);
                }
            }
        };

        loadPricing();
    }, [coach?.id]);

    const handlePricingUpdate = (aiPrice: number, premiumPrice: number) => {
        setPricing({ aiPrice, premiumPrice });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">服务与定价</h1>
                    <p className="text-surface-500 mt-1">设置 AI版 与 高级版 的月度价格</p>
                </div>
            </div>

            {loading ? (
                <div className="space-y-6">
                    <div className="card">
                        <div className="p-6">
                            <Skeleton width="10rem" height="2rem" className="mb-4" />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                <Skeleton width="100%" height="4rem" />
                                <Skeleton width="100%" height="4rem" />
                            </div>
                            <Skeleton width="8rem" height="2.5rem" />
                        </div>
                    </div>
                    <div className="card">
                        <div className="p-6">
                            <Skeleton width="10rem" height="2rem" className="mb-4" />
                            <Skeleton width="100%" height="8rem" className="mb-4" />
                            <Skeleton width="100%" height="3rem" />
                        </div>
                    </div>
                </div>
            ) : pricing && coach?.id ? (
                <>
                    <PricingSettings 
                        coachId={coach.id}
                        initialAiPrice={pricing.aiPrice}
                        initialPremiumPrice={pricing.premiumPrice}
                        onPricingUpdate={handlePricingUpdate}
                    />
                    
                    <Card title="展示规则" className="mt-6">
                        <div className="p-4 text-surface-600">
                            <ul className="list-disc pl-5 space-y-1">
                                <li>价格必须为正数。</li>
                                <li>高级版价格必须高于 AI版价格。</li>
                                <li>学员侧教练主页中的"服务与定价"模块将实时读取此处设置。</li>
                            </ul>
                        </div>
                    </Card>
                    
                    <IntakeQuestionSettings coachId={coach.id} />
                </>
            ) : (
                <div className="card">
                    <div className="p-6 text-center">
                        <p>无法加载定价信息</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PricingPage;