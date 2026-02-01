'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { Info, Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useToastContext } from '@/context/ToastContext';
import { useGuideStore } from '@/stores/useGuideStore';

import TodayTrainingCard from './TodayTrainingCard';
import RestDayCard from './RestDayCard';
import BrowseSection from './BrowseSection';

import PlanCompletionModal from '@/components/plan/PlanCompletionModal';
import { Avatar } from 'primereact/avatar';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();
    const { startGuide } = useGuideStore();
    const hasShownReturnToastRef = useRef(false);

    // 教练分配的计划
    const [coachInstance, setCoachInstance] = useState<any>(null);
    const [coachActions, setCoachActions] = useState<Record<string, any>>({});
    const [coachDayIndex, setCoachDayIndex] = useState(1);
    const [coachTodayCompleted, setCoachTodayCompleted] = useState(false);
    const [coachCompletionDates, setCoachCompletionDates] = useState<Record<number, string>>({});
    const [coachExecutionsByDayIndex, setCoachExecutionsByDayIndex] = useState<Record<number, any>>({});

    // 自建计划
    const [selfInstance, setSelfInstance] = useState<any>(null);
    const [selfActions, setSelfActions] = useState<Record<string, any>>({});
    const [selfDayIndex, setSelfDayIndex] = useState(1);
    const [selfTodayCompleted, setSelfTodayCompleted] = useState(false);
    const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>({});
    const [selfExecutionsByDayIndex, setSelfExecutionsByDayIndex] = useState<Record<number, any>>({});

    // 当前显示模式: 'coach' | 'self'
    const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach');

    const [loading, setLoading] = useState(true);
    const [subscription, setSubscription] = useState<any>(null);
    // spec v1: missing days (unresolved days before recommended pointer)
    const [missingDays, setMissingDays] = useState<number[]>([]);
    const [executionStatus, setExecutionStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
    const [completedSets, setCompletedSets] = useState(0);
    const [totalSets, setTotalSets] = useState(0);

    // 计划完成弹窗状态
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completedPlanInfo, setCompletedPlanInfo] = useState<{ name: string, rate: number } | null>(null);
    const [showExplainDialog, setShowExplainDialog] = useState(false);

    // 当前激活的计划（根据 planMode 动态选择）
    const instance = planMode === 'coach' ? coachInstance : selfInstance;
    const actions = planMode === 'coach' ? coachActions : selfActions;
    const todayDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex;
    const todayCompleted = planMode === 'coach' ? coachTodayCompleted : selfTodayCompleted;
    const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates;
    const executionsByDayIndex = planMode === 'coach' ? coachExecutionsByDayIndex : selfExecutionsByDayIndex;

    const handleSkipDay = async (dayIndex: number) => {
        if (!instance?.id || !dayIndex) return;
        try {
            const res = await fetch('/api/execution/skip-day', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ instanceId: instance.id, dayIndex }),
            });
            const json = await res.json().catch(() => null);
            if (!res.ok || !json?.success) {
                throw new Error(json?.message || 'skip failed');
            }
            await loadData();
        } catch (e) {
            showToast({
                severity: 'error',
                summary: '操作失败',
                detail: '标记跳过失败，请稍后重试',
            });
        }
    };

    // Use executionsByDayIndex to drive current executionStatus (avoid cross-page inconsistency).
    useEffect(() => {
        if (!instance?.id) return;
        const exec = (executionsByDayIndex || {})[todayDayIndex];
        if (exec?.status) {
            setExecutionStatus(exec.status);
            setCompletedSets(Number(exec.completed_sets || 0));
            setTotalSets(Number(exec.total_sets || 0));
        } else {
            setExecutionStatus('none');
            setCompletedSets(0);
            setTotalSets(0);
        }
    }, [instance?.id, todayDayIndex, planMode, executionsByDayIndex]);

    useEffect(() => {
        if (session?.user?.id) {
            loadData();
        }
    }, [session?.user?.id]);

    // 完成训练回跳：强化“确认/校准/分享”的意义（只弹一次）
    useEffect(() => {
        if (hasShownReturnToastRef.current) return;
        const justConfirmed = searchParams?.get('justConfirmed');
        const diStr = searchParams?.get('dayIndex');
        const di = diStr ? Number(diStr) : null;
        if (justConfirmed === '1') {
            hasShownReturnToastRef.current = true;
            showToast({
                severity: 'success',
                summary: '已确认训练日',
                detail: di
                    ? `已确认第${di}天：记录/视频/备注会沉淀；输入的真实重量会帮助系统更新 e1RM，让下次自动算重量更准。`
                    : '本次训练已确认：记录会沉淀；输入的真实重量会帮助系统让下次自动算重量更准。',
            });

            // 清理 query，避免刷新重复弹出
            setTimeout(() => {
                router.replace('/today-training');
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    const loadData = async () => {
        try {
            setLoading(true);

            // 1. 获取订阅
            const subsResponse = await subscriptionService.getCoachSubscriptions({
                studentId: session?.user?.id || '',
                computePauseAwareEndDate: false,
            });

            const activeSubs = (subsResponse?.subscriptions || []).filter((s: any) => !!s?.id);

            // --- 1. 定义并行请求任务 ---
            // 将教练计划的探测逻辑与自建计划的获取逻辑放在同一个并行队列中
            const [coachPlanResults, selfPlanResult] = await Promise.allSettled([
                // 教练计划任务：如果是活跃订阅，则批量探测
                activeSubs.length > 0
                    ? Promise.allSettled(activeSubs.map((s: any) => planLibService.getInstance({ subscriptionId: s.id })))
                    : Promise.resolve([]),

                // 自建计划任务
                planLibService.getInstance({ fetchSelf: true })
            ]);

            // --- 2. 处理并行回填数据 ---
            let coachRes: any = null;
            let coachSub: any = null;
            let selfRes: any = null;

            // 解析教练计划逻辑 (从 allSettled 的第一个结果中提取)
            if (coachPlanResults.status === 'fulfilled' && Array.isArray(coachPlanResults.value)) {
                const settledSubTasks = coachPlanResults.value;
                for (let i = 0; i < settledSubTasks.length; i++) {
                    const r = settledSubTasks[i];
                    if (r.status === 'fulfilled' && r.value?.instance) {
                        coachRes = r.value;
                        coachSub = activeSubs[i];
                        break; // 找到第一个有内容的计划即停止
                    }
                }
            }

            // 解析自建计划逻辑 (从 allSettled 的第二个结果中提取)
            if (selfPlanResult.status === 'fulfilled') {
                selfRes = selfPlanResult.value;
            } else {
                console.error('[today-training] 自建计划加载失败:', selfPlanResult.reason);
                selfRes = null;
            }

            // 订阅信息用于顶部教练卡片/后续跳转：优先使用“有计划的订阅”，否则回退到第一个活跃订阅
            setSubscription(coachSub || activeSubs[0] || null);

            // 处理教练计划
            if (coachRes?.instance) {
                setCoachInstance(coachRes.instance);
                setCoachActions(coachRes.actions || {});

                const derived = coachRes as any;
                if (typeof (derived.recommendedDayIndex ?? derived.nextDayIndex) === 'number') {
                    setCoachDayIndex(derived.recommendedDayIndex ?? derived.nextDayIndex);
                    setCoachTodayCompleted(derived.todayCompleted || false);
                    setCoachCompletionDates(derived.completionDates || {});
                    setCoachExecutionsByDayIndex(derived.executionsByDayIndex || {});
                    setMissingDays(Array.isArray(derived.missingDays) ? derived.missingDays : []);

                    const completedCount = (derived.completedDays || []).length;
                    const totalCount = derived.totalTrainingDays || 0;
                    if (totalCount > 0 && completedCount >= totalCount && coachRes.instance.status === 'active') {
                        await handleCompletePlan(coachRes.instance);
                    }
                } else {
                    // fallback: legacy API
                    try {
                        const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${coachRes.instance.id}`);
                        const nextDayData = await nextDayRes.json();
                        if (nextDayData.success && nextDayData.data) {
                            setCoachDayIndex(nextDayData.data.nextDayIndex);
                            setCoachTodayCompleted(nextDayData.data.todayCompleted || false);
                            setCoachCompletionDates(nextDayData.data.completionDates || {});
                            setCoachExecutionsByDayIndex({});

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
            }

            // 处理自建计划
            if (selfRes?.instance) {
                setSelfInstance(selfRes.instance);
                setSelfActions(selfRes.actions || {});

                const derived = selfRes as any;
                if (typeof (derived.recommendedDayIndex ?? derived.nextDayIndex) === 'number') {
                    setSelfDayIndex(derived.recommendedDayIndex ?? derived.nextDayIndex);
                    setSelfTodayCompleted(derived.todayCompleted || false);
                    setSelfCompletionDates(derived.completionDates || {});
                    setSelfExecutionsByDayIndex(derived.executionsByDayIndex || {});
                    // if currently no coach plan, allow self plan missingDays to surface
                    if (!coachRes?.instance) {
                        setMissingDays(Array.isArray(derived.missingDays) ? derived.missingDays : []);
                    }

                    const completedCount = (derived.completedDays || []).length;
                    const totalCount = derived.totalTrainingDays || 0;
                    if (totalCount > 0 && completedCount >= totalCount && selfRes.instance.status === 'active') {
                        await handleCompletePlan(selfRes.instance);
                    }
                } else {
                    // fallback: legacy API
                    try {
                        const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${selfRes.instance.id}`);
                        const nextDayData = await nextDayRes.json();
                        if (nextDayData.success && nextDayData.data) {
                            setSelfDayIndex(nextDayData.data.nextDayIndex);
                            setSelfTodayCompleted(nextDayData.data.todayCompleted || false);
                            setSelfCompletionDates(nextDayData.data.completionDates || {});
                            setSelfExecutionsByDayIndex({});

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
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* 1. 教练卡片骨架：模拟大圆角硬件感 */}
                <div className="p-4 bg-surface border border-surface-100/50 rounded-2xl mb-8 shadow-sm">
                    <div className="flex items-center gap-4">
                        <Skeleton shape="circle" size="3.5rem" className="bg-surface-100/50" />
                        <div className="flex-1 space-y-2">
                            <Skeleton width="30%" height="1.25rem" className="bg-surface-100/50 rounded-lg" />
                            <Skeleton width="50%" height="0.75rem" className="bg-surface-100/50 rounded-lg" />
                        </div>
                    </div>
                </div>

                {/* 2. 标题区：保持紧凑型布局预占位 */}
                <div className="flex justify-between items-end mb-8 px-1">
                    <div className="space-y-2">
                        <Skeleton width="120px" height="2rem" className="bg-surface-200/30 rounded-lg" />
                        <Skeleton width="180px" height="0.75rem" className="bg-surface-100/50 rounded-lg" />
                    </div>
                    <Skeleton width="80px" height="2.5rem" className="bg-surface-100/50 rounded-xl" />
                </div>

                {/* 3. 主训练卡片：核心指标中心化布局预占位 */}
                <div className="bg-surface rounded-[2rem] p-8 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-surface-100/50">
                    <div className="flex flex-col sm:flex-row gap-6 mb-10">
                        {/* 模拟动作缩略图 */}
                        <Skeleton width="100px" height="100px" className="bg-surface-100/50 rounded-2xl shrink-0" />

                        <div className="flex-1 space-y-4 py-2">
                            {/* 模拟动作名称（Black/Bold 风格） */}
                            <Skeleton width="40%" height="1.75rem" className="bg-surface-200/40 rounded-lg" />
                            <div className="flex gap-2">
                                <Skeleton width="60px" height="1.25rem" className="bg-primary-50/50 rounded-full" />
                                <Skeleton width="80px" height="1.25rem" className="bg-surface-100/50 rounded-full" />
                            </div>
                        </div>
                    </div>

                    {/* 4. 核心指标网格：3列等高预占 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-6 rounded-2xl bg-surface-50/50 border border-surface-100/30 flex flex-col items-center gap-3">
                                <Skeleton width="40px" height="0.75rem" className="bg-surface-200/30 rounded" />
                                <Skeleton width="60%" height="1.5rem" className="bg-surface-200/50 rounded-lg" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 微弱的周期性动画：Aero-Productivity 风格不需要剧烈的闪烁 */}
                <style jsx global>{`
                .p-skeleton::after {
                    background: linear-gradient(90deg, 
                        rgba(var(--surface-100-rgb), 0), 
                        rgba(var(--surface-200-rgb), 0.3), 
                        rgba(var(--surface-100-rgb), 0)
                    ) !important;
                }
            `}</style>
            </div>
        );
    }

    // 判断是否有任何计划
    const hasAnyPlan = coachInstance || selfInstance;
    const hasBothPlans = coachInstance && selfInstance;

    if (!hasAnyPlan) {
        const subscribedCoachName =
            subscription?.coach?.name ||
            subscription?.coach?.title ||
            subscription?.coach_id ||
            '';
        const hasActiveSubscription = !!subscription?.id;

        // 有订阅但暂无计划：展示“教练制定中”的等待页
        if (hasActiveSubscription) {
            return (
                <div className="max-w-6xl mx-auto px-6 py-12 animate-in fade-in duration-700">
                    <Card className="rounded-2xl bg-transparent shadow-none overflow-hidden border border-surface-100/50">
                        <div className="text-center py-16 px-4">
                            <div className="relative inline-block mb-6">
                                <div className="absolute inset-0 animate-ping opacity-20 bg-primary-400 rounded-full" />
                                <div className="relative bg-surface-50 p-6 rounded-full border border-surface-100/50">
                                    <Target className="w-10 h-10 text-primary-500 stroke-[1.5]" />
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold tracking-tight text-surface-900 mb-3">
                                计划正在制定中
                            </h3>
                            <p className="text-surface-500 max-w-sm mx-auto mb-10 leading-relaxed text-balance">
                                {subscribedCoachName
                                    ? `您的教练「${subscribedCoachName}」正在为您制定训练计划，请耐心等待。`
                                    : '您的教练正在为您制定训练计划，请耐心等待。'}
                            </p>

                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                <Button
                                    label="联系教练"
                                    icon="pi pi-comments"
                                    onClick={() => {
                                        // messages page supports deep link via coachId (coaches.id)
                                        if (subscription?.coach_id) {
                                            router.push(`/messages?coachId=${subscription.coach_id}`);
                                        } else {
                                            router.push('/messages');
                                        }
                                    }}
                                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                />
                                <Button
                                    label="我的计划库"
                                    icon="pi pi-bookmark"
                                    onClick={() => router.push('/me/plan-lib')}
                                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                                />
                            </div>
                        </div>
                    </Card>
                </div>
            );
        }

        return (
            <div className="max-w-6xl mx-auto px-6 py-12 animate-in fade-in duration-700">
                {/* 1. 容器与深度：使用 surface 背景与极浅边框，摒弃阴影 */}
                <Card className="rounded-2xl bg-transparent shadow-none overflow-hidden border border-surface-100/50">
                    <div className="text-center py-16 px-4">

                        {/* 2. 状态动效：利用微弱的周期性动效引导注意力 */}
                        <div className="relative inline-block mb-6">
                            <div className="absolute inset-0 animate-ping opacity-20 bg-primary-400 rounded-full" />
                            <div className="relative bg-surface-50 p-6 rounded-full border border-surface-100">
                                <Target className="w-10 h-10 text-surface-400 stroke-[1.5]" />
                            </div>
                        </div>

                        {/* 3. 内容排版：紧凑字间距与色彩层次 */}
                        <h3 className="text-2xl font-bold tracking-tight text-surface-900 mb-3">
                            开启您的训练旅程
                        </h3>
                        <p className="text-surface-500 max-w-sm mx-auto mb-10 leading-relaxed text-balance">
                            您可以订阅教练获取专业计划，或者在您的私人库中创建专属训练
                        </p>

                        {/* 4. 状态反馈：物理缩放与强调色联动 */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                            <Button
                                label="浏览教练"
                                icon="pi pi-compass"
                                onClick={() => router.push('/coach/discovery')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                            />
                            <Button
                                label="我的计划库"
                                icon="pi pi-bookmark"
                                onClick={() => router.push('/me/plan-lib')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                            />
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    // -----------------------------
    // 日历日（包含休息日）：
    // 以“最近一次 resolved（completed/abandoned）训练日”的完成日期为锚点，按自然天数顺延 dayIndex，
    // 这样当昨天完成 day10 时，今天自然落在 day11（休息），明天落在 day12（训练）。
    // -----------------------------
    const trainingDays = (instance.training_days || []) as any[];

    const formatShortDate = (ts?: string | null) => {
        if (!ts) return '';
        const dt = new Date(ts);
        return dt.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
    };

    const calendarDayIndex = (() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const execs = executionsByDayIndex || {};
        const resolved = Object.values(execs).filter((e: any) =>
            (e?.status === 'completed' || e?.status === 'abandoned') && (e?.completed_at || e?.started_at)
        ) as any[];

        if (resolved.length > 0) {
            const maxResolved = Math.max(...resolved.map((e) => Number(e?.day_index ?? 0)).filter(Boolean));
            const anchorExec = (execs as any)[maxResolved];
            const anchorTs = anchorExec?.completed_at || anchorExec?.started_at;
            if (anchorTs) {
                const anchor = new Date(anchorTs);
                anchor.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today.getTime() - anchor.getTime()) / (24 * 60 * 60 * 1000));
                return Math.max(1, Math.min(trainingDays.length || 1, maxResolved + diffDays));
            }
        }

        // fallback：当没有任何执行记录时，best-effort 用 start_date (或订阅 start_date) 作为计划日历锚点
        const effectiveStart = (instance as any).start_date || subscription?.start_date;
        if (effectiveStart) {
            const start = new Date(effectiveStart);
            start.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
            return Math.max(1, Math.min(trainingDays.length || 1, 1 + diffDays));
        }

        // 再 fallback：保持与进度指针一致
        return todayDayIndex;
    })();

    // -----------------------------
    // 今日推进日（progress day）：
    // - 休息日：按自然日顺延（calendarDayIndex）
    // - 到达推荐训练日（todayDayIndex）后：若未确认（completed/abandoned），则指针停住
    // 口径：progressDayIndex = min(calendarDayIndex, todayDayIndex)
    // -----------------------------
    const progressDayIndex = Math.min(calendarDayIndex, todayDayIndex);
    const progressDay = trainingDays.find(d => d.dayIndex === progressDayIndex);
    const progressExec = (executionsByDayIndex || {})[progressDayIndex];
    const progressExecutionStatus: 'none' | 'in_progress' | 'completed' =
        progressExec?.status === 'completed'
            ? 'completed'
            : progressExec?.status === 'in_progress'
                ? 'in_progress'
                : 'none';

    const inProgressExec = (() => {
        const execs = Object.values(executionsByDayIndex || {}) as any[];
        const inps = execs.filter(e => e?.status === 'in_progress' && Number(e?.day_index ?? 0) > 0);
        if (inps.length === 0) return null;
        inps.sort((a, b) => {
            const at = a?.started_at ? new Date(a.started_at).getTime() : 0;
            const bt = b?.started_at ? new Date(b.started_at).getTime() : 0;
            return bt - at;
        });
        return inps[0];
    })();

    return (
        <div className="min-h-screen bg-surface pb-12">
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

            <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-6 md:py-8">
                {/* --- 计划切换器（当同时有教练计划和自建计划时显示）--- */}
                {hasBothPlans && (
                    <div className="grid grid-cols-2 gap-2 p-1 bg-surface-50 rounded-2xl mb-6 w-full sm:w-fit border border-surface-100/50">
                        <button
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${planMode === 'coach'
                                ? 'bg-surface text-surface-900 shadow-sm'
                                : 'text-surface-500 hover:text-surface-700'
                                }`}
                            onClick={() => setPlanMode('coach')}
                        >
                            <i className="pi pi-user mr-2" />
                            教练计划
                        </button>
                        <button
                            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] ${planMode === 'self'
                                ? 'bg-surface text-surface-900 shadow-sm'
                                : 'text-surface-500 hover:text-surface-700'
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
                    <div className="relative overflow-hidden bg-surface-900 rounded-2xl p-6 mb-8 text-surface border border-surface-100/50">
                        {/* 背景装饰图形 */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center space-x-5">
                                <div className="relative">
                                    <Avatar
                                        label={subscription.coach.name?.charAt(0) || 'C'}
                                        image={subscription.coach.avatar_url}
                                        shape="circle"
                                        className="w-16 h-16 bg-surface text-primary-500 font-bold"
                                    ></Avatar>
                                    {/* 在线状态点 */}
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-4 border-slate-900 rounded-full"></div>
                                </div>

                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="px-2 py-0.5 bg-primary-500/20 text-primary-300 text-[10px] font-bold uppercase tracking-wider rounded">专业教练</span>
                                        <span className="text-surface-400 text-xs font-medium italic">为你定制训练路径</span>
                                    </div>
                                    <h2 className="text-2xl text-surface font-bold tracking-tight">
                                        {subscription.coach.name || '未知教练'}
                                    </h2>
                                    <p className="text-surface-400 text-sm font-medium">
                                        {subscription.coach.title || '资深健身专家'}
                                    </p>
                                </div>
                            </div>

                            <div className="hidden md:block text-right border-l border-surface/10 pl-8">
                                <div className="text-surface-400 text-xs uppercase mb-1 tracking-wider">训练累计</div>
                                <div className="text-xl font-mono font-bold tracking-tight">128 <span className="text-sm font-normal text-surface-500">天</span></div>
                            </div>
                        </div>
                    </div>

                )}

                {/* 自建计划顶部卡片 - 带移除按钮 */}
                {instance?.source === 'self' && (
                    <div className="relative overflow-hidden bg-surface-900 rounded-2xl p-6 mb-8 text-surface border border-surface-100/50">
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
                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold uppercase tracking-wider rounded">自建计划</span>
                                        <span className="text-surface-400 text-xs font-medium italic">你的专属旅程</span>
                                    </div>
                                    <h2 className="text-2xl font-bold tracking-tight text-surface">
                                        {instance.name || '我的自建计划'}
                                    </h2>
                                    <p className="text-surface-400 text-sm font-medium">
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
                <div className="space-y-6 sm:space-y-8 md:space-y-10">
                    {/* 今日模块标题层 */}
                    <section>
                        <div className="flex items-end justify-between mb-6 px-2">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black text-surface-900 tracking-tight">
                                    今日任务
                                </h3>
                                <p id="guide-today-progress" className="text-surface-500 text-sm flex items-center gap-2">
                                    <span>
                                        今日推进：第{progressDayIndex}天 · {progressDay?.type === 'rest' ? '休息日' : '训练日'}
                                    </span>
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-surface-100 transition-all active:scale-[0.98]"
                                        onClick={() => setShowExplainDialog(true)}
                                        title="为什么要点完成？为什么要输入重量？"
                                    >
                                        <Info className="w-4 h-4 text-surface-500" />
                                    </button>
                                    {progressExecutionStatus === 'in_progress' && progressExec?.started_at ? `（开始于 ${formatShortDate(progressExec.started_at)}）` : ''}
                                    {progressExecutionStatus === 'completed' && progressExec?.completed_at ? `（完成于 ${formatShortDate(progressExec.completed_at)}）` : ''}
                                </p>
                            </div>
                            <div className={`hidden sm:flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full tracking-tight ${todayCompleted
                                ? 'text-green-600 bg-green-50'
                                : 'text-primary-600 bg-primary-50'
                                }`}>
                                <i className={todayCompleted ? 'pi pi-check' : 'pi pi-clock animate-spin-slow'} />
                                {todayCompleted ? '已完成' : '进行中'}
                            </div>
                        </div>

                        {/* 卡片渲染
                            统一口径：这里始终展示 “下一次需要做的训练日（nextDayIndex）” 的卡片。
                            即使你今天完成过其它训练日，也不要用一个“今日已完成”卡片把未完成的训练日盖掉，避免混乱。
                        */}
                        <div className="transform transition-all sm:hover:translate-y-[-4px]">
                            <div id="guide-missing-days">
                                {missingDays.length > 0 && (
                                    <div className="mb-4 rounded-2xl border border-amber-100/50 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                            <div>
                                                ⚠️ 你有 <b>{missingDays.length}</b> 天训练日未确认/未完成（允许跳过，不会影响今日推荐）。
                                                <span className="ml-2 text-xs text-amber-800/80">
                                                    跳过=确认推进（会标记为跳过，教练可见）；补练=补齐缺口。
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {missingDays.slice(0, 3).map((di) => (
                                                    <div key={di} className="flex items-center gap-1.5">
                                                        <button
                                                            className="px-2 py-1 rounded-xl bg-surface border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-50 transition-all active:scale-[0.98]"
                                                            onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${di}&focus=weight`)}
                                                            title="补练：输入真实重量/次数会帮助系统校准推荐"
                                                        >
                                                            去补练 第{di}天
                                                        </button>
                                                        <button
                                                            className="px-2 py-1 rounded-xl bg-surface-900 text-surface text-xs font-semibold hover:bg-surface-700 transition-all active:scale-[0.98]"
                                                            onClick={() => handleSkipDay(di)}
                                                            title="跳过也算确认：会推进到下一天，但会标记为跳过（教练可见）"
                                                        >
                                                            跳过
                                                        </button>
                                                    </div>
                                                ))}
                                                {missingDays.length > 3 && (
                                                    <span className="text-xs text-amber-700">…</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {todayCompleted && (
                                    <div className="mb-4 rounded-2xl border border-green-100/50 bg-green-50 px-4 py-3 text-green-800 text-sm">
                                        ✅ 你今天已经完成过训练了；如果仍有未完成训练日，系统会继续引导你补做。
                                        <span className="ml-2 text-xs text-green-800/80">
                                            完成训练后可分享打卡；输入的真实重量会帮助系统让下次自动算更准。
                                        </span>
                                    </div>
                                )}
                            </div>
                            {progressDay && progressDay.type === 'training' ? (
                                <TodayTrainingCard
                                    day={progressDay}
                                    actions={actions}
                                    instanceId={instance.id}
                                    dayIndex={progressDayIndex}
                                    executionStatus={progressExecutionStatus}
                                    completedSets={Number(progressExec?.completed_sets || 0)}
                                    totalSets={Number(progressExec?.total_sets || 0)}
                                />
                            ) : (
                                <RestDayCard dayIndex={progressDayIndex} />
                            )}

                            {progressDay?.type === 'rest' && inProgressExec && (
                                <div className="mt-4 rounded-2xl border border-amber-100/50 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                                    你有进行中的训练：第{inProgressExec.day_index}天（开始于 {formatShortDate(inProgressExec.started_at)}）。
                                    <button
                                        className="ml-2 underline font-semibold transition-all active:scale-[0.98]"
                                        onClick={() => router.push(`/training-execution/${instance.id}?dayIndex=${inProgressExec.day_index}`)}
                                    >
                                        继续训练
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* --- 浏览区域 --- */}
                    <section className="pt-2 sm:pt-4">
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <div className="h-px flex-1 bg-surface-100"></div>
                            <h4 className="text-surface-400 text-xs font-bold uppercase tracking-widest">
                                浏览计划
                            </h4>
                            <div className="h-px flex-1 bg-surface-100"></div>
                        </div>

                        <BrowseSection
                            instance={instance}
                            actions={actions}
                            currentDayIndex={todayDayIndex}
                            todayExecutionStatus={executionStatus}
                            completionDates={completionDates}
                            executionsByDayIndex={executionsByDayIndex}
                            todayCompleted={todayCompleted}
                            initialSelectedDayIndex={progressDayIndex}
                            progressDayIndex={progressDayIndex}
                            effectiveStartDate={instance.start_date || subscription?.start_date}
                        />
                    </section>
                </div>
            </div>

            <Dialog
                header="为什么要点完成？为什么要输入重量？"
                visible={showExplainDialog}
                onHide={() => setShowExplainDialog(false)}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,680px)]"
            >
                <div className="space-y-4 text-sm text-surface-700 leading-relaxed">
                    <div className="space-y-2">
                        <div className="font-bold text-surface-900">1) 今日推进规则</div>
                        <div>休息日会自动顺延；到训练日会停住，直到你完成/跳过（避免因为延迟执行而“看起来进度被推走”）。</div>
                    </div>
                    <div className="space-y-2">
                        <div className="font-bold text-surface-900">2) 输入真实重量/次数的意义（不止是记录）</div>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>当次训练内：你输入的真实重量会让后续组推荐联动更贴合。</li>
                            <li>跨天/下次训练：系统会用你的输入更新 e1RM（估算极限），下次自动算重量会更准。</li>
                        </ul>
                    </div>
                    <div className="space-y-2">
                        <div className="font-bold text-surface-900">3) 完成/分享打卡</div>
                        <div>完成会沉淀训练记录/视频/备注，方便复盘与给教练看；也支持一键分享打卡。</div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2">
                        <Button
                            label="查看引导"
                            severity="secondary"
                            outlined
                            onClick={() => {
                                setShowExplainDialog(false);
                                startGuide('STUDENT_TODAY_TRAINING_PROGRESS_GUIDE', true);
                            }}
                        />
                        <Button
                            label="去输入并校准"
                            severity="success"
                            onClick={() => {
                                setShowExplainDialog(false);
                                if (!instance?.id) return;
                                router.push(`/training-execution/${instance.id}?dayIndex=${todayDayIndex}&focus=weight`);
                            }}
                        />
                        <Button
                            label="我知道了"
                            onClick={() => setShowExplainDialog(false)}
                        />
                    </div>
                </div>
            </Dialog>

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
