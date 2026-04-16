'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import { Skeleton } from 'primereact/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import { studentPlanLibService } from '@/app/service/studentPlanLibService';
import { studentService } from '@/app/service/studentService';
import { StudentActionRow } from '@/types/student';
import { CoachActionRow } from '@/types';
import type { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import BasicInfoForm from '@/app/dashboard/plan-lib/components/BasicInfoForm';
import PlanDayCard from '@/app/dashboard/plan-lib/components/PlanDayCard';
import WeekCalendar from '@/app/dashboard/plan-lib/components/WeekCalendar';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import type { ItemType } from '@/types';
import { BatchOperationDialog } from '@/components/BatchOperationDialog';
import BatchActionsDialog, { BatchOperation } from '@/app/dashboard/plan-lib/components/BatchActionsDialog';
import StudentOneRMConfigPanel from '@/app/me/plan-lib/components/StudentOneRMConfigPanel';
import {
    appendActionToDays,
    deleteActionInDays,
    isActionFullyCompatible,
    replaceActionInDays,
} from '@/lib/planBatchUtils';

const EditPlanPage = () => {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { showToast } = useToastContext();
    const { data: session } = useSession();

    // Plan basic info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Days management
    const [days, setDays] = useState<FormPlanTrainingDay[]>([]);

    // Selected day for editing
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

    // Actions from library
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionsLoading, setActionsLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [aiBatchDialogVisible, setAiBatchDialogVisible] = useState(false);
    const [originalDaysBeforeAi, setOriginalDaysBeforeAi] = useState<FormPlanTrainingDay[] | null>(null);
    const [batchDialogVisible, setBatchDialogVisible] = useState(false);
    const [actionSearchId, setActionSearchId] = useState<string | null>(null);
    const [studentData, setStudentData] = useState<GetStudentResponseDto['student'] | null>(null);
    const [planReference1RMs, setPlanReference1RMs] = useState<Record<string, number>>({});

    useEffect(() => {
        if (id && session?.user?.id) {
            loadPlan();
            loadActions();
            fetchProfile();
        }
    }, [id, session?.user?.id]);

    const loadPlan = async () => {
        setLoading(true);
        try {
            const res = await studentPlanLibService.getFavorite({ id });
            if (res?.favorite) {
                setName(res.favorite.name);
                setDescription(res.favorite.description || '');
                
                // 确保训练日数据格式正确
                const trainingDays = res.favorite.training_days || [];
                const formattedDays: FormPlanTrainingDay[] = trainingDays.map((day: any, index: number) => ({
                    dayIndex: day.dayIndex || index + 1,
                    type: day.type || 'training',
                    note: day.note || '',
                    actionSets: day.actionSets || day.actions?.map((a: any) => ({
                        actionId: a.actionId,
                        actionName: a.actionName,
                        params: {
                            sets: a.sets || 3,
                            reps: a.reps || '10',
                            intensity: a.weight || '',
                            rest: a.rest || '60秒'
                        }
                    })) || [],
                    actionSetsCount: (day.actionSets || day.actions || []).length
                }));
                
                setDays(formattedDays);
                if (formattedDays.length > 0) {
                    setSelectedDayIndex(1);
                }
            }
        } catch (error: any) {
            console.error('加载计划失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: error?.message || '无法加载计划' });
            router.push('/me/plan-lib');
        } finally {
            setLoading(false);
        }
    };

    const loadActions = async () => {
        setActionsLoading(true);
        try {
            const res = await studentActionLibService.listActions({
                page: 1,
                limit: 100
            });
            if (res) {
                const parseAutoComputeFlag = (action: StudentActionRow & Record<string, any>) => {
                    if (typeof action.enableAutoWeightCompute === 'boolean') return action.enableAutoWeightCompute;
                    if (typeof action.enable_auto_weight_compute === 'boolean') return action.enable_auto_weight_compute;
                    if (typeof action.enableautoweightcompute === 'boolean') return action.enableautoweightcompute;
                    return Array.isArray(action.attrs) && action.attrs.includes('强度');
                };

                const parseIncludesBodyWeightFlag = (action: StudentActionRow & Record<string, any>) => {
                    if (typeof action.includesBodyWeight === 'boolean') return action.includesBodyWeight;
                    if (typeof action.includes_body_weight === 'boolean') return action.includes_body_weight;
                    if (typeof action.includesbodyweight === 'boolean') return action.includesbodyweight;
                    return false;
                };

                const convertedActions: CoachActionRow[] = res.actions.map((action: StudentActionRow) => ({
                    ...(action as StudentActionRow & Record<string, any>),
                    id: action.id,
                    coach_id: action.user_id,
                    name: action.name,
                    detail: action.detail,
                    positions: action.positions,
                    attrs: action.attrs,
                    url: action.url,
                    type: action.type || 'STRENGTH',
                    item_schema: action.item_schema ?? null,
                    suggested_time: action.suggested_time ?? null,
                    created_at: action.created_at,
                    updated_at: action.updated_at,
                    enableAutoWeightCompute: parseAutoComputeFlag(action as StudentActionRow & Record<string, any>),
                    includesBodyWeight: parseIncludesBodyWeightFlag(action as StudentActionRow & Record<string, any>),
                    canonical_action_id: action.canonical_action_id ?? null,
                }));
                setActions(convertedActions);
                setPlanReference1RMs((prev) => {
                    const next = { ...prev };
                    convertedActions.forEach((action) => {
                        const reference1RM = Number((action as any).reference_1rm);
                        if (next[action.id] === undefined && Number.isFinite(reference1RM) && reference1RM > 0) {
                            next[action.id] = reference1RM;
                        }
                    });
                    return next;
                });
            }
        } catch (error) {
            console.error('加载动作库失败:', error);
        } finally {
            setActionsLoading(false);
        }
    };

    const fetchProfile = async () => {
        try {
            if (!session?.user?.id) return;

            const profileRes = await studentService.getStudentProfile(session.user.id);
            if (profileRes?.profile) {
                setStudentData({
                    id: session.user.id,
                    student_id: session.user.id,
                    tier: 1,
                    status: 'active',
                    start_date: new Date().toISOString(),
                    end_date: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    subscribe_data: null,
                    monthly_price: 0,
                    profile: profileRes.profile,
                    uploaded: 0,
                    reviewed: 0,
                });
            }
        } catch (error) {
            console.error('加载学员档案失败:', error);
        }
    };

    const handleAddWeek = () => {
        const currentLength = days.length;
        const newDays = [...days];

        for (let i = 1; i <= 7; i++) {
            newDays.push({
                dayIndex: currentLength + i,
                type: 'training',
                note: '',
                actionSets: [],
                actionSetsCount: 0
            });
        }

        setDays(newDays);
    };

    const handleAddWeekFromExisting = (sourceWeekIndex: number) => {
        const startDayIndex = sourceWeekIndex * 7;
        const weekDays = days.slice(startDayIndex, startDayIndex + 7);
        const currentLength = days.length;

        const newDays = weekDays.map((day, idx) => ({
            ...day,
            dayIndex: currentLength + idx + 1,
            actionSets: day.actionSets.map(set => ({ ...set, params: { ...set.params } }))
        }));

        setDays([...days, ...newDays]);
    };

    const handleDeleteWeek = (weekStartIndex: number) => {
        // WeekCalendar 传入的就是“周起始的数组下标”（0, 7, 14...），不需要再 * 7
        const weekStart = weekStartIndex;
        const newDays = days.filter((_, index) => index < weekStart || index >= weekStart + 7);
        
        const reindexedDays = newDays.map((day, index) => ({
            ...day,
            dayIndex: index + 1
        }));

        setDays(reindexedDays);
        
        if (selectedDayIndex !== null) {
            // selectedDayIndex 是 dayIndex（1-based）
            const startDayIndex = weekStart + 1;
            const endDayIndex = weekStart + 7;
            if (selectedDayIndex >= startDayIndex && selectedDayIndex <= endDayIndex) {
                setSelectedDayIndex(null);
            } else if (selectedDayIndex > endDayIndex) {
                setSelectedDayIndex(selectedDayIndex - 7);
            }
        }
    };

    const handleRemoveDay = (index: number) => {
        const newDays = [...days];
        newDays[index] = {
            ...newDays[index],
            type: 'rest',
            actionSets: [],
            actionSetsCount: 0
        };
        setDays(newDays);
    };

    const handleDayTypeChange = (index: number, type: 'training' | 'rest') => {
        const newDays = [...days];
        newDays[index] = { 
            ...newDays[index], 
            type,
            actionSets: type === 'rest' ? [] : newDays[index].actionSets,
            actionSetsCount: type === 'rest' ? 0 : newDays[index].actionSetsCount
        };
        setDays(newDays);
    };

    const handleAddActionSet = (dayIndexVal: number, type: ItemType = 'STRENGTH') => {
        const newDays = [...days];
        const arrayIndex = newDays.findIndex(d => d.dayIndex === dayIndexVal);
        
        if (arrayIndex === -1) {
            console.error('Cannot find day with dayIndex:', dayIndexVal);
            return;
        }

        const day = newDays[arrayIndex];
        // 关键：PlanDayCard 会用 actionSet.itemType 来筛选动作选项
        const baseItem: any = {
            type: 'no-filter',
            actionId: '',
            setName: '',
            itemType: type,
        };

        if (type === 'STRENGTH') {
            day.actionSets.push({
                ...baseItem,
                actionName: '',
                params: {
                    sets: 3,
                    reps: '10',
                    intensity: '',
                    rest: '60秒'
                }
            } as any);
        } else if (type === 'DIET') {
            day.actionSets.push({
                ...baseItem,
                params: {
                    suggested_time: null,
                    custom_data: {
                        content: '',
                        calories: null,
                    },
                },
            } as any);
        } else if (type === 'CARDIO') {
            day.actionSets.push({
                ...baseItem,
                params: {
                    custom_data: {
                        distance: null, // meters
                        duration: null, // seconds
                        pace: null, // min/km
                    },
                },
            } as any);
        } else if (type === 'HABIT') {
            day.actionSets.push({
                ...baseItem,
                params: {
                    custom_data: {
                        habit_name: '',
                        target_duration: null,
                    },
                },
            } as any);
        } else {
            // fallback
            day.actionSets.push({
                ...baseItem,
                params: {},
            } as any);
        }
        day.actionSetsCount = day.actionSets.length;
        setDays(newDays);
    };

    const handleNoteChange = (dayIndex: number, note: string) => {
        const newDays = [...days];
        newDays[dayIndex] = { ...newDays[dayIndex], note };
        setDays(newDays);
    };

    const handleRemoveActionSet = (dayIndexOrArrayIndex: number, setIndex: number) => {
        const newDays = [...days];
        // PlanDayCard 传入的是 day.dayIndex（1-based），这里需要转换成数组下标
        let arrayIndex = newDays.findIndex(d => d.dayIndex === dayIndexOrArrayIndex);
        // 兼容旧调用：如果没找到，再尝试把入参当作数组下标
        if (arrayIndex === -1 && dayIndexOrArrayIndex >= 0 && dayIndexOrArrayIndex < newDays.length) {
            arrayIndex = dayIndexOrArrayIndex;
        }
        if (arrayIndex === -1) {
            console.error('Cannot find day for removeActionSet:', dayIndexOrArrayIndex);
            return;
        }
        newDays[arrayIndex].actionSets.splice(setIndex, 1);
        newDays[arrayIndex].actionSetsCount = newDays[arrayIndex].actionSets.length;
        setDays(newDays);
    };

    const handleMoveActionSet = (
        dayIndexOrArrayIndex: number,
        setIndex: number,
        direction: 'up' | 'down'
    ) => {
        const newDays = [...days];
        let arrayIndex = newDays.findIndex(d => d.dayIndex === dayIndexOrArrayIndex);
        if (arrayIndex === -1 && dayIndexOrArrayIndex >= 0 && dayIndexOrArrayIndex < newDays.length) {
            arrayIndex = dayIndexOrArrayIndex;
        }
        if (arrayIndex === -1) {
            console.error('Cannot find day for moveActionSet:', dayIndexOrArrayIndex);
            return;
        }

        const actionSets = [...(newDays[arrayIndex].actionSets || [])];
        const targetIndex = direction === 'up' ? setIndex - 1 : setIndex + 1;
        if (targetIndex < 0 || targetIndex >= actionSets.length) return;

        [actionSets[setIndex], actionSets[targetIndex]] = [actionSets[targetIndex], actionSets[setIndex]];
        newDays[arrayIndex] = {
            ...newDays[arrayIndex],
            actionSets,
            actionSetsCount: actionSets.length,
        };
        setDays(newDays);
    };

    const handleActionSetChange = (
        dayIndex: number,
        setIndex: number,
        field: string,
        value: string | number | object
    ) => {
        const newDays = [...days];
        const actionSet = newDays[dayIndex].actionSets[setIndex];

        if (field === 'actionId') {
            actionSet.actionId = value as string;
            const action = actions.find(a => a.id === value);
            actionSet.actionName = action?.name || '';
        } else if (field === 'params') {
            actionSet.params = { ...actionSet.params, ...(value as object) };
        } else if (field.startsWith('params.')) {
            const paramField = field.replace('params.', '');
            actionSet.params = { ...actionSet.params, [paramField]: value };
        } else {
            (actionSet as any)[field] = value;
        }

        setDays(newDays);
    };

    const handleCopyFromDay = (targetDayIndex: number, sourceDayIndex: number) => {
        const newDays = [...days];
        const sourceDay = days[sourceDayIndex];
        
        newDays[targetDayIndex] = {
            ...newDays[targetDayIndex],
            type: 'training',
            actionSets: sourceDay.actionSets.map(set => ({ ...set, params: { ...set.params } })),
            actionSetsCount: sourceDay.actionSets.length
        };
        
        setDays(newDays);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            showToast({ severity: 'warn', summary: '提示', detail: '请输入计划名称' });
            return;
        }

        setSaving(true);
        try {
            await studentPlanLibService.updateFavorite({
                id,
                name: name.trim(),
                description: description.trim() || undefined,
                training_days: days
            });
            showToast({ severity: 'success', summary: '保存成功', detail: '常用计划已更新' });
            router.push('/me/plan-lib');
        } catch (error: any) {
            console.error('保存计划失败:', error);
            showToast({ severity: 'error', summary: '保存失败', detail: error?.message || '无法保存计划' });
        } finally {
            setSaving(false);
        }
    };

    const handleAiPreviewResult = (data: { updatedTrainingDays: any[] }) => {
        setOriginalDaysBeforeAi(JSON.parse(JSON.stringify(days)));
        const converted: FormPlanTrainingDay[] = (data.updatedTrainingDays || []).map((day: any) => ({
            dayIndex: day.dayIndex ?? 0,
            type: day.type || 'rest',
            note: day.note || '',
            actionSets: day.actionSets || [],
            actionSetsCount: (day.actionSets || []).length,
        })).sort((a, b) => a.dayIndex - b.dayIndex);
        setDays(converted);
    };

    const handleAiRestart = () => {
        if (originalDaysBeforeAi) {
            setDays(originalDaysBeforeAi);
            setOriginalDaysBeforeAi(null);
        }
    };

    const handleAiApplyLocal = (updatedTrainingDays: any[]) => {
        const converted: FormPlanTrainingDay[] = (updatedTrainingDays || []).map((day: any) => ({
            dayIndex: day.dayIndex ?? 0,
            type: day.type || 'rest',
            note: day.note || '',
            actionSets: day.actionSets || [],
            actionSetsCount: (day.actionSets || []).length,
        })).sort((a, b) => a.dayIndex - b.dayIndex);
        setDays(converted);
        if (converted.length > 0) setSelectedDayIndex(converted[0].dayIndex);
        showToast({ severity: 'success', summary: 'AI 修改器成功', detail: '修改已应用到当前计划，请点击保存计划' });
    };

    const handleAiBatchOperationSuccess = async () => {
        setAiBatchDialogVisible(false);
        setOriginalDaysBeforeAi(null);
        await loadActions();
    };

    const handleBatchApply = (operation: BatchOperation) => {
        if (operation.type === 'replace') {
            const fromAction = actions.find(a => a.id === operation.fromActionId);
            const toAction = actions.find(a => a.id === operation.toActionId);
            if (!isActionFullyCompatible(fromAction, toAction)) {
                showToast({ severity: 'error', summary: '替换失败', detail: '动作属性不一致，无法替换' });
                return;
            }
            const result = replaceActionInDays(days, operation.fromActionId, operation.toActionId);
            if (result.affectedSets === 0) {
                showToast({ severity: 'info', summary: '未替换', detail: '未找到可替换的动作' });
                return;
            }
            setDays(result.days);
            showToast({ severity: 'success', summary: '替换成功', detail: `共替换 ${result.affectedSets} 个动作` });
        } else if (operation.type === 'delete') {
            const result = deleteActionInDays(days, operation.actionId);
            if (result.affectedSets === 0) {
                showToast({ severity: 'info', summary: '未删除', detail: '未找到可删除的动作' });
                return;
            }
            setDays(result.days);
            showToast({ severity: 'success', summary: '删除成功', detail: `共删除 ${result.affectedSets} 个动作` });
        } else {
            const targetAction = actions.find(a => a.id === operation.actionId);
            if (!targetAction) {
                showToast({ severity: 'error', summary: '追加失败', detail: '未找到目标动作' });
                return;
            }
            const result = appendActionToDays(days, targetAction, operation.weekStart, operation.weekEnd, operation.weekdays);
            if (result.affectedSets === 0) {
                showToast({ severity: 'info', summary: '未追加', detail: '未命中符合条件的训练日' });
                return;
            }
            setDays(result.days);
            showToast({ severity: 'success', summary: '追加成功', detail: `共追加 ${result.affectedSets} 个动作` });
        }
    };

    if (loading) {
        return (
            <div className="mx-auto p-4">
                <Card className="shadow-sm">
                    <div className="p-6 space-y-4">
                        <Skeleton width="200px" height="2rem" />
                        <Skeleton width="100%" height="3rem" />
                        <Skeleton width="100%" height="100px" />
                        <Skeleton width="100%" height="300px" />
                    </div>
                </Card>
            </div>
        );
    }

    // 计算当前选中的训练日（使用 day.dayIndex 属性匹配，而不是数组索引）
    const selectedDay = selectedDayIndex !== null
        ? days.find(day => day.dayIndex === selectedDayIndex)
        : null;

    // 计算现有的训练日用于复制功能
    const existingTrainingDays = days
        .map(day => ({
            dayIndex: day.dayIndex,
            actionSetsCount: day.actionSets.length,
            type: day.type,
            note: day.note,
            actionSets: day.actionSets
        }));

    const actionSearchOptions = actions.map(action => ({ label: action.name, value: action.id }));

    const actionSearchResults = (() => {
        if (!actionSearchId) return [];

        return days.filter(day => {
            if (!day.actionSets || day.actionSets.length === 0) return false;
            return day.actionSets.some((set: any) => {
                if (set.type === 'one-filter') {
                    return (set.actions || []).some((inner: any) => inner.actionId === actionSearchId);
                }
                return set.actionId === actionSearchId;
            });
        });
    })();

    return (
        <div className="flex h-[fit-content]">
            <div className="flex-1 p-3 sm:p-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-900">编辑训练计划</h1>
                    <Button
                        label="取消"
                        icon="pi pi-arrow-left"
                        onClick={() => router.back()}
                        className="p-button-text"
                        disabled={saving}
                    />
                </div>

                <BasicInfoForm
                    variant="student"
                    name={name}
                    description={description}
                    tags={[]}
                    suitableFor="beginner"
                    onNameChange={setName}
                    onDescriptionChange={setDescription}
                    onTagsChange={() => { }}
                    onSuitableForChange={() => { }}
                    saving={saving}
                    onSave={handleSave}
                    extraButton={
                        <>
                            <Button
                                label="批量操作"
                                size="small"
                                icon="pi pi-sliders-h"
                                className="
                                    flex items-center gap-2 px-4 py-2
                                    bg-surface border border-surface-200 rounded-[14px]
                                    text-[12px] font-black text-surface-700 tracking-tight
                                    transition-all duration-200 active:scale-[0.95]
                                    hover:border-primary-300 hover:text-primary-600 hover:shadow-sm
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                "
                                text
                                onClick={() => setBatchDialogVisible(true)}
                                disabled={saving}
                            />
                            <Button
                                label="AI 修改器"
                                size="small"
                                icon="pi pi-bolt"
                                className="
                                    flex items-center gap-2 px-4 py-2
                                    bg-primary-50 border border-primary-200 rounded-[14px]
                                    text-[12px] font-black text-primary-700 tracking-tight
                                    transition-all duration-200 active:scale-[0.95]
                                    hover:border-primary-400 hover:bg-primary-100 hover:shadow-sm
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                "
                                text
                                onClick={() => setAiBatchDialogVisible(true)}
                                disabled={saving}
                            />
                        </>
                    }
                />

                <StudentOneRMConfigPanel
                    days={days}
                    actions={actions}
                    value={planReference1RMs}
                    onChange={setPlanReference1RMs}
                    onSaved={() => {
                        void loadActions();
                    }}
                />

                <Card className="shadow-sm mb-6 bg-surface-0 border border-surface-200/70 rounded-[24px]">
                    <div className="mb-3 rounded-xl border border-surface-100 bg-surface-50/50 p-2.5 md:p-3">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-black text-surface-800">动作搜索</span>
                                {actionSearchId && (
                                    <button
                                        type="button"
                                        onClick={() => setActionSearchId(null)}
                                        className="text-[11px] font-black text-primary-600 hover:text-primary-700 transition-colors"
                                    >
                                        清除
                                    </button>
                                )}
                            </div>
                            <Dropdown
                                value={actionSearchId}
                                options={actionSearchOptions}
                                onChange={(e) => setActionSearchId(e.value || null)}
                                placeholder="输入动作名称搜索"
                                filter
                                showClear
                                className="w-full sm:max-w-xs aero-dropdown"
                                panelClassName="aero-dropdown-panel"
                                disabled={saving || actions.length === 0 || actionsLoading}
                            />
                            {actionSearchId && actionSearchResults.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {actionSearchResults.map((day) => {
                                        const week = Math.ceil(day.dayIndex / 7);
                                        const dayOfWeek = (day.dayIndex - 1) % 7 + 1;
                                        return (
                                            <button
                                                key={day.dayIndex}
                                                type="button"
                                                onClick={() => setSelectedDayIndex(day.dayIndex)}
                                                className="px-3 py-1.5 rounded-full border border-surface-200 text-[11px] font-black text-surface-600 hover:border-primary-300 hover:text-primary-700 transition-colors"
                                            >
                                                第 {day.dayIndex} 天 · W{week}D{dayOfWeek}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {actionSearchId && actionSearchResults.length === 0 && (
                            <div className="text-[11px] text-surface-400 mt-2">未找到包含该动作的训练日</div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-h-[500px]">
                        <div className="lg:col-span-1">
                            <WeekCalendar
                                days={days}
                                selectedDayIndex={selectedDayIndex}
                                onSelectDay={setSelectedDayIndex}
                                onAddWeek={handleAddWeek}
                                onAddWeekFromExisting={handleAddWeekFromExisting}
                                onDeleteWeek={handleDeleteWeek}
                                saving={saving}
                            />
                        </div>

                        <div className="lg:col-span-2 -mx-2 sm:mx-0">
                            {selectedDay ? (
                                <PlanDayCard
                                    day={selectedDay}
                                    dayIndex={days.findIndex(d => d.dayIndex === selectedDay.dayIndex)}
                                    actions={actions}
                                    onDayTypeChange={handleDayTypeChange}
                                    onRemoveDay={handleRemoveDay}
                                    onNoteChange={handleNoteChange}
                                    onAddActionSet={handleAddActionSet}
                                    onRemoveActionSet={handleRemoveActionSet}
                                    onMoveActionSet={handleMoveActionSet}
                                    onActionSetChange={handleActionSetChange}
                                    saving={saving}
                                    totalDays={days.length}
                                    onCopyFromDay={handleCopyFromDay}
                                    existingTrainingDays={existingTrainingDays}
                                    studentData={studentData}
                                    planReference1RMs={planReference1RMs}
                                />
                            ) : (
                                <div className="card shadow-sm flex items-center justify-center h-full min-h-20rem">
                                    <div className="text-center p-6">
                                        <i className="pi pi-info-circle text-600 text-5xl mb-3"></i>
                                        <p className="text-700 text-lg">请选择一个训练日进行编辑</p>
                                        <p className="text-600">从左侧日历中选择一个训练日</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-2">
                        <Button
                            label="取消"
                            icon="pi pi-times"
                            onClick={() => router.back()}
                            className="p-button-text"
                            disabled={saving}
                        />
                        <Button
                            label="保存计划"
                            icon="pi pi-check"
                            className="p-button-primary shadow-lg shadow-primary-200 transition-transform active:scale-95 rounded-2xl px-6"
                            onClick={handleSave}
                            loading={saving}
                        />
                    </div>
                </Card>
            </div>

            <BatchActionsDialog
                visible={batchDialogVisible}
                onHide={() => setBatchDialogVisible(false)}
                actions={actions}
                maxWeeks={Math.max(1, Math.ceil(days.length / 7))}
                onApply={handleBatchApply}
                disabled={saving}
            />

            <BatchOperationDialog
                visible={aiBatchDialogVisible}
                onHide={() => setAiBatchDialogVisible(false)}
                mode="local"
                targetActionType="student"
                contextOptions={{
                    includeStudentProfile: false,
                    includeStudentQuestionnaire: false,
                    includeExecutionHistory: false,
                    includeFeedbacks: false,
                    includeStudentActionLib: true,
                    includeCoachActionLib: false,
                    includePublicActionLib: true,
                    includeCoachTemplates: false,
                    includeTemplateMatch: false,
                }}
                initialTrainingDays={days}
                existingActions={actions}
                onApplyLocal={handleAiApplyLocal}
                onSuccess={handleAiBatchOperationSuccess}
                onPreviewResult={handleAiPreviewResult}
                onRestart={handleAiRestart}
                onGetDaysToApply={() => days}
            />
        </div>
    );
};

export default EditPlanPage;
