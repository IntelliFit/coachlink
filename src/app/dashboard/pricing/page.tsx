'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import PricingSettings from './PricingSettings';
import IntakeQuestionSettings from './QuestionSettings';
import { Card } from 'primereact/card';
import { Pricing } from '@/app/api/coach/get-pricing/entity';


const PricingPage = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    
    const [pricingTiers, setPricingTiers] = useState<Pricing[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const loadPricing = async () => {
            if (coach?.id) {
                try {
                    setLoading(true);
                    const result = await coachService.getPricing();
                    
                    // 解析定价数据
                    if (result?.pricings) {
                        try {
                            setPricingTiers(result.pricings);
                        } catch (e) {
                            console.error('解析定价数据失败:', e);
                        }
                    }
                    
                    // 默认价格档位
                    setPricingTiers([
                        {
                            title: 'AI版',
                            price: 99,
                            features: [
                                '个性化AI训练计划生成',
                                '基础动作指导',
                                '每月计划更新',
                                '社区讨论权限'
                            ],
                            is_recommend: false
                        },
                        {
                            title: '高级版',
                            price: 299,
                            features: [
                                '包含AI版所有功能',
                                '上传训练视频',
                                '专业动作点评',
                                '语音/文字反馈',
                                '训练建议优化'
                            ],
                            is_recommend: true
                        }
                    ]);
                } catch (error) {
                    console.error('加载定价信息失败:', error);
                    // 默认价格档位
                    setPricingTiers([
                        {
                            title: 'AI版',
                            price: 99,
                            features: [
                                '个性化AI训练计划生成',
                                '基础动作指导',
                                '每月计划更新',
                                '社区讨论权限'
                            ],
                            is_recommend: false
                        },
                        {
                            title: '高级版',
                            price: 299,
                            features: [
                                '包含AI版所有功能',
                                '上传训练视频',
                                '专业动作点评',
                                '语音/文字反馈',
                                '训练建议优化'
                            ],
                            is_recommend: true
                        }
                    ]);
                } finally {
                    setLoading(false);
                }
            }
        };

        loadPricing();
    }, [coach?.id]);

    const handlePricingUpdate = (tiers: Pricing[]) => {
        setPricingTiers(tiers);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">服务与定价</h1>
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
            ) : coach?.id ? (
                <>
                    <PricingSettings 
                        coachId={coach.id}
                        initialPricingTiers={pricingTiers}
                        onPricingUpdate={handlePricingUpdate}
                    />
                    
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