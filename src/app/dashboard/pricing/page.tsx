'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Tag } from 'primereact/tag';
import PricingSettings from './PricingSettings';

const PricingPage = () => {
    const { data: session, status } = useSession();
    const coach = getCoach(session);

    if (!coach?.id) {
        return null;
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] pb-20">
            {/* 页面装饰背景 */}
            <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-50/50 to-transparent -z-10" />

            <div className="max-w-7xl mx-auto px-6 pt-10">

                {/* 内容区域 */}
                <div className="relative">
                    <div className="fadeinup animation-duration-700">
                        <PricingSettings coachId={coach.id} />
                    </div>
                </div>

                <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-6 bg-white rounded-2xl border border-surface-100 shadow-sm flex items-start gap-4">
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <i className="pi pi-question-circle text-xl"></i>
                        </div>
                        <div>
                            <h4 className="font-bold text-surface-800 mb-1">如何定价最合适？</h4>
                            <p className="text-sm text-surface-500 leading-relaxed">参考同级别教练的市场价格，建议初级教练从 199-399/月 起步。</p>
                        </div>
                    </div>
                    <div className="p-6 bg-white rounded-2xl border border-surface-100 shadow-sm flex items-start gap-4">
                        <div className="p-3 bg-purple-50 rounded-lg text-purple-600">
                            <i className="pi pi-shield text-xl"></i>
                        </div>
                        <div>
                            <h4 className="font-bold text-surface-800 mb-1">收入保障政策</h4>
                            <p className="text-sm text-surface-500 leading-relaxed">所有款项由平台托管，学员确认或服务到期后自动结算至您的账户。您可以在
                                <a href="/dashboard/overview">概览</a>
                                查看。
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PricingPage;