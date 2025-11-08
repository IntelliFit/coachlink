'use client';

import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { Brain, Users, Trophy, CreditCard } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { useTranslation } from 'react-i18next';

export default function Home() {
    const { theme } = useTheme();
    const { language } = useLanguage();
    const { t } = useTranslation();

    const navigateToProtectedPage = (page: string) => {
        // 在实际应用中，这里会导航到受保护的页面
        console.log(`Navigating to ${page}`);
    };

    const handlePaymentTest = () => {
        // 在实际应用中，这里会处理支付测试
        console.log('Handling payment test');
    };

    return (
        <main className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8">
            <div className="w-full max-w-6xl">
                <div className="space-y-8">
                    <Card title={t('common.welcome')}>
                        <p>{t('home.description')}</p>
                        
                        <Divider />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                            {/* AI训练计划 */}
                            <div 
                                className="p-card p-component shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-lg border" 
                                onClick={() => navigateToProtectedPage('training-plans')}
                            >
                                <div className="p-card-body">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center">
                                            <Brain className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">AI训练计划</h3>
                                            <p>个性化定制训练方案</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 教练服务 */}
                            <div 
                                className="p-card p-component shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-lg border"
                                onClick={() => navigateToProtectedPage('coach')}
                            >
                                <div className="p-card-body">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center">
                                            <Users className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">教练</h3>
                                            <p>专业教练指导服务</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 排行榜 */}
                            <div 
                                className="p-card p-component shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-lg border"
                                onClick={() => navigateToProtectedPage('ranking')}
                            >
                                <div className="p-card-body">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center">
                                            <Trophy className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">排行榜</h3>
                                            <p>查看各项运动排名</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 支付功能测试按钮 */}
                            <div 
                                className="p-card p-component shadow-sm hover:shadow-md transition-shadow cursor-pointer rounded-lg border-2"
                                onClick={() => handlePaymentTest()}
                            >
                                <div className="p-card-body">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center">
                                            <CreditCard className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold">支付功能测试</h3>
                                            <p>测试支付宝扫码支付功能</p>
                                            <p className="text-xs mt-1">💰 测试金额：0.01元</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
            
            <div className="mt-8 text-center">
                <p>CoachLink - Connecting Coaches and Clients</p>
            </div>
            
        </main>
    );
}