'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Skeleton } from 'primereact/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import { studentPlanLibService } from '@/app/service/studentPlanLibService';
import { StudentActionRow } from '@/types/student';
import { CoachActionRow } from '@/types';
import PlanDayCard from '@/app/dashboard/plan-lib/components/PlanDayCard';
import WeekCalendar from '@/app/dashboard/plan-lib/components/WeekCalendar';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import type { ItemType } from '@/types';
import { BatchOperationDialog } from '@/components/BatchOperationDialog';
import BatchActionsDialog, { BatchOperation } from '@/app/dashboard/plan-lib/components/BatchActionsDialog';
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

    useEffect(() => {
        if (id && session?.user?.id) {
            loadPlan();
            loadActions();
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
                const convertedActions: CoachActionRow[] = res.actions.map((action: StudentActionRow) => ({
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
                    enableAutoWeightCompute: action.enableAutoWeightCompute || false,
                    includesBodyWeight: action.includesBodyWeight || false,
                    canonical_action_id: action.canonical_action_id ?? null,
                }));
                setActions(convertedActions);
            }
        } catch (error) {
            console.error('加载动作库失败:', error);
        } finally {
            setActionsLoading(false);
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

    return (
        <div className="mx-auto p-4">
            <Card className="shadow-sm mb-6 bg-surface-0 border border-surface-200/70 rounded-[24px]">
                <div className="border-b border-surface-200 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">编辑训练计划</h1>
                            <p className="text-600 mt-1">修改您的训练计划</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                label="批量操作"
                                icon="pi pi-sliders-h"
                                size="small"
                                className="p-button-outlined"
                                onClick={() => setBatchDialogVisible(true)}
                                disabled={saving}
                            />
                            <Button
                                label="AI 修改器"
                                icon="pi pi-bolt"
                                className="
                                    flex items-center gap-2 px-4 py-2 rounded-2xl
                                    bg-primary-50 border border-primary-200
                                    text-[12px] font-black text-primary-700 tracking-tight
                                    transition-all duration-200 active:scale-[0.95]
                                    hover:border-primary-400 hover:bg-primary-100 hover:shadow-sm
                                "
                                onClick={() => setAiBatchDialogVisible(true)}
                            />
                            <Button
                                label="取消"
                                icon="pi pi-times"
                                className="p-button-text"
                                onClick={() => router.back()}
                            />
                            <Button
                                label="保存计划"
                                icon="pi pi-check"
                                loading={saving}
                                onClick={handleSave}
                            />
                        </div>
                    </div>
                </div>

                <div className="p-4 md:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-700 mb-2">计划名称 *</label>
                            <InputText
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="例如：每周三练增肌计划"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-700 mb-2">计划描述</label>
                            <InputTextarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="描述这个计划的目标和特点..."
                                rows={1}
                                autoResize
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="mb-6">
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

                    {selectedDay && selectedDayIndex !== null && (
                        <PlanDayCard
                            day={selectedDay}
                            dayIndex={days.findIndex(d => d.dayIndex === selectedDay.dayIndex)}
                            actions={actions}
                            onDayTypeChange={handleDayTypeChange}
                            onRemoveDay={handleRemoveDay}
                            onNoteChange={handleNoteChange}
                            onAddActionSet={handleAddActionSet}
                            onRemoveActionSet={handleRemoveActionSet}
                            onActionSetChange={handleActionSetChange}
                            saving={saving}
                            totalDays={days.length}
                            onCopyFromDay={handleCopyFromDay}
                            existingTrainingDays={existingTrainingDays}
                        />
                    )}

                    {!selectedDay && days.length > 0 && (
                        <div className="text-center py-12 border-2 border-dashed border-surface-200 rounded-lg">
                            <i className="pi pi-calendar text-4xl text-surface-300 mb-3"></i>
                            <p className="text-600">请在上方日历中选择一天进行编辑</p>
                        </div>
                    )}
                </div>
            </Card>

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
