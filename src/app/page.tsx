'use client';

import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Divider } from 'primereact/divider';
import { Brain, Users, Trophy, CreditCard } from 'lucide-react';

export default function Home() {

    const navigateToProtectedPage = (page: string) => {
        // 在实际应用中，这里会导航到受保护的页面
        console.log(`Navigating to ${page}`);
    };

    const handlePaymentTest = () => {
        // 在实际应用中，这里会处理支付测试
        console.log('Handling payment test');
    };

    // 定义卡片底部内容
    const getFooter = (page: string) => (
        <div className="flex justify-end">
            <Button
                label="了解更多"
                icon="pi pi-arrow-right"
                size="small"
                iconPos="right"
                onClick={(e) => {
                    e.stopPropagation();
                    navigateToProtectedPage(page);
                }}
            />
        </div>
    );

    return (
        <main className="flex min-h-screen flex-col items-center p-4 md:p-8">

            <div className="w-full max-w-6xl">
                <div className="space-y-8">
                    <div title={'Home'} className="shadow-sm">

                        <Divider />

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-4">
                            {/* AI训练计划 */}
                            <Card
                                title="AI训练计划"
                                subTitle="个性化定制训练方案"
                                className="hover:shadow-md transition-shadow"
                                footer={getFooter('training-plans')}
                                onClick={() => navigateToProtectedPage('training-plans')}
                            >
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                                    <Brain className="w-6 h-6 text-primary" />
                                </div>
                                <p className="text-muted-color">
                                    基于AI算法，根据您的身体状况和目标制定专属训练计划
                                </p>
                            </Card>

                            {/* 教练服务 */}
                            <Card
                                title="教练服务"
                                subTitle="专业教练指导"
                                className="hover:shadow-md transition-shadow"
                                footer={getFooter('coach')}
                                onClick={() => navigateToProtectedPage('coach')}
                            >
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                                    <Users className="w-6 h-6 text-primary" />
                                </div>
                                <p className="text-muted-color">
                                    获得专业教练一对一指导，提升训练效果和安全性
                                </p>
                            </Card>

                            {/* 排行榜 */}
                            <Card
                                title="排行榜"
                                subTitle="查看各项运动排名"
                                className="hover:shadow-md transition-shadow"
                                footer={getFooter('ranking')}
                                onClick={() => navigateToProtectedPage('ranking')}
                            >
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                                    <Trophy className="w-6 h-6 text-primary" />
                                </div>
                                <p className="text-muted-color">
                                    与他人竞技，激发训练动力，争夺各项运动排行榜
                                </p>
                            </Card>

                            {/* 支付功能测试按钮 */}
                            <Card
                                title="支付功能测试"
                                subTitle="测试支付系统"
                                className="hover:shadow-md transition-shadow"
                                footer={
                                    <div className="flex justify-end">
                                        <Button
                                            label="开始测试"
                                            icon="pi pi-credit-card"
                                            iconPos="right"
                                            text
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePaymentTest();
                                            }}
                                            className="p-0"
                                        />
                                    </div>
                                }
                                onClick={() => handlePaymentTest()}
                            >
                                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-4">
                                    <CreditCard className="w-6 h-6 text-primary" />
                                </div>
                                <p className="text-muted-color">
                                    测试支付宝扫码支付功能，测试金额：0.01元
                                </p>
                                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900 rounded text-sm">
                                    💰 仅用于测试，不会实际扣费
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
            <footer className="layout-footer w-full mt-8">
                © 2025 CoachLink
            </footer>
        </main>
    );
}