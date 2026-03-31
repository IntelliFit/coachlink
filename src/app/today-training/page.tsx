'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Info, Target } from 'lucide-react';

import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { executionService } from '@/app/service/executionService';
import { useToastContext } from '@/context/ToastContext';
import { useGuideStore } from '@/stores/useGuideStore';

import TodayTrainingCard from './TodayTrainingCard';
import RestDayCard from './RestDayCard';
import BrowseSection from './BrowseSection';
import LightweightTaskSheet from './components/LightweightTaskSheet';
import ActionPicker from './ActionPicker';
import {
    buildPlanScheduleModel,
    buildDayModuleModel,
    formatPlanDayLabel,
    resolvePlanDayDate,
    type NormalizedDayTask,
} from './lib/dayModules';

import PlanCompletionModal from '@/components/plan/PlanCompletionModal';
import DayCheckinShareGenerator from '@/components/share/DayCheckinShareGenerator';
import { Avatar } from 'primereact/avatar';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import {
    formatBeijingDate,
} from '@/lib/beijingTime';

const TodayTrainingPage: React.FC = () => {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();
    const { startGuide } = useGuideStore();
    const hasShownReturnToastRef = useRef(false);

    // 教练分配的计划（多订阅支持）
    const [coachSubscriptions, setCoachSubscriptions] = useState<any[]>([]);
    const [activeCoachSubscriptionId, setActiveCoachSubscriptionId] = useState<string | null>(null);
    const [coachPlanDataBySubId, setCoachPlanDataBySubId] = useState<Record<string, any>>({});

    // 自建计划
    const [selfInstance, setSelfInstance] = useState<any>(null);
    const [selfActions, setSelfActions] = useState<Record<string, any>>({});
    const [selfDayIndex, setSelfDayIndex] = useState(1);
    const [selfTodayCompleted, setSelfTodayCompleted] = useState(false);
    const [selfCompletionDates, setSelfCompletionDates] = useState<Record<number, string>>({});
    const [selfExecutionsByDayIndex, setSelfExecutionsByDayIndex] = useState<Record<number, any>>({});
    const [selfMissingDays, setSelfMissingDays] = useState<number[]>([]);

    // 当前显示模式: 'coach' | 'self'
    const [planMode, setPlanMode] = useState<'coach' | 'self'>('coach');

    const [loading, setLoading] = useState(true);
    // spec v1: missing days (unresolved days before recommended pointer)
    const [executionStatus, setExecutionStatus] = useState<'none' | 'in_progress' | 'completed'>('none');
    const [completedSets, setCompletedSets] = useState(0);
    const [totalSets, setTotalSets] = useState(0);

    // 计划完成弹窗状态
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [completedPlanInfo, setCompletedPlanInfo] = useState<{ name: string, rate: number } | null>(null);
    const [showExplainDialog, setShowExplainDialog] = useState(false);
    const [quickFinishLoading, setQuickFinishLoading] = useState(false);
    const [selectedDayIndex, setSelectedDayIndex] = useState(1);
    const [activeLightweightTask, setActiveLightweightTask] = useState<NormalizedDayTask | null>(null);
    const [lightweightSheetVisible, setLightweightSheetVisible] = useState(false);
    const [lightweightPickerVisible, setLightweightPickerVisible] = useState(false);
    const [addingLightweightTask, setAddingLightweightTask] = useState(false);
    const [pendingLightweightAction, setPendingLightweightAction] = useState<any | null>(null);
    const [lightweightConfigVisible, setLightweightConfigVisible] = useState(false);
    const [dayShareVisible, setDayShareVisible] = useState(false);
    const [newTaskSuggestedTime, setNewTaskSuggestedTime] = useState('');
    const [newTaskNotes, setNewTaskNotes] = useState('');
    const [newDietContent, setNewDietContent] = useState('');
    const [newCardioDistanceKm, setNewCardioDistanceKm] = useState<number | null>(null);
    const [newCardioDurationMin, setNewCardioDurationMin] = useState<number | null>(null);
    const [newCardioPace, setNewCardioPace] = useState('');
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitTargetDurationMin, setNewHabitTargetDurationMin] = useState<number | null>(null);

    const activeSubscription =
        coachSubscriptions.find((s) => s.id === activeCoachSubscriptionId) ||
        coachSubscriptions[0] ||
        null;
    const activeCoachPlan = activeCoachSubscriptionId ? coachPlanDataBySubId[activeCoachSubscriptionId] : null;
    const coachInstance = activeCoachPlan?.instance ?? null;
    const coachActions = activeCoachPlan?.actions ?? {};
    const coachDayIndex = activeCoachPlan?.dayIndex ?? 1;
    const coachTodayCompleted = activeCoachPlan?.todayCompleted ?? false;
    const coachCompletionDates = activeCoachPlan?.completionDates ?? {};
    const coachExecutionsByDayIndex = activeCoachPlan?.executionsByDayIndex ?? {};
    const coachMissingDays = activeCoachPlan?.missingDays ?? [];

    // 当前激活的计划（根据 planMode 动态选择）
    const instance = planMode === 'coach' ? coachInstance : selfInstance;
    const actions = planMode === 'coach' ? coachActions : selfActions;
    const todayDayIndex = planMode === 'coach' ? coachDayIndex : selfDayIndex;
    const todayCompleted = planMode === 'coach' ? coachTodayCompleted : selfTodayCompleted;
    const completionDates = planMode === 'coach' ? coachCompletionDates : selfCompletionDates;
    const executionsByDayIndex = planMode === 'coach' ? coachExecutionsByDayIndex : selfExecutionsByDayIndex;
    const missingDays = planMode === 'coach' ? coachMissingDays : selfMissingDays;

    // 日历日（包含休息日）：必须在所有 early return 之前计算，保证 Hooks 顺序一致
    const trainingDays = (instance?.training_days || []) as any[];
    const formatShortDate = (ts?: string | null) => {
        if (!ts) return '';
        return formatBeijingDate(ts, 'zh-CN', { month: 'numeric', day: 'numeric' });
    };
    // 今日训练页必须以 recommendedDayIndex 为主口径：
    // 休息日会自动顺延到下一训练日，不能再用“计划日历上的今天”覆盖默认展示，
    // 否则会出现“教练计划还在，但学员默认看到休息日，误以为训练没了”的问题。
    const progressDayIndex = todayDayIndex;
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

    useEffect(() => {
        if (!instance?.id) return;
        setSelectedDayIndex(progressDayIndex);
    }, [instance?.id, progressDayIndex]);

    const selectedDay = trainingDays.find((day) => day.dayIndex === selectedDayIndex) || progressDay;
    const selectedExec = (executionsByDayIndex || {})[selectedDayIndex];
    const selectedExecutionStatus: 'none' | 'in_progress' | 'completed' =
        selectedExec?.status === 'completed'
            ? 'completed'
            : selectedExec?.status === 'in_progress'
                ? 'in_progress'
                : 'none';
    const selectedModuleModel = useMemo(() => {
        return buildDayModuleModel({
            day: selectedDay,
            actions,
            execution: selectedExec,
            executionStatus: selectedExecutionStatus,
        });
    }, [selectedDay, actions, selectedExec, selectedExecutionStatus]);
    const selectedTaskSummary = useMemo(() => {
        return {
            totalModules: selectedModuleModel.moduleCount,
            completedModules: selectedModuleModel.completedModuleCount,
            remainingModules: selectedModuleModel.remainingModuleCount,
            strengthModuleCount: selectedModuleModel.strengthTasks.length > 0 ? 1 : 0,
            lightweightCount: selectedModuleModel.lightweightTasks.length,
            trainingCompleted: selectedModuleModel.trainingCompleted,
            trainingInProgress: selectedModuleModel.trainingInProgress,
            dayCompleted: selectedModuleModel.dayCompleted,
        };
    }, [selectedModuleModel]);
    const effectiveCalendarStartDate = instance?.start_date || activeSubscription?.start_date || null;
    const scheduleModel = useMemo(() => {
        return buildPlanScheduleModel({
            trainingDays,
            executionsByDayIndex,
            effectiveStartDate: effectiveCalendarStartDate,
            progressDayIndex,
            fallbackAnchorDayIndex: progressDayIndex,
        });
    }, [trainingDays, executionsByDayIndex, effectiveCalendarStartDate, progressDayIndex]);
    const selectedSchedule = scheduleModel.scheduleByDayIndex.get(selectedDayIndex);
    const selectedDateLabel = useMemo(() => {
        if (!selectedDayIndex) return '';
        const selectedDate = selectedSchedule?.displayDate || resolvePlanDayDate({
            dayIndex: selectedDayIndex,
            effectiveStartDate: effectiveCalendarStartDate,
            fallbackAnchorDayIndex: progressDayIndex,
        });
        return formatPlanDayLabel(selectedDate);
    }, [selectedDayIndex, selectedSchedule?.displayDate, effectiveCalendarStartDate, progressDayIndex]);
    const selectedDateMeta = useMemo(() => {
        if (!selectedSchedule || selectedSchedule.totalDelayDays <= 0) return null;
        return {
            delayDays: selectedSchedule.totalDelayDays,
            originalDateLabel: formatPlanDayLabel(selectedSchedule.baselineDate),
        };
    }, [selectedSchedule]);
    const selectedExecutionDateNote = useMemo(() => {
        if (selectedExecutionStatus === 'in_progress' && selectedExec?.started_at) {
            const startedLabel = formatShortDate(selectedExec.started_at);
            if (selectedDateMeta?.delayDays && selectedDateLabel) {
                return `（首次开始于 ${startedLabel}，当前已顺延到 ${selectedDateLabel}）`;
            }
            return `（开始于 ${startedLabel}）`;
        }
        if (selectedExecutionStatus === 'completed' && selectedExec?.completed_at) {
            return `（完成于 ${formatShortDate(selectedExec.completed_at)}）`;
        }
        return '';
    }, [selectedExecutionStatus, selectedExec?.started_at, selectedExec?.completed_at, selectedDateMeta?.delayDays, selectedDateLabel]);
    const selectedHasLightweightTasks = selectedModuleModel.lightweightTasks.length > 0;
    const selectedTrainingStatusLabel = selectedTaskSummary.strengthModuleCount === 0
        ? '今日无力量训练'
        : selectedTaskSummary.trainingCompleted
            ? '已完成'
            : selectedTaskSummary.trainingInProgress
                ? '进行中'
                : '待开始';
    const selectedDayStatusLabel = selectedTaskSummary.totalModules === 0
        ? '暂无任务'
        : selectedTaskSummary.dayCompleted
            ? '已打卡完成'
            : `${selectedTaskSummary.completedModules}/${selectedTaskSummary.totalModules} 模块`;
    const canShareDayCheckin = selectedDay?.type === 'training' && selectedTaskSummary.totalModules > 0;
    const dayShareData = useMemo(() => {
        if (!selectedDay || selectedDay.type !== 'training' || !canShareDayCheckin) {
            return null;
        }

        return {
            dateLabel: selectedDateLabel || formatPlanDayLabel(resolvePlanDayDate({
                dayIndex: selectedDayIndex,
                effectiveStartDate: effectiveCalendarStartDate,
                fallbackAnchorDayIndex: progressDayIndex,
            })),
            planName: instance?.name || '今日安排',
            nickname: String(session?.user?.name || session?.user?.email || 'CoachLink 学员'),
            avatarUrl: null,
            completedAt: selectedExec?.completed_at || null,
            dayIndex: selectedDayIndex,
            moduleCount: selectedTaskSummary.totalModules,
            completedModuleCount: selectedTaskSummary.completedModules,
            lightweightCompletedCount: selectedModuleModel.lightweightCompletedCount,
            lightweightTotalCount: selectedModuleModel.lightweightTasks.length,
            trainingCompleted: selectedTaskSummary.trainingCompleted,
            strengthTaskCount: selectedModuleModel.strengthTasks.length,
            strengthCompletedSetCount: selectedModuleModel.strengthCompletedSetCount,
            strengthTotalSetCount: selectedModuleModel.strengthTotalSetCount,
        };
    }, [
        canShareDayCheckin,
        effectiveCalendarStartDate,
        instance?.name,
        progressDayIndex,
        selectedDateLabel,
        selectedDay,
        selectedDayIndex,
        selectedExec?.completed_at,
        selectedModuleModel.lightweightCompletedCount,
        selectedModuleModel.lightweightTasks.length,
        selectedModuleModel.strengthCompletedSetCount,
        selectedModuleModel.strengthTasks.length,
        selectedModuleModel.strengthTotalSetCount,
        selectedTaskSummary.completedModules,
        selectedTaskSummary.totalModules,
        selectedTaskSummary.trainingCompleted,
        session?.user?.email,
        session?.user?.name,
    ]);

    const handleOpenLightweightTask = (task: NormalizedDayTask) => {
        setActiveLightweightTask(task);
        setLightweightSheetVisible(true);
    };

    const handleLightweightTaskCompleted = async () => {
        await loadData();
    };

    const handleDeleteLightweightTask = (task: NormalizedDayTask) => {
        if (!selectedExec?.id || !task.isStudentExtra) return;

        confirmDialog({
            message: `确认删除轻任务「${task.title}」吗？删除后将移除该任务及其记录。`,
            header: '删除轻任务',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: addingLightweightTask ? '处理中...' : '确认删除',
            rejectLabel: '取消',
            acceptClassName: 'p-button-danger',
            accept: async () => {
                try {
                    setAddingLightweightTask(true);
                    const res = await executionService.deleteExtraExercise({
                        executionId: selectedExec.id,
                        actionIndex: task.executionIndex,
                    });

                    if (!res) {
                        throw new Error('删除失败');
                    }

                    showToast({
                        severity: 'success',
                        summary: '已删除',
                        detail: `${task.title} 已移除`,
                    });
                    await loadData();
                } catch (error: any) {
                    showToast({
                        severity: 'error',
                        summary: '删除失败',
                        detail: error?.message || '请稍后重试',
                    });
                } finally {
                    setAddingLightweightTask(false);
                }
            },
        });
    };

    const handleOpenLightweightPicker = () => {
        setLightweightPickerVisible(true);
    };

    const handleSelectLightweightAction = (action: any) => {
        const actionType = String(action?.type || '').toUpperCase();
        const attrs = action?.attrs || {};
        const customData = attrs?.custom_data || {};

        setPendingLightweightAction(action);
        setNewTaskSuggestedTime(String(attrs?.suggested_time || '').trim());
        setNewTaskNotes(String(attrs?.note || '').trim());
        setNewDietContent(actionType === 'DIET' ? String(customData?.content || '').trim() : '');
        setNewCardioDistanceKm(
            actionType === 'CARDIO' && customData?.distance
                ? Number(customData.distance) / 1000
                : null,
        );
        setNewCardioDurationMin(
            actionType === 'CARDIO' && customData?.duration
                ? Math.round(Number(customData.duration) / 60)
                : null,
        );
        setNewCardioPace(actionType === 'CARDIO' ? String(customData?.pace || '').trim() : '');
        setNewHabitName(actionType === 'HABIT' ? String(customData?.habit_name || action?.name || '').trim() : '');
        setNewHabitTargetDurationMin(
            actionType === 'HABIT' && customData?.target_duration
                ? Number(customData.target_duration)
                : null,
        );
        setLightweightPickerVisible(false);
        setLightweightConfigVisible(true);
    };

    const handleAddLightweightTask = async () => {
        if (!instance?.id || !selectedDayIndex || addingLightweightTask) return;
        if (!pendingLightweightAction) return;

        try {
            setAddingLightweightTask(true);

            let executionId = selectedExec?.id as string | undefined;
            if (!executionId) {
                const startRes = await executionService.startExecution({
                    instanceId: instance.id,
                    dayIndex: selectedDayIndex,
                });
                executionId = startRes?.data?.id;
            }

            if (!executionId) {
                throw new Error('无法创建当天执行记录');
            }

            const addRes = await executionService.addExtraExercise({
                executionId,
                actionId: pendingLightweightAction.id,
                actionName: pendingLightweightAction.name,
                sets: [{ weight: null, reps: null }],
                suggestedTime: newTaskSuggestedTime.trim() || undefined,
                notes: newTaskNotes.trim() || undefined,
                customData: (() => {
                    const actionType = String(pendingLightweightAction?.type || '').toUpperCase();
                    if (actionType === 'DIET') {
                        return {
                            content: newDietContent.trim() || undefined,
                        };
                    }
                    if (actionType === 'CARDIO') {
                        return {
                            distance: newCardioDistanceKm ? Math.round(newCardioDistanceKm * 1000) : undefined,
                            duration: newCardioDurationMin ? Math.round(newCardioDurationMin * 60) : undefined,
                            pace: newCardioPace.trim() || undefined,
                        };
                    }
                    if (actionType === 'HABIT') {
                        return {
                            habit_name: newHabitName.trim() || pendingLightweightAction.name,
                            target_duration: newHabitTargetDurationMin || undefined,
                        };
                    }
                    return {};
                })(),
            });

            if (!addRes) {
                throw new Error('新增轻任务失败');
            }

            showToast({
                severity: 'success',
                summary: '已新增',
                detail: `${pendingLightweightAction.name} 已加入第${selectedDayIndex}天`,
            });

            setLightweightConfigVisible(false);
            setPendingLightweightAction(null);
            await loadData();
        } catch (error: any) {
            showToast({
                severity: 'error',
                summary: '新增失败',
                detail: error?.message || '请稍后重试',
            });
        } finally {
            setAddingLightweightTask(false);
        }
    };

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
            });

            const activeSubs = (subsResponse?.subscriptions || []).filter((s: any) => !!s?.id);
            setCoachSubscriptions(activeSubs);

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
            let selfRes: any = null;
            const coachPlanData: Record<string, any> = {};

            // 解析教练计划逻辑 (从 allSettled 的第一个结果中提取)
            if (coachPlanResults.status === 'fulfilled' && Array.isArray(coachPlanResults.value)) {
                const settledSubTasks = coachPlanResults.value;
                for (let i = 0; i < settledSubTasks.length; i++) {
                    const sub = activeSubs[i];
                    const r = settledSubTasks[i];
                    const data = {
                        instance: null,
                        actions: {},
                        dayIndex: 1,
                        todayCompleted: false,
                        completionDates: {},
                        executionsByDayIndex: {},
                        missingDays: [],
                    };

                    if (r.status === 'fulfilled' && r.value?.instance) {
                        const derived = r.value as any;
                        data.instance = derived.instance;
                        data.actions = derived.actions || {};

                        if (typeof (derived.recommendedDayIndex ?? derived.nextDayIndex) === 'number') {
                            data.dayIndex = derived.recommendedDayIndex ?? derived.nextDayIndex;
                            data.todayCompleted = derived.todayCompleted || false;
                            data.completionDates = derived.completionDates || {};
                            data.executionsByDayIndex = derived.executionsByDayIndex || {};
                            data.missingDays = Array.isArray(derived.missingDays) ? derived.missingDays : [];

                            const completedCount = (derived.completedDays || []).length;
                            const totalCount = derived.totalTrainingDays || 0;
                            if (totalCount > 0 && completedCount >= totalCount && derived.instance.status === 'active') {
                                await handleCompletePlan(derived.instance);
                            }
                        } else {
                            // fallback: legacy API
                            try {
                                const nextDayRes = await fetch(`/api/execution/get-next-training-day?instanceId=${derived.instance.id}`);
                                const nextDayData = await nextDayRes.json();
                                if (nextDayData.success && nextDayData.data) {
                                    data.dayIndex = nextDayData.data.nextDayIndex;
                                    data.todayCompleted = nextDayData.data.todayCompleted || false;
                                    data.completionDates = nextDayData.data.completionDates || {};
                                    data.executionsByDayIndex = {};

                                    const completedCount = nextDayData.data.completedDays.length;
                                    const totalCount = nextDayData.data.totalTrainingDays;
                                    if (totalCount > 0 && completedCount >= totalCount && derived.instance.status === 'active') {
                                        await handleCompletePlan(derived.instance);
                                    }
                                }
                            } catch (e) {
                                const startDay = (derived.instance as any).start_execution_day || 1;
                                data.dayIndex = startDay;
                            }
                        }
                    }

                    if (sub?.id) {
                        coachPlanData[sub.id] = data;
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

            setCoachPlanDataBySubId(coachPlanData);

            const previousActive = activeSubs.find((s: any) => s.id === activeCoachSubscriptionId);
            const firstWithPlan = activeSubs.find((s: any) => coachPlanData[s.id]?.instance);
            const nextActiveId = previousActive?.id || firstWithPlan?.id || activeSubs[0]?.id || null;
            setActiveCoachSubscriptionId(nextActiveId);

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
                    setSelfMissingDays(Array.isArray(derived.missingDays) ? derived.missingDays : []);

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
            const hasAnyCoachPlan = activeSubs.some((s: any) => coachPlanData[s.id]?.instance);
            if (hasAnyCoachPlan) {
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
        if (activeSubscription?.coach_id) {
            router.push(`/coach/profile/${activeSubscription.coach_id}?action=questionnaire`);
        } else {
            // 没有教练订阅，回退到个人档案
            router.push('/me/profile');
        }
    };

    const handleGenerateNextPlan = () => {
        // 跳转到智能生成页面或计划库页面
        if (activeSubscription?.id) {
            router.push(`/me/plan-lib?subscriptionId=${activeSubscription.id}`);
        } else {
            router.push('/me/plan-lib');
        }
    };

    const handleViewHistory = () => {
        router.push('/me/plan-history');
    };

    const handleQuickFinishToday = () => {
        if (!instance?.id || !progressDay || progressDay.type !== 'training') return;
        if (progressExecutionStatus === 'completed') return;

        confirmDialog({
            message: '将按计划默认值（最小值）一键完成所有组，未填写的重量/次数会自动补齐。',
            header: '确认快速完成',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: quickFinishLoading ? '处理中...' : '确认完成',
            rejectLabel: '取消',
            acceptClassName: 'p-button-success',
            accept: async () => {
                try {
                    setQuickFinishLoading(true);
                    let executionId = (executionsByDayIndex || {})[progressDayIndex]?.id;

                    if (!executionId) {
                        const startRes = await executionService.startExecution({
                            instanceId: instance.id,
                            dayIndex: progressDayIndex,
                        });
                        executionId = startRes?.data?.id;
                    }

                    if (!executionId) {
                        throw new Error('缺少执行记录');
                    }

                    const res = await executionService.finishTraining({
                        executionId,
                        mode: 'quick',
                    });

                    if (res) {
                        showToast({
                            severity: 'success',
                            summary: '已快速完成',
                            detail: `完成 ${res.completed_sets}/${res.total_sets} 组`,
                        });
                        await loadData();
                    } else {
                        showToast({
                            severity: 'error',
                            summary: '快速完成失败',
                            detail: '请稍后重试',
                        });
                    }
                } catch (error) {
                    console.error('Quick finish failed:', error);
                    showToast({
                        severity: 'error',
                        summary: '快速完成失败',
                        detail: '网络错误，请稍后重试',
                    });
                } finally {
                    setQuickFinishLoading(false);
                }
            },
        });
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
    const hasAnyCoachPlan = coachSubscriptions.some((s) => coachPlanDataBySubId[s.id]?.instance);
    const hasAnyPlan = hasAnyCoachPlan || selfInstance;
    const hasBothPlans = hasAnyCoachPlan && selfInstance;

    if (!hasAnyPlan) {
        const subscribedCoachName =
            activeSubscription?.coach?.name ||
            activeSubscription?.coach?.title ||
            activeSubscription?.coach_id ||
            '';
        const hasActiveSubscription = !!activeSubscription?.id;
        const subscriptionLifecycle = String(activeSubscription?.lifecycle_status || 'active');
        const isExpiredGrace = subscriptionLifecycle === 'expired_grace';
        const graceDaysLeft = Math.max(0, Number(activeSubscription?.grace_days_left || 0));
        const graceDeadlineLabel = formatShortDate(activeSubscription?.grace_deadline_at);
        const renewPath = activeSubscription?.coach_id
            ? `/coach/profile/${activeSubscription.coach_id}?renew=true`
            : '/coach/subscription';

        // 有订阅但暂无计划：展示“教练制定中”的等待页
        if (hasActiveSubscription) {
            return (
                <div className="max-w-6xl mx-auto px-6 py-12 animate-in fade-in duration-700">
                    <Card className="rounded-2xl bg-transparent shadow-none overflow-hidden border border-surface-100/50">
                        <div className="text-center py-16 px-4">
                            <div className="relative inline-block mb-6">
                                <div
                                    className={`absolute inset-0 animate-ping opacity-20 rounded-full ${isExpiredGrace ? 'bg-amber-400' : 'bg-primary-400'
                                        }`}
                                />
                                <div
                                    className={`relative p-6 rounded-full border ${isExpiredGrace
                                        ? 'bg-amber-50 border-amber-100/70'
                                        : 'bg-surface-50 border-surface-100/50'
                                        }`}
                                >
                                    {isExpiredGrace ? (
                                        <i className="pi pi-exclamation-triangle text-amber-500 text-3xl" />
                                    ) : (
                                        <Target className="w-10 h-10 text-primary-500 stroke-[1.5]" />
                                    )}
                                </div>
                            </div>

                            <h3 className="text-2xl font-bold tracking-tight text-surface-900 mb-3">
                                {isExpiredGrace ? '订阅已到期，请尽快续费' : '计划正在制定中'}
                            </h3>
                            <p className="text-surface-500 max-w-sm mx-auto mb-10 leading-relaxed text-balance">
                                {isExpiredGrace
                                    ? subscribedCoachName
                                        ? `您与教练「${subscribedCoachName}」的订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。`
                                        : '您的教练订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。'
                                    : subscribedCoachName
                                        ? `您的教练「${subscribedCoachName}」正在为您制定训练计划，请耐心等待。`
                                        : '您的教练正在为您制定训练计划，请耐心等待。'}
                            </p>

                            {isExpiredGrace && (
                                <div className="mx-auto mb-8 max-w-lg rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                                    宽限期剩余 <b>{graceDaysLeft}</b> 天
                                    {graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}。逾期将自动取消订阅关系。
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                {isExpiredGrace ? (
                                    <Button
                                        label="去教练主页续费"
                                        icon="pi pi-refresh"
                                        onClick={() => router.push(renewPath)}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                    />
                                ) : (
                                    <Button
                                        label="即兴锻炼"
                                        icon="pi pi-bolt"
                                        onClick={() => router.push('/impromptu-training')}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                    />
                                )}
                                <Button
                                    label="联系教练"
                                    icon="pi pi-comments"
                                    onClick={() => {
                                        // messages page supports deep link via coachId (coaches.id)
                                        if (activeSubscription?.coach_id) {
                                            router.push(`/messages?coachId=${activeSubscription.coach_id}`);
                                        } else {
                                            router.push('/messages');
                                        }
                                    }}
                                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                />
                                {isExpiredGrace ? (
                                    <Button
                                        label="即兴锻炼"
                                        icon="pi pi-bolt"
                                        onClick={() => router.push('/impromptu-training')}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                                    />
                                ) : (
                                    <Button
                                        label="我的计划库"
                                        icon="pi pi-bookmark"
                                        onClick={() => router.push('/me/plan-lib')}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                                    />
                                )}
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
                            先完成一次即兴首练，再决定是否进入 AI 长期计划或订阅教练
                        </p>

                        {/* 4. 状态反馈：物理缩放与强调色联动 */}
                        <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                            <Button
                                label="开始即兴首练"
                                icon="pi pi-play"
                                onClick={() => router.push('/impromptu-training?from=today-training')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                            />
                            <Button
                                label="AI 长期计划"
                                icon="pi pi-calendar-plus"
                                onClick={() => router.push('/me/plan-lib/create')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                            />
                            <Button
                                label="浏览教练"
                                icon="pi pi-compass"
                                severity="secondary"
                                outlined
                                onClick={() => router.push('/coach/discovery')}
                                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl"
                            />
                        </div>
                    </div>
                </Card>
            </div>
        );
    }

    if (planMode === 'coach' && !coachInstance && activeSubscription?.id) {
        const coachName =
            activeSubscription?.coach?.name ||
            activeSubscription?.coach?.title ||
            activeSubscription?.coach_id ||
            '教练';
        const subscriptionLifecycle = String(activeSubscription?.lifecycle_status || 'active');
        const isExpiredGrace = subscriptionLifecycle === 'expired_grace';
        const graceDaysLeft = Math.max(0, Number(activeSubscription?.grace_days_left || 0));
        const graceDeadlineLabel = formatShortDate(activeSubscription?.grace_deadline_at);
        const renewPath = activeSubscription?.coach_id
            ? `/coach/profile/${activeSubscription.coach_id}?renew=true`
            : '/coach/subscription';
        return (
            <div className="min-h-screen bg-surface pb-12">
                <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-6 md:py-8">
                    {hasBothPlans && (
                        <div className="grid grid-cols-2 gap-2 p-1 bg-surface-50 rounded-2xl mb-6 w-full sm:w-fit border border-surface-100/50">
                            <button
                                className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] bg-surface text-surface-900 shadow-sm"
                                onClick={() => setPlanMode('coach')}
                            >
                                <i className="pi pi-user mr-2" />
                                教练计划
                            </button>
                            <button
                                className="px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-[0.98] text-surface-500 hover:text-surface-700"
                                onClick={() => setPlanMode('self')}
                            >
                                <i className="pi pi-star mr-2" />
                                我的计划
                            </button>
                        </div>
                    )}

                    {coachSubscriptions.length > 1 && (
                        <Card className="mb-6 border-0 shadow-sm">
                            <div className="mb-4 flex items-center gap-2">
                                <i className="pi pi-users text-primary" />
                                <span className="font-semibold text-surface-700">
                                    已订阅教练 ({coachSubscriptions.length})
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {coachSubscriptions.map((sub) => {
                                    const isActive = activeCoachSubscriptionId === sub.id;
                                    return (
                                        <button
                                            key={sub.id}
                                            className={`group relative px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-3 ${isActive
                                                ? 'bg-gradient-to-r from-primary to-primary-600 text-surface shadow-lg shadow-primary/20'
                                                : 'bg-surface text-surface-700 border border-surface-200 hover:shadow-md'
                                                }`}
                                            onClick={() => setActiveCoachSubscriptionId(sub.id)}
                                        >
                                            <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive
                                                ? 'bg-surface/20'
                                                : 'bg-surface-100'
                                                }`}>
                                                <i className={`pi pi-user ${isActive ? 'text-surface' : 'text-surface-500'}`} />
                                            </div>
                                            <div className="text-left">
                                                <div className="font-medium">
                                                    {sub.coach?.name || `教练${sub.id.substring(0, 8)}`}
                                                </div>
                                                <div className={`text-xs ${isActive ? 'text-surface/80' : 'text-surface-500'}`}>
                                                    {(sub.coach as any)?.specialization || sub.coach?.title || '专业健身教练'}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    <Card className="rounded-2xl bg-transparent shadow-none overflow-hidden border border-surface-100/50">
                        <div className="text-center py-16 px-4">
                            <div className="relative inline-block mb-6">
                                <div
                                    className={`absolute inset-0 animate-ping opacity-20 rounded-full ${isExpiredGrace ? 'bg-amber-400' : 'bg-primary-400'
                                        }`}
                                />
                                <div
                                    className={`relative p-6 rounded-full border ${isExpiredGrace
                                        ? 'bg-amber-50 border-amber-100/70'
                                        : 'bg-surface-50 border-surface-100/50'
                                        }`}
                                >
                                    {isExpiredGrace ? (
                                        <i className="pi pi-exclamation-triangle text-amber-500 text-3xl" />
                                    ) : (
                                        <Target className="w-10 h-10 text-primary-500 stroke-[1.5]" />
                                    )}
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold tracking-tight text-surface-900 mb-3">
                                {isExpiredGrace ? '订阅已到期，请尽快续费' : '计划正在制定中'}
                            </h3>
                            <p className="text-surface-500 max-w-sm mx-auto mb-10 leading-relaxed text-balance">
                                {isExpiredGrace
                                    ? coachName
                                        ? `您与教练「${coachName}」的订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。`
                                        : '您的教练订阅已到期。训练计划内容已锁定，请在宽限期内续费后恢复并继续当前进度。'
                                    : coachName
                                        ? `您的教练「${coachName}」正在为您制定训练计划，请耐心等待。`
                                        : '您的教练正在为您制定训练计划，请耐心等待。'}
                            </p>

                            {isExpiredGrace && (
                                <div className="mx-auto mb-8 max-w-lg rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
                                    宽限期剩余 <b>{graceDaysLeft}</b> 天
                                    {graceDeadlineLabel ? `（截至 ${graceDeadlineLabel}）` : ''}。逾期将自动取消订阅关系。
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                                {isExpiredGrace ? (
                                    <Button
                                        label="去教练主页续费"
                                        icon="pi pi-refresh"
                                        onClick={() => router.push(renewPath)}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                    />
                                ) : (
                                    <Button
                                        label="即兴锻炼"
                                        icon="pi pi-bolt"
                                        onClick={() => router.push('/impromptu-training')}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                    />
                                )}
                                <Button
                                    label="联系教练"
                                    icon="pi pi-comments"
                                    onClick={() => {
                                        if (activeSubscription?.coach_id) {
                                            router.push(`/messages?coachId=${activeSubscription.coach_id}`);
                                        } else {
                                            router.push('/messages');
                                        }
                                    }}
                                    className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-primary-500 border-none transition-all active:scale-[0.98] duration-200 ease-out"
                                />
                                {isExpiredGrace ? (
                                    <Button
                                        label="即兴锻炼"
                                        icon="pi pi-bolt"
                                        onClick={() => router.push('/impromptu-training')}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                                    />
                                ) : (
                                    <Button
                                        label="我的计划库"
                                        icon="pi pi-bookmark"
                                        onClick={() => router.push('/me/plan-lib')}
                                        className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-surface-50 text-surface-700 border border-surface-200 transition-all active:scale-[0.98] duration-200 ease-out hover:bg-surface-100"
                                    />
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

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
                {/* --- 教练计划切换器（多教练订阅时）--- */}
                {planMode === 'coach' && coachSubscriptions.length > 1 && (
                    <Card className="mb-6 border-0 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <i className="pi pi-users text-primary" />
                            <span className="font-semibold text-surface-700">
                                已订阅教练 ({coachSubscriptions.length})
                            </span>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            {coachSubscriptions.map((sub) => {
                                const isActive = activeCoachSubscriptionId === sub.id;
                                return (
                                    <button
                                        key={sub.id}
                                        className={`group relative px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-3 ${isActive
                                            ? 'bg-gradient-to-r from-primary to-primary-600 text-surface shadow-lg shadow-primary/20'
                                            : 'bg-surface text-surface-700 border border-surface-200 hover:shadow-md'
                                            }`}
                                        onClick={() => setActiveCoachSubscriptionId(sub.id)}
                                    >
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isActive
                                            ? 'bg-surface/20'
                                            : 'bg-surface-100'
                                            }`}>
                                            <i className={`pi pi-user ${isActive ? 'text-surface' : 'text-surface-500'}`} />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-medium">
                                                {sub.coach?.name || `教练${sub.id.substring(0, 8)}`}
                                            </div>
                                            <div className={`text-xs ${isActive ? 'text-surface/80' : 'text-surface-500'}`}>
                                                {(sub.coach as any)?.specialization || sub.coach?.title || '专业健身教练'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>
                )}
                {/* --- 顶部教练信息卡片 (仅当有订阅且当前计划不是自建时显示，或者即使是自建也可以不显示教练卡片) --- */}
                {activeSubscription?.coach && instance?.source !== 'self' && (
                    <div className="relative overflow-hidden bg-surface-900 rounded-2xl p-6 mb-8 text-surface border border-surface-100/50">
                        {/* 背景装饰图形 */}
                        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-primary-500/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-[-20%] left-[-5%] w-48 h-48 bg-blue-500/10 rounded-full blur-2xl"></div>

                        <div className="relative z-10 flex items-center justify-between">
                            <div className="flex items-center space-x-5">
                                <div className="relative">
                                    <Avatar
                                        label={activeSubscription.coach.name?.charAt(0) || 'C'}
                                        image={activeSubscription.coach.avatar_url}
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
                                        {activeSubscription.coach.name || '未知教练'}
                                    </h2>
                                    <p className="text-surface-400 text-sm font-medium">
                                        {activeSubscription.coach.title || '资深健身专家'}
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
                                    今日安排
                                </h3>
                                <p id="guide-today-progress" className="text-surface-500 text-sm flex items-center gap-2">
                                    <span>
                                        当前查看：第{selectedDayIndex}天 · {selectedDay?.type === 'rest' ? '休息日' : '训练日'}
                                    </span>
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-surface-100 transition-all active:scale-[0.98]"
                                        onClick={() => setShowExplainDialog(true)}
                                        title="为什么要点完成？为什么要输入重量？"
                                    >
                                        <Info className="w-4 h-4 text-surface-500" />
                                    </button>
                                    <span>
                                        今日推进仍在第{progressDayIndex}天
                                    </span>
                                    {selectedExecutionDateNote}
                                </p>
                            </div>
                            <div className={`hidden sm:flex items-center gap-2 font-bold text-sm px-3 py-1 rounded-full tracking-tight ${selectedExecutionStatus === 'completed'
                                ? 'text-green-600 bg-green-50'
                                : selectedExecutionStatus === 'in_progress'
                                    ? 'text-amber-700 bg-amber-50'
                                    : 'text-primary-600 bg-primary-50'
                                }`}>
                                <i className={selectedExecutionStatus === 'completed' ? 'pi pi-check' : 'pi pi-clock animate-spin-slow'} />
                                {selectedExecutionStatus === 'completed' ? '已完成' : selectedExecutionStatus === 'in_progress' ? '进行中' : '待开始'}
                            </div>
                        </div>

                        <BrowseSection
                            instance={instance}
                            currentDayIndex={todayDayIndex}
                            selectedDayIndex={selectedDayIndex}
                            onSelectedDayChange={setSelectedDayIndex}
                            executionsByDayIndex={executionsByDayIndex}
                            scheduleModel={scheduleModel}
                            todayCompleted={todayCompleted}
                            progressDayIndex={progressDayIndex}
                            effectiveStartDate={effectiveCalendarStartDate}
                        />

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 px-2">
                            <div className="rounded-2xl border border-surface-100/60 bg-surface-50 px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-surface-500">今日模块</div>
                                <div className="mt-1 text-2xl font-black text-surface-900">
                                    {selectedDay?.type === 'training' ? selectedTaskSummary.totalModules : 1}
                                </div>
                                <div className="text-xs text-surface-500 mt-1">
                                    {selectedDay?.type === 'training' ? '力量 + 轻量任务' : '以恢复和浏览为主'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-green-100/60 bg-green-50 px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-green-700">已完成</div>
                                <div className="mt-1 text-2xl font-black text-green-800">
                                    {selectedDay?.type === 'training' ? selectedTaskSummary.completedModules : (selectedExecutionStatus === 'completed' ? 1 : 0)}
                                </div>
                                <div className="text-xs text-green-700/80 mt-1">
                                    {selectedDay?.type === 'training' ? '该天已经完成的模块' : '该天的恢复安排'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-primary-100/60 bg-primary-50 px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-primary-700">剩余</div>
                                <div className="mt-1 text-2xl font-black text-primary-800">
                                    {selectedDay?.type === 'training' ? selectedTaskSummary.remainingModules : (selectedExecutionStatus === 'completed' ? 0 : 1)}
                                </div>
                                <div className="text-xs text-primary-700/80 mt-1">
                                    {selectedDay?.type === 'training' ? '该天还可以继续完成' : '按节奏休息即可'}
                                </div>
                            </div>
                            <div className="rounded-2xl border border-amber-100/60 bg-amber-50 px-4 py-3">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-amber-700">当前节奏</div>
                                <div className="mt-1 text-lg font-black text-amber-800">
                                    {selectedDay?.type === 'training' ? '训练日' : '恢复日'}
                                </div>
                                <div className="text-xs text-amber-700/80 mt-1">
                                    {selectedDay?.type === 'training'
                                        ? `${selectedTaskSummary.strengthModuleCount > 0 ? '含训练模块' : '轻任务为主'} · ${selectedTaskSummary.lightweightCount} 个轻任务`
                                        : '浏览计划或继续未完成训练'}
                                </div>
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
                            <div className="mb-3 flex justify-end">
                                <Button
                                    label="即兴锻炼"
                                    icon="pi pi-bolt"
                                    severity="secondary"
                                    outlined
                                    onClick={() => router.push('/impromptu-training')}
                                    className="px-4 py-2 rounded-xl"
                                />
                            </div>
                            {selectedDay && selectedDay.type === 'training' ? (
                                <>
                                    <TodayTrainingCard
                                        day={selectedDay}
                                        actions={actions}
                                        instanceId={instance.id}
                                        dayIndex={selectedDayIndex}
                                        executionStatus={selectedExecutionStatus}
                                        execution={selectedExec}
                                        heading={selectedDayIndex === progressDayIndex ? '今日安排' : '当天安排'}
                                        subheading={`第${selectedDayIndex}天 · ${selectedTaskSummary.totalModules} 个模块`}
                                        dateLabel={selectedDateLabel}
                                        dateMeta={selectedDateMeta}
                                        onOpenLightweightTask={handleOpenLightweightTask}
                                        onAddLightweightTask={handleOpenLightweightPicker}
                                        onDeleteLightweightTask={handleDeleteLightweightTask}
                                    />
                                    {selectedDayIndex === progressDayIndex && !selectedHasLightweightTasks && selectedExecutionStatus !== 'completed' && (
                                        <div className="mt-3 flex justify-end">
                                            <Button
                                                label={quickFinishLoading ? '快速完成中...' : '一键快速完成'}
                                                onClick={handleQuickFinishToday}
                                                disabled={quickFinishLoading}
                                                severity="secondary"
                                                outlined
                                                className="px-4 py-2 rounded-xl"
                                            />
                                        </div>
                                    )}
                                    {canShareDayCheckin && (
                                        <div className="mt-4 rounded-3xl border border-primary-100/70 bg-gradient-to-br from-primary-50 to-white p-4 sm:p-5">
                                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                                <div>
                                                    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary-700">
                                                        SHARE CHECK-IN
                                                    </div>
                                                    <div className="mt-2 text-xl font-black tracking-tight text-surface-900">
                                                        现在可以生成整日打卡图
                                                    </div>
                                                    <div className="mt-2 text-sm text-surface-600">
                                                        这里展示的是今天这一天的完成状态快照，不要求你把所有任务都先做完。
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-2 sm:flex-row">
                                                    <Button
                                                        label="整日打卡图"
                                                        icon="pi pi-sparkles"
                                                        onClick={() => setDayShareVisible(true)}
                                                        className="w-full sm:w-auto"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <RestDayCard dayIndex={selectedDayIndex} />
                                    <div className="mt-4">
                                        <TodayTrainingCard
                                            day={selectedDay}
                                            actions={actions}
                                            instanceId={instance.id}
                                            dayIndex={selectedDayIndex}
                                            executionStatus={selectedExecutionStatus}
                                            execution={selectedExec}
                                            heading="休息日轻任务"
                                            subheading={`第${selectedDayIndex}天 · ${selectedTaskSummary.lightweightCount} 个轻任务`}
                                            dateLabel={selectedDateLabel}
                                            dateMeta={selectedDateMeta}
                                            onOpenLightweightTask={handleOpenLightweightTask}
                                            onAddLightweightTask={handleOpenLightweightPicker}
                                            onDeleteLightweightTask={handleDeleteLightweightTask}
                                        />
                                    </div>
                                </>
                            )}

                            {selectedDay?.type === 'rest' && inProgressExec && (
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
                </div>
            </div>

            <LightweightTaskSheet
                visible={lightweightSheetVisible}
                task={activeLightweightTask}
                instanceId={instance?.id || ''}
                dayIndex={selectedDayIndex}
                execution={selectedExec}
                onHide={() => {
                    setLightweightSheetVisible(false);
                    setActiveLightweightTask(null);
                }}
                onCompleted={handleLightweightTaskCompleted}
            />

            <ActionPicker
                visible={lightweightPickerVisible}
                onHide={() => setLightweightPickerVisible(false)}
                onSelect={handleSelectLightweightAction}
                userId={session?.user?.id || ''}
                allowedTypes={['DIET', 'CARDIO', 'HABIT']}
                title={addingLightweightTask ? '新增轻任务中...' : '选择轻任务'}
                emptyText="你的动作库里还没有饮食、有氧或习惯类型动作"
            />

            <Dialog
                header={pendingLightweightAction ? `配置任务 · ${pendingLightweightAction.name}` : '配置任务'}
                visible={lightweightConfigVisible}
                onHide={() => {
                    if (addingLightweightTask) return;
                    setLightweightConfigVisible(false);
                    setPendingLightweightAction(null);
                }}
                draggable={false}
                resizable={false}
                className="w-[min(92vw,640px)]"
            >
                {!pendingLightweightAction ? null : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-surface-700">建议时间（可选）</label>
                                <InputText
                                    value={newTaskSuggestedTime}
                                    onChange={(e) => setNewTaskSuggestedTime(e.target.value)}
                                    placeholder="例如：07:30 / 晚饭后"
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-surface-700">任务类型</label>
                                <div className="h-[42px] rounded-xl border border-surface-200 bg-surface-50 px-3 flex items-center text-sm font-medium text-surface-700">
                                    {String(pendingLightweightAction.type || '').toUpperCase() || 'DIET'}
                                </div>
                            </div>
                        </div>

                        {String(pendingLightweightAction.type || '').toUpperCase() === 'DIET' && (
                            <div>
                                <label className="mb-2 block text-sm font-medium text-surface-700">饮食目标/内容</label>
                                <InputTextarea
                                    value={newDietContent}
                                    onChange={(e) => setNewDietContent(e.target.value)}
                                    rows={3}
                                    className="w-full"
                                    placeholder="例如：早餐高蛋白，碳水控制在 60g 以内"
                                />
                            </div>
                        )}

                        {String(pendingLightweightAction.type || '').toUpperCase() === 'CARDIO' && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-surface-700">目标距离（km）</label>
                                    <AeroInputNumber
                                        value={newCardioDistanceKm}
                                        onValueChange={(e) => setNewCardioDistanceKm(e.value ?? null)}
                                        min={0}
                                        max={200}
                                        minFractionDigits={1}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-surface-700">目标时长（分钟）</label>
                                    <AeroInputNumber
                                        value={newCardioDurationMin}
                                        onValueChange={(e) => setNewCardioDurationMin(e.value ?? null)}
                                        min={0}
                                        max={600}
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-surface-700">目标配速（可选）</label>
                                    <InputText
                                        value={newCardioPace}
                                        onChange={(e) => setNewCardioPace(e.target.value)}
                                        placeholder="例如：5'30''/km"
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        {String(pendingLightweightAction.type || '').toUpperCase() === 'HABIT' && (
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-surface-700">习惯名称</label>
                                    <InputText
                                        value={newHabitName}
                                        onChange={(e) => setNewHabitName(e.target.value)}
                                        placeholder="例如：23:00 前入睡"
                                        className="w-full"
                                    />
                                </div>
                                <div>
                                    <label className="mb-2 block text-sm font-medium text-surface-700">目标时长（分钟，可选）</label>
                                    <AeroInputNumber
                                        value={newHabitTargetDurationMin}
                                        onValueChange={(e) => setNewHabitTargetDurationMin(e.value ?? null)}
                                        min={0}
                                        max={600}
                                        className="w-full"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-surface-700">备注（可选）</label>
                            <InputTextarea
                                value={newTaskNotes}
                                onChange={(e) => setNewTaskNotes(e.target.value)}
                                rows={2}
                                className="w-full"
                                placeholder="补充说明会显示在任务卡片上"
                            />
                        </div>

                        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                            <Button
                                label="取消"
                                severity="secondary"
                                outlined
                                onClick={() => {
                                    setLightweightConfigVisible(false);
                                    setPendingLightweightAction(null);
                                }}
                                disabled={addingLightweightTask}
                            />
                            <Button
                                label={addingLightweightTask ? '创建中...' : '创建任务'}
                                severity="success"
                                onClick={handleAddLightweightTask}
                                disabled={addingLightweightTask}
                            />
                        </div>
                    </div>
                )}
            </Dialog>

            <DayCheckinShareGenerator
                visible={dayShareVisible}
                onHide={() => setDayShareVisible(false)}
                data={dayShareData}
            />

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
                                router.push(`/training-execution/${instance.id}?dayIndex=${selectedDayIndex}&focus=weight`);
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
