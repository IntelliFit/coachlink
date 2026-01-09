'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';

import TodayTrainingCard from './TodayTrainingCard';
import RestDayCard from './RestDayCard';
import BrowseSection from './BrowseSection';

import PlanCompletionModal from '@/components/plan/PlanCompletionModal';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    // 教练分配的计划
    const [coachInstance, setCoachInstance] = useState<any>(null);
    const [coachActions, setCoachActions] = useState<Record<string, any>>({});
    const [coachDayIndex, setCoachDayIndex] = useState(1);
    const [coachTodayCompleted, setCoachTodayCompleted] = useState(false);
    const [coachCompletionDates, setCoachCompletionDates] = useState<Record<number, string>>({});
    
    // 自建计划
    const [selfInstance, setSelfInstance] = useState<any>(null);
    const [selfActions, setSelfActions] = useState<Record<string, any>>({});
    const [selfDayIndex, setSelfDayIndex] = useState(1);
    const [selfTodayCompleted, setSelfTodayCompleted] = useState(false);
    const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>({});
    
    // 当前显示模式: 'coach' | 'self'
    const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach');
    
    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    const [executionStatus, setExecutionStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
    const [completedSets, setCompletedSets] = useState(0);
    const [totalSets, setTotalSets] = useState(0);
    
    // 计划完成弹窗状态
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completedPlanInfo, setCompletedPlanInfo] = useState<{name: string, rate: number} | null>(null);

    // 当前激活的计划（根据 planMode 动态选择）
    const instance = planMode === 'coach' ? coachInstance : selfInstance;
    const actions = planMode === 'coach' ? coachActions : selfActions;
    const todayDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex;
    const todayCompleted = planMode === 'coach' ? coachTodayCompleted : selfTodayCompleted;
    const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates;

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

            const activeSub = subsResponse?.subscriptions?.[0] || null;
            setSubscription(activeSub);

            // 2. 并行加载教练计划和自建计划
            const [coachRes, selfRes] = await Promise.all([
                activeSub 
                    ? planLibService.getInstance({ subscriptionId: activeSub.id })
                    : Promise.resolve(null),
                planLibService.getInstance({ fetchSelf: true })
            ]);

            // 处理教练计划
            if (coachRes?.instance) {
                setCoachInstance(coachRes.instance);
                setCoachActions(coachRes.actions || {});
                
                try {
                    const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${coachRes.instance.id}`);
                    const nextDayData = await nextDayRes.json();
                    if (nextDayData.success && nextDayData.data) {
                        setCoachDayIndex(nextDayData.data.nextDayIndex);
                        setCoachTodayCompleted(nextDayData.data.todayCompleted || false);
                        setCoachCompletionDates(nextDayData.data.completionDates || {});
                        
                        // 检查是否完成所有计划
                        const completedCount = nextDayData.data.completedDays.length;
                        const totalCount = nextDayData.data.totalTrainingDays;
                        
                        if (totalCount > 0 && completedCount >= totalCount && coachRes.instance.status === 'active') {
                             // 自动标记为完成
                             await handleCompletePlan(coachRes.instance);
                        }
                    }
                } catch (e) {
                    const startDay = (coachRes.instance as any).start_execution_day || 1;
                    setCoachDayIndex(startDay);
                }
            }

            // 处理自建计划
            if (selfRes?.instance) {
                setSelfInstance(selfRes.instance);
                setSelfActions(selfRes.actions || {});
                
                try {
                    const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${selfRes.instance.id}`);
                    const nextDayData = await nextDayRes.json();
                    if (nextDayData.success && nextDayData.data) {
                        setSelfDayIndex(nextDayData.data.nextDayIndex);
                        setSelfTodayCompleted(nextDayData.data.todayCompleted || false);
                        setSelfCompletionDates(nextDayData.data.completionDates || {});
                         
                        // 检查是否完成所有计划
                        const completedCount = nextDayData.data.completedDays.length;
                        const totalCount = nextDayData.data.totalTrainingDays;
                        
                        if (totalCount > 0 && completedCount >= totalCount && selfRes.instance.status === 'active') {
                             // 自动标记为完成
                             await handleCompletePlan(selfRes.instance);
                        }
                    }
                } catch (e) {
                    const startDay = (selfRes.instance as any).start_execution_day || 1;
                    setSelfDayIndex(startDay);
                }
            }

            // 设置默认显示模式：优先教练计划，没有则显示自建计划
            if (coachRes?.instance) {
                setPlanMode('coach');
            } else if (selfRes?.instance) {
                setPlanMode('self');
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
    
    // 处理计划完成
    const handleCompletePlan = async (targetInstance: any) => {
        try {
             const res = await fetch('/api/plan-lib/complete-instance', {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ instanceId: targetInstance.id })
             });
             
             if (res.ok) {
                 setCompletedPlanInfo({
                     name: targetInstance.name,
                     rate: 100
                 });
                 setShowCompletionModal(true);
             }
        } catch (error) {
            console.error('完成计划失败', error);
        }
    };

    // 移除自建计划
    const handleRemoveSelfPlan = async () => {
        if (!selfInstance) return;
        
        try {
            await planLibService.deleteInstance({ id: selfInstance.id });
            setSelfInstance(null);
            
            // 如果有教练计划，切换到教练计划
            if (coachInstance) {
                setPlanMode('coach');
            }
            
            showToast({
                severity: 'success',
                summary: '已移除',
                detail: '计划已从今日训练中移除',
            });
        } catch (error) {
            console.error('移除计划失败:', error);
            showToast({
                severity: 'error',
                summary: '移除失败',
                detail: '无法移除计划，请稍后重试',
            });
        }
    };

    // 确认移除对话框
    const confirmRemovePlan = () => {
        confirmDialog({
            message: '确定要移除这个计划吗？移除后将不会在今日训练中显示，但训练记录会保留。',
            header: '确认移除计划',
            icon: 'pi pi-exclamation-triangle',
            acceptClassName: 'p-button-danger',
            acceptLabel: '确认移除',
            rejectLabel: '取消',
            accept: handleRemoveSelfPlan,
        });
    };
    
    // 跳转到问卷更新页面（教练主页）
    const handleUpdateProfile = () => {
        // 导航到教练主页，并触发问卷填写对话框
        if (subscription?.coach_id) {
            router.push(`/coach/profile/${subscription.coach_id}?action=questionnaire`); 
        } else {
            // 没有教练订阅，回退到个人档案
            router.push('/me/profile');
        }
    };

    const handleGenerateNextPlan = () => {
        // 跳转到智能生成页面或计划库页面
        if (subscription?.id) {
             router.push(`/me/plan-lib?subscriptionId=${subscription.id}`);
        } else {
             router.push('/me/plan-lib');
        }
    };
    
    const handleViewHistory = () => {
        router.push('/me/plan-history');
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

    // 判断是否有任何计划
    const hasAnyPlan = coachInstance || selfInstance;
    const hasBothPlans = coachInstance && selfInstance;

    if (!hasAnyPlan) {
        return (
            <div className="max-w-6xl mx-auto px-4 py-8">
                <Card>
                    <div className="text-center py-12">
                        <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold mb-2">还没有训练计划</h3>
                        <p className="text-gray-600 mb-6">
                            您可以订阅教练获取专业计划，或者创建自己的训练计划
                        </p>
                        <div className="flex justify-center gap-4">
                            <Button
                                label="浏览教练"
                                icon="pi pi-search"
                                onClick={() => router.push('/coach/discovery')}
                            />
                            <Button
                                label="我的计划库"
                                icon="pi pi-list"
                                className="p-button-outlined"
                                onClick={() => router.push('/me/plan-lib')}
                            />
                        </div>
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
        {/* 确认对话框 */}
        <ConfirmDialog />
        
        {/* 计划完成弹窗 */}
        {completedPlanInfo && (
            <PlanCompletionModal
                visible={showCompletionModal}
                onHide={() => setShowCompletionModal(false)}
                planName={completedPlanInfo.name}
                completionRate={completedPlanInfo.rate}
                onUpdateProfile={handleUpdateProfile}
                onGenerateNextPlan={handleGenerateNextPlan}
                onViewHistory={handleViewHistory}
            />
        )}
        
        <div className="max-w-6xl mx-auto px-4 py-8">
            {/* --- 计划切换器（当同时有教练计划和自建计划时显示）--- */}
            {hasBothPlans && (
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6 w-fit">
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            planMode === 'coach'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                        onClick={() => setPlanMode('coach')}
                    >
                        <i className="pi pi-user mr-2" />
                        教练计划
                    </button>
                    <button
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            planMode === 'self'
                                ? 'bg-white text-slate-900 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                        onClick={() => setPlanMode('self')}
                    >
                        <i className="pi pi-star mr-2" />
                        我的计划
                    </button>
                </div>
            )}
            {/* --- 顶部教练信息卡片 (仅当有订阅且当前计划不是自建时显示，或者即使是自建也可以不显示教练卡片) --- */}
            {subscription?.coach && instance?.source !== 'self' && (
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

            {/* 自建计划顶部卡片 - 带移除按钮 */}
            {instance?.source === 'self' && (
                <div className="relative overflow-hidden bg-slate-900 rounded-3xl p-6 mb-8 text-white shadow-2xl shadow-slate-200">
                    {/* 背景装饰图形 */}
                    <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                    <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-pink-500/10 rounded-full blur-2xl"></div>

                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center space-x-5">
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-3">
                                    <span className="text-2xl font-black italic">
                                        ME
                                    </span>
                                </div>
                            </div>
                            
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider rounded">SELF PLAN</span>
                                    <span className="text-slate-400 text-xs font-medium italic">Your personal journey</span>
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight">
                                    {instance.name || '我的自建计划'}
                                </h2>
                                <p className="text-slate-400 text-sm font-medium">
                                    自我驱动，超越极限
                                </p>
                            </div>
                        </div>

                        {/* 移除计划按钮 */}
                        <div className="flex items-center gap-2">
                            <Button
                                icon="pi pi-trash"
                                className="p-button-text p-button-danger"
                                tooltip="移除此计划"
                                tooltipOptions={{ position: 'left' }}
                                onClick={confirmRemovePlan}
                            />
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
                                {todayCompleted 
                                    ? `✅ 今日训练已完成 · 下一个训练日: 第${todayDayIndex}天`
                                    : `训练日 ${todayDayIndex} · ${executionStatus === 'completed' ? '已完成' : '进行中'}`
                                }
                            </p>
                        </div>
                        <div className={`flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full ${
                            todayCompleted 
                                ? 'text-green-600 bg-green-50' 
                                : 'text-primary-600 bg-primary-50'
                        }`}>
                            <i className={todayCompleted ? 'pi pi-check' : 'pi pi-clock animate-spin-slow'} />
                            {todayCompleted ? 'Well Done!' : 'Keep Pushing'}
                        </div>
                    </div>

                    {/* 卡片渲染 */}
                    <div className="transform transition-all hover:translate-y-[-4px]">
                        {todayCompleted ? (
                            /* 今日已完成状态卡片 */
                            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-8 border border-green-100 shadow-sm">
                                <div className="text-center">
                                    <div className="text-6xl mb-4">🎉</div>
                                    <h3 className="text-2xl font-bold text-green-800 mb-2">今日训练已完成!</h3>
                                    <p className="text-green-600 mb-4">
                                        太棒了！你已经完成了今天的训练任务，好好休息，明天继续加油！
                                    </p>
                                    <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium">
                                        <i className="pi pi-calendar" />
                                        下一个训练日: 第 {todayDayIndex} 天
                                    </div>
                                </div>
                            </div>
                        ) : todayTraining && todayTraining.type === 'training' ? (
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
                        completionDates={completionDates}
                        todayCompleted={todayCompleted}
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
