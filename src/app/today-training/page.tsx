'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';

import TodayTrainingCard from './TodayTrainingCard';
import RestDayCard from './RestDayCard';
import BrowseSection from './BrowseSection';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [instance, setInstance] = useState<any>(null);
    const [actions, setActions] = useState<Record<string, any>>({});
    const [todayDayIndex, setTodayDayIndex] = useState(1);
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [executionStatus, setExecutionStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
    const [completedSets, setCompletedSets] = useState(0);
    const [totalSets, setTotalSets] = useState(0);

    useEffect(() => {
        if (session?.user?.id) {
            loadData();
        }
    }, [session?.user?.id]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. 获取订阅
            const subsResponse = await subscriptionService.getCoachSubscriptions({
                studentId: session?.user?.id || '',
            });

            if (!subsResponse?.subscriptions || subsResponse.subscriptions.length === 0) {
                setLoading(false);
                return;
            }

            const activeSub = subsResponse.subscriptions[0];
            setSubscription(activeSub);

            // 2. 获取计划实例（包含actions）
            const res = await planLibService.getInstance({
                subscriptionId: activeSub.id
            });

            if (!res?.instance) {
                showToast({
                    severity: 'warn',
                    summary: '未找到训练计划',
                    detail: '该教练暂未为您分配训练计划',
                });
                setLoading(false);
                return;
            }

            setInstance(res.instance);
            setActions(res.actions || {});

            // 3. 获取下一个待执行的训练日（自动顺延逻辑）
            try {
                const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${res.instance.id}`);
                const nextDayData = await nextDayRes.json();
                if (nextDayData.success && nextDayData.data) {
                    setTodayDayIndex(nextDayData.data.nextDayIndex);
                    
                    // 检查该天的执行状态
                    const execRes = await fetch(`/api/execution/check-today?instanceId=${res.instance.id}&dayIndex=${nextDayData.data.nextDayIndex}`);
                    const execData = await execRes.json();
                    if (execData.success && execData.data) {
                        setExecutionStatus(execData.data.status);
                        setCompletedSets(execData.data.completed_sets || 0);
                        setTotalSets(execData.data.total_sets || 0);
                    }
                }
            } catch (e) {
                console.log('Failed to get next training day, using default');
                setTodayDayIndex(1);
            }

        } catch (error) {
            console.error('加载数据失败:', error);
            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: '无法加载训练数据，请稍后重试',
            });
        } finally {
            setLoading(false);
        }
    };

if (loading) {
    return (
        <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
            {/* 教练卡片骨架 */}
            <div className="h-24 bg-gray-200 rounded-2xl mb-8"></div>
            
            {/* 今日训练标题骨架 */}
            <div className="flex justify-between items-center mb-6">
                <div className="h-8 bg-gray-200 w-48 rounded-lg"></div>
                <div className="h-6 bg-gray-200 w-24 rounded-lg"></div>
            </div>

            {/* 主卡片骨架 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
                <div className="flex gap-4 mb-6">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl"></div>
                    <div className="flex-1 space-y-3">
                        <div className="h-6 bg-gray-100 w-1/3 rounded"></div>
                        <div className="h-4 bg-gray-100 w-1/2 rounded"></div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="h-20 bg-gray-50 rounded-xl"></div>
                    <div className="h-20 bg-gray-50 rounded-xl"></div>
                    <div className="h-20 bg-gray-50 rounded-xl"></div>
                </div>
            </div>
        </div>
    );
}

    if (!subscription) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card>
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">还没有订阅任何教练</h3>
                        <p className="text-gray-600 mb-6">
                            订阅教练后，这里将显示您的每日训练计划
                        </p>
                        <Button
                            label="浏览教练"
                            icon="pi pi-search"
                            onClick={() => router.push('/coach/discovery')}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    if (!instance) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card>
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">暂无训练计划</h3>
                        <p className="text-gray-600 mb-6">
                            您的教练还没有为您分配训练计划
                        </p>
                        <Button
                            label="查看训练计划"
                            icon="pi pi-clipboard"
                            onClick={() => router.push('/coach/plans')}
                        />
                    </div>
                </Card>
            </div>
        );
    }

    // 找到今天的训练日
    const trainingDays = (instance.training_days || []) as any[];
    const todayTraining = trainingDays.find(d => d.dayIndex === todayDayIndex);

return (
    <div className="min-h-screen bg-[#F8FAFC] pb-12">
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* --- 顶部教练信息卡片 --- */}
            {subscription?.coach && (
                <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 mb-8 text-white shadow-2xl shadow-slate-200">
                    {/* 背景装饰图形 */}
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                                    <span className="text-2xl font-black italic">
                                        {subscription.coach.name?.charAt(0) || 'C'}
                                    </span>
                                </div>
                                {/* 在线状态点 */}
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-slate-900 rounded-full"></div>
                            </div>
                            
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-primary-500/20 text-primary-300 text-[10px] font-bold uppercase tracking-wider rounded">PRO COACH</span>
                                    <span className="text-slate-400 text-xs font-medium italic">Assigning your path</span>
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight">
                                    {subscription.coach.name || '未知教练'}
                                </h2>
                                <p className="text-slate-400 text-sm font-medium">
                                    {subscription.coach.title || '资深健身专家'}
                                </p>
                            </div>
                        </div>

                        <div className="hidden md:block text-right border-l border-white/10 pl-8">
                            <div className="text-slate-400 text-xs uppercase mb-1">训练累计</div>
                            <div className="text-xl font-mono font-bold">128 <span className="text-sm font-normal text-slate-500">Days</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 核心内容区域 --- */}
            <div className="space-y-10">
                {/* 今日模块标题层 */}
                <section>
                    <div className="flex items-end justify-between mb-6 px-2">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                                TODAY'S MISSION
                            </h3>
                            <p className="text-slate-500 text-sm">
                                训练日 {todayDayIndex} · {executionStatus === 'completed' ? '已完成' : '进行中'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-primary-600 font-bold text-sm bg-primary-50 px-3 py-1 rounded-full">
                            <i className="pi pi-clock animate-spin-slow" />
                            Keep Pushing
                        </div>
                    </div>

                    {/* 卡片渲染 */}
                    <div className="transform transition-all hover:translate-y-[-4px]">
                        {todayTraining && todayTraining.type === 'training' ? (
                            <TodayTrainingCard
                                day={todayTraining}
                                actions={actions}
                                instanceId={instance.id}
                                dayIndex={todayDayIndex}
                                executionStatus={executionStatus}
                                completedSets={completedSets}
                                totalSets={totalSets}
                            />
                        ) : (
                            <RestDayCard dayIndex={todayDayIndex} />
                        )}
                    </div>
                </section>

                {/* --- 浏览区域 --- */}
                <section className="pt-4">
                    <div className="flex items-center gap-3 mb-6 px-2">
                        <div className="h-px flex-1 bg-slate-200"></div>
                        <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                            Explore Schedule
                        </h4>
                        <div className="h-px flex-1 bg-slate-200"></div>
                    </div>
                    
                    <BrowseSection
                        instance={instance}
                        actions={actions}
                        currentDayIndex={todayDayIndex}
                        todayExecutionStatus={executionStatus}
                    />
                </section>
            </div>
        </div>
        
        {/* 适配 Tailwind 配置的额外样式 */}
        <style jsx global>{`
            .animate-spin-slow {
                animation: spin 3s linear infinite;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `}</style>
    </div>
);
};

export default TodayTrainingPage;
