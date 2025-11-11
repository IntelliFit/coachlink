'use client';

import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Chart } from 'primereact/chart';
import Image from 'next/image';
import { Brain, Users, Trophy } from 'lucide-react';

export default function Home() {

    const navigateToProtectedPage = (page: string) => {
        console.log(`Navigating to ${page}`);
    };

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

    const chartData = {
        labels: ['力量', '耐力', '柔韧性', '速度', '协调性'],
        datasets: [
            {
                label: '当前水平',
                data: [85, 70, 60, 80, 75],
                backgroundColor: 'rgba(59,130,246,0.2)',
                borderColor: 'rgb(59,130,246)',
                pointBackgroundColor: 'rgb(59,130,246)',
                fill: true,
            },
        ],
    };

    const chartOptions = {
        plugins: {
            legend: {
                labels: {
                    color: 'var(--text-color)',
                },
            },
        },
        scales: {
            r: {
                grid: {
                    color: 'var(--surface-border)',
                },
                pointLabels: {
                    color: 'var(--text-color-secondary)',
                },
                angleLines: {
                    color: 'var(--surface-border)',
                },
                ticks: {
                    color: 'var(--text-color-secondary)',
                },
            },
        },
    };

    const FeatureCard = ({
        icon: Icon,
        title,
        subTitle,
        text,
        page,
        className = '',
    }: {
        icon: any;
        title: string;
        subTitle: string;
        text: string;
        page: string;
        className?: string;
    }) => (
        <Card
            className={`hover:shadow-lg transition-shadow cursor-pointer ${className}`}
            footer={getFooter(page)}
            onClick={() => navigateToProtectedPage(page)}
        >
            <div className="flex items-start gap-3 mb-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-primary mb-1">{title}</h3>
                    <span className="text-sm text-muted-color">{subTitle}</span>
                </div>
            </div>
            <p className="text-muted-color leading-relaxed">{text}</p>
        </Card>
    );

    return (
        <main className="flex flex-col min-h-screen transition-colors duration-300 p-4 md:p-12 bg-white dark:bg-gray-900">
            <div className="w-full max-w-[1440px] mx-auto flex flex-col align-top md:flex-row gap-12">

                {/* 左侧内容 */}
                <section className="flex-1 flex flex-col justify-start space-y-8 md:pt-20">
                    <h1 className="text-3xl md:text-6xl font-bold text-primary">
                        欢迎来到 CoachLink
                    </h1>
                    <p className="text-base md:text-lg text-muted-color max-w-xl">
                        您的智能健身助手平台。通过AI训练、专业教练与量化数据分析，助您更高效地达成健身目标。
                    </p>

                    {/* 卡片区域 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mt-6">
                        <FeatureCard
                            icon={Brain}
                            title="AI训练计划"
                            subTitle="个性化定制方案"
                            text="基于AI算法，根据您的身体状况和目标制定专属训练计划。"
                            page="training-plans"
                        />
                        <FeatureCard
                            icon={Users}
                            title="教练服务"
                            subTitle="专业教练指导"
                            text="获得专业教练一对一指导，提升训练效果和安全性。"
                            page="coach"
                        />
                        <FeatureCard
                            icon={Trophy}
                            title="排行榜"
                            subTitle="竞技激励体系"
                            text="与他人竞技，激发训练动力，争夺运动排行榜。"
                            page="ranking"
                            className="sm:col-span-2"
                        />
                    </div>
                </section>

                {/* 右侧内容 */}
                <section className="flex-1 flex flex-col items-center justify-start space-y-8 mt-8 md:mt-0">
                    <div className="relative w-full max-w-lg md:max-w-xl aspect-square rounded-2xl overflow-hidden shadow-md">
                        <Image
                            src="/images/cover_2.jpg"
                            alt="健身仪表盘"
                            fill
                            className="object-cover"
                            priority
                        />
                    </div>

                    <Card title="训练量化分析" className="w-full max-w-lg md:max-w-xl shadow-md">
                        <Chart type="radar" data={chartData} options={chartOptions} />
                    </Card>
                </section>

            </div>
        </main>

    );
}
