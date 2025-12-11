'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { Skeleton } from 'primereact/skeleton';
import PricingSettings from './PricingSettings';
import { Card } from 'primereact/card';
import { Pricing } from '@/app/api/coach/get-pricing/entity';

const PricingPage = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const [loading, setLoading] = useState(true);
    const [hasData, setHasData] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
            setHasData(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">订阅费用设置</h1>
                </div>
            </div>

            {loading ? (
                <div className="space-y-6">
                    {/* 标题区域骨架屏 */}
                    <div className="flex justify-between items-center mb-4">
                        <Skeleton width="200px" height="32px" />
                        <Skeleton width="100px" height="36px" />
                    </div>
                    
                    {/* 定价档位骨架屏 */}
                    {[1, 2, 3].map(item => (
                        <div key={item} className="p-4 border border-surface-200 rounded-xl bg-surface-50">
                            <div className="flex justify-between items-start mb-4">
                                <Skeleton width="100px" height="24px" />
                                {item > 1 && <Skeleton width="80px" height="32px" />}
                            </div>
                            
                            <div className="mb-4">
                                <Skeleton width="100%" height="40px" className="mb-2" />
                                <Skeleton width="80px" height="20px" />
                            </div>
                            
                            <div className="mb-4">
                                <Skeleton width="120px" height="24px" className="mb-2" />
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="flex items-center mb-2">
                                        <Skeleton width="20px" height="20px" className="mr-2" />
                                        <Skeleton width={`${80 + i * 20}%`} height="36px" />
                                    </div>
                                ))}
                            </div>
                            
                            <div className="flex items-center mb-2">
                                <Skeleton width="20px" height="20px" className="mr-2" />
                                <Skeleton width="120px" height="20px" />
                            </div>
                            
                            <div className="flex items-center">
                                <Skeleton width="20px" height="20px" className="mr-2" />
                                <Skeleton width="150px" height="20px" />
                            </div>
                        </div>
                    ))}
                    
                    {/* 规则说明骨架屏 */}
                    <div className="mt-8">
                        <Skeleton width="150px" height="24px" className="mb-4" />
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                <div key={i} className="flex items-center">
                                    <Skeleton width="5px" height="5px" className="mr-2" />
                                    <Skeleton width={`${90 - i * 5}%`} height="18px" />
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* 保存按钮骨架屏 */}
                    <div className="mt-6 flex justify-end">
                        <Skeleton width="100px" height="36px" />
                    </div>
                </div>
            ) : hasData ? (
                <PricingSettings coachId={coach.id} />
            ) : (
                <Card>
                    <div className="text-center py-12">
                        <p className="text-gray-500">暂无数据</p>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default PricingPage;