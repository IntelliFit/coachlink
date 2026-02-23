'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { Dialog } from 'primereact/dialog';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { Calendar } from 'lucide-react';

import { useParams, useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { actionLibService } from '@/app/service/actionLibService';
import { planLibService } from '@/app/service/planLibService';
import { CoachActionRow, ItemType } from '@/types';
import BasicInfoForm from '@/app/dashboard/plan-lib/components/BasicInfoForm';
import PlanDayCard from '@/app/dashboard/plan-lib/components/PlanDayCard';
import StickyScheduleBar from '@/app/dashboard/plan-lib/components/StickyScheduleBar';
import WeekCalendar from '@/app/dashboard/plan-lib/components/WeekCalendar';
import { ListActionsDto } from '@/app/api/action-lib/list-actions/entity';
import { GetTemplateDto } from '@/app/api/plan-lib/get-template/entity';
import { UpdateTemplateDto } from '@/app/api/plan-lib/update-template/entity';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { TrainingItem } from '@/types/questionnaires';
import { coachService } from '@/app/service/coachService';
import { checkTrainingDays, makeWeekDays } from '@/utils/template';
import SmartImportDialog from '@/app/dashboard/plan-lib/components/SmartImportDialog';
import BatchActionsDialog, { BatchOperation } from '@/app/dashboard/plan-lib/components/BatchActionsDialog';
import { BatchOperationDialog } from '@/components/BatchOperationDialog';
import {
    appendActionToDays,
    deleteActionInDays,
    isActionFullyCompatible,
    replaceActionInDays,
} from '@/lib/planBatchUtils';


const EditPlanPage = () => {
    const router = useRouter();
    const params = useParams();

    const { showToast } = useToastContext();
    const { data: session } = useSession();
    const coach = getCoach(session);

    // Plan template basic info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [suitableFor, setSuitableFor] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');
    const [weekDays, setWeekDays] = useState<number[]>([]);  // 新增
    const [globalAnswers, setGlobalAnswers] = useState<Record<string, number>>({});  // 新增

    // Days management
    const [days, setDays] = useState<FormPlanTrainingDay[]>([]);

    // Selected day for editing
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

    // Actions from library
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [questions, setQuestions] = useState<TrainingItem[]>([]);
    const [actionSearchId, setActionSearchId] = useState<string | null>(null);
    
    // Smart import dialog
    const [showImportDialog, setShowImportDialog] = useState(false);
    // Mobile day picker
    const [dayPickerVisible, setDayPickerVisible] = useState(false);
    const [batchDialogVisible, setBatchDialogVisible] = useState(false);
    const [aiBatchDialogVisible, setAiBatchDialogVisible] = useState(false);
    const [syncDialogVisible, setSyncDialogVisible] = useState(false);
    /** AI 修改器：收到 preview 前的原始 days，用于清空时恢复 */
    const [originalDaysBeforeAi, setOriginalDaysBeforeAi] = useState<FormPlanTrainingDay[] | null>(null);
    /** AI 修改器：高亮用 key，格式 dayIndex-actionName 或 dayIndex-day */
    const [aiModificationKeys, setAiModificationKeys] = useState<Set<string> | null>(null);
    const [syncInstances, setSyncInstances] = useState(true);

    // Load template data
    useEffect(() => {
        if (!coach?.id || !params.id) return;

        loadTemplate();
        loadQuestions();
    }, [coach?.id, params.id]);

    const loadTemplate = async () => {
        try {
            // Load actions first
            await loadActions();

            // Load template data
            const templateRes = await planLibService.getTemplate({
                id: params.id as string
            });

            if (templateRes) {
                // Fill form with template data
                setName(templateRes.template.name);
                setDescription(templateRes.template.description || '');
                setTags(templateRes.template.tags || []);
                setSuitableFor(templateRes.template.suitable_for as 'beginner' | 'intermediate' | 'advanced' || 'beginner');
                setWeekDays(templateRes.template.week_days || []);
                // 加载全局问题答案
                if (templateRes.template.global_answers) {
                    setGlobalAnswers(templateRes.template.global_answers as Record<string, number>);
                }

                // Convert days data to local format
                const convertedDays: FormPlanTrainingDay[] = templateRes.days.map((day: any) => ({
                    id: day.id,
                    dayIndex: day.dayIndex,
                    type: day.type as 'training' | 'rest',
                    note: day.note || '',
                    actionSets: day.actionSets || []
                })).sort((a, b) => a.dayIndex - b.dayIndex);

                setDays(convertedDays);
                setSelectedDayIndex(convertedDays.length > 0 ? convertedDays[0].dayIndex : null);
            }
        } catch (error) {
            console.error('加载训练计划模板失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载训练计划模板' });
        } finally {
            setLoading(false);
        }
    };

    const loadActions = async () => {
        const reqData: ListActionsDto = {
            page: 1,
            limit: 100
        };
        const res = await actionLibService.listActions(reqData);
        if (res) {
            setActions(res.actions);
        }
    };

    const loadQuestions = async () => {
        const res = await coachService.getQuestionnaires();
        if (res) {
            setQuestions(res.questionnaires || []);
        } else {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载问卷列表' });
        }
    };

    const handleAddWeek = () => {
        const currentLength = days.length;
        const newDays = [...days];

        // 添加7天，默认为休息日
        for (let i = 1; i <= 7; i++) {
            newDays.push({
                dayIndex: currentLength + i,
                type: 'rest', // 默认为休息日
                note: '',
                actionSets: []
            });
        }

        setDays(newDays);
    };

    const handleAddWeekFromExisting = (sourceWeekIndex: number) => {
        const currentLength = days.length;
        const newDays = [...days];

        // 获取源周的起始索引
        const sourceWeekStartIndex = sourceWeekIndex * 7;

        // 获取源周的7天数据
        const sourceWeekDays = days.slice(sourceWeekStartIndex, sourceWeekStartIndex + 7);

        // 如果源周不足7天，用默认休息日填充
        const fullWeekDays = [...sourceWeekDays];
        while (fullWeekDays.length < 7) {
            fullWeekDays.push({
                dayIndex: 0, // 临时索引，后面会重新计算
                type: 'rest',
                note: '',
                actionSets: []
            });
        }

        // 添加到新周，更新索引
        fullWeekDays.forEach((day, index) => {
            newDays.push({
                ...day,
                dayIndex: currentLength + index + 1
            });
        });

        setDays(newDays);
    };

    const handleDeleteWeek = (weekStartIndex: number) => {
        // 确保至少保留一周
        if (days.length <= 7) {
            showToast({ severity: 'warn', summary: '操作受限', detail: '至少需要保留一周' });
            return;
        }

        // 删除指定周的所有天数
        const newDays = [...days];
        newDays.splice(weekStartIndex, 7);

        // 重新索引
        const reindexedDays = newDays.map((day, index) => ({
            ...day,
            dayIndex: index + 1
        }));

        setDays(reindexedDays);

        // 如果选中的天被删除，选择第一天
        if (selectedDayIndex && selectedDayIndex > weekStartIndex && selectedDayIndex <= weekStartIndex + 7) {
            setSelectedDayIndex(reindexedDays.length > 0 ? reindexedDays[0].dayIndex : null);
        }
    };

    const handleRemoveDay = (index: number) => {
        if (days.length <= 1) return;

        const newDays = [...days];
        newDays.splice(index, 1);

        // Re-index days
        const reindexedDays = newDays.map((day, idx) => ({
            ...day,
            dayIndex: idx + 1
        }));

        setDays(reindexedDays);

        // 更新选中的天
        if (selectedDayIndex === index + 1) {
            setSelectedDayIndex(reindexedDays.length > 0 ? reindexedDays[0].dayIndex : null);
        } else {
            // 如果删除的是前面的天，需要调整选中索引
            if (selectedDayIndex && selectedDayIndex > index + 1) {
                setSelectedDayIndex(selectedDayIndex - 1);
            }
        }
    };

    const handleDayTypeChange = (index: number, type: 'training' | 'rest') => {
        const newDays = [...days];
        newDays[index] = {
            ...newDays[index],
            type,
            actionSets: type === 'rest' ? [] : newDays[index].actionSets
        };
        setDays(newDays);
    };

    const handleAddActionSet = (dayIndex: number, type: ItemType = 'STRENGTH') => {
        const newDays = [...days];
        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex);
        if (actualDayIndex === -1) return;

        let newItem: any = {
            type: 'no-filter',
            actionId: '',
            setName: '',
            params: {},
            itemType: type
        };

        // Initialize default values based on type
        switch (type) {
            case 'DIET':
                newItem.setName = 'Diet Item';
                newItem.actionId = ''; // Allow user to select template
                newItem.params = {
                    suggested_time: '08:00',
                    custom_data: {
                        content: '',
                        calories: 0
                    }
                };
                break;
            case 'CARDIO':
                newItem.setName = 'Cardio Item';
                newItem.actionId = ''; // Allow user to select template
                newItem.params = {
                    custom_data: {
                        content: '',
                        duration: 30 * 60, // 30 minutes in seconds
                        distance: 0,
                        pace: 0
                    }
                };
                break;
            case 'HABIT':
                newItem.setName = 'Habit Item';
                newItem.actionId = ''; // Allow user to select template
                newItem.params = {
                    custom_data: {
                        habit_name: '',
                        target_duration: 10
                    }
                };
                break;
            case 'STRENGTH':
            default:
                // Existing strength logic
                newItem.actionId = '';
                newItem.setName = '';
                newItem.params = {};
                break;
        }

        newDays[actualDayIndex].actionSets.push(newItem);
        setDays(newDays);
    };

    const handleRemoveActionSet = (dayIndex: number, setIndex: number) => {
        const newDays = [...days];
        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex + 1);
        if (actualDayIndex === -1) return;

        newDays[actualDayIndex].actionSets.splice(setIndex, 1);
        setDays(newDays);
    };

    const handleActionSetChange = (
        dayIndex: number,
        setIndex: number,
        field: string,
        value: string | number
    ) => {
        const newDays = [...days];

        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex + 1);

        if (actualDayIndex === -1) {
            return;
        }

        const actionSet = newDays[actualDayIndex].actionSets[setIndex];

        switch (field) {
            case 'actionId':
            case 'setName':
                actionSet[field] = value as string;
                break;
            case 'params':
                actionSet.params = { ...actionSet.params, ...(value as any) };
                break;
            case 'all':
                newDays[actualDayIndex].actionSets[setIndex] = value as any;
                break;
            default:
                throw new Error(`Unknown field: ${field}`);
        }

        setDays(newDays);
    };

    // 新增函数：处理从其他训练日复制动作集
    const handleCopyFromDay = (targetDayIndex: number, sourceDayIndex: number) => {
        const newDays = [...days];
        console.log(targetDayIndex, sourceDayIndex);

        const targetIndex = newDays.findIndex(d => d.dayIndex === targetDayIndex);
        const sourceIndex = newDays.findIndex(d => d.dayIndex === sourceDayIndex);

        if (targetIndex === -1 || sourceIndex === -1) {
            return;
        }

        // 复制源日的所有数据到目标日，包括类型
        newDays[targetIndex] = {
            ...newDays[targetIndex],
            type: newDays[sourceIndex].type, // 复制类型
            note: newDays[sourceIndex].note, // 复制备注
            actionSets: newDays[sourceIndex].actionSets.map(set => ({
                ...set,
            }))
        };

        setDays(newDays);
        showToast({ severity: 'success', summary: '复制成功', detail: `已从第${sourceDayIndex}天复制内容到第${targetDayIndex}天` });
    };

    const handleNoteChange = (dayIndex: number, note: string) => {
        const newDays = [...days];
        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex + 1);
        if (actualDayIndex === -1) {
            return;
        }

        newDays[actualDayIndex].note = note;
        setDays(newDays);
    }

    // 智能导入完成处理
    const handleImportComplete = async (
        importedDays: FormPlanTrainingDay[],
        importedGlobalDescription?: string | null,
    ) => {
        setDays(importedDays);
        // 导入会改变周结构，周训练日计数也需要同步更新（否则保存时可能还是旧的 weekDays）
        setWeekDays(makeWeekDays(importedDays as any));
        if (importedDays.length > 0) {
            setSelectedDayIndex(importedDays[0].dayIndex);
        }
        // 如果当前未填写描述，则用“全局说明”自动回填
        if (importedGlobalDescription?.trim()) {
            setDescription((prev) => (prev?.trim() ? prev : importedGlobalDescription.trim()));
        }
        showToast({ severity: 'success', summary: '导入成功', detail: `成功导入 ${importedDays.length} 天的训练计划（记得点击「保存模板」以生效）` });
        // 只刷新动作库以包含新创建的动作；不要 reload 模板，否则会把刚导入的数据覆盖回旧内容
        await loadActions();
    };

    const handleConfirmSave = async () => {
        if (!coach?.id || !params.id) return;

        if (!name.trim()) {
            showToast({ severity: 'error', summary: '保存失败', detail: '请输入模板名称' });
            return;
        }

        // Prepare data according to API format
        const daysData = days.map(day => ({
            dayIndex: day.dayIndex,
            type: day.type,
            note: day.note || null,
            actionSets: day.actionSets || []
        }));

        const validInfo = checkTrainingDays(daysData);

        if (!validInfo.valid) {
            showToast({ severity: 'error', summary: '保存失败', detail: validInfo.message, life: 10000 });
            return;
        }

        setSaving(true);
        try {
            await planLibService.updateTemplate({
                id: params.id as string,
                name,
                description: description || null,
                tags: tags,
                suitableFor: suitableFor,
                weekDays: weekDays,
                globalAnswers: globalAnswers,  // 新增
                trainingDays: daysData,
                syncInstances,
            });

            showToast({ severity: 'success', summary: '保存成功', detail: '训练计划模板已更新' });
            router.push('/dashboard/plan-lib');
        } catch (error) {
            console.error('更新模板失败:', error);
            showToast({ severity: 'error', summary: '保存失败', detail: '无法更新训练计划模板' });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = () => {
        if (saving) return;
        setSyncDialogVisible(true);
    };

    const handleBatchApply = (operation: BatchOperation) => {
        if (actions.length === 0) {
            showToast({ severity: 'info', summary: '暂无动作库', detail: '请先加载动作库' });
            return;
        }

        if (operation.type === 'replace') {
            const fromAction = actions.find(action => action.id === operation.fromActionId);
            const toAction = actions.find(action => action.id === operation.toActionId);
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
            return;
        }

        if (operation.type === 'delete') {
            const result = deleteActionInDays(days, operation.actionId);
            if (result.affectedSets === 0) {
                showToast({ severity: 'info', summary: '未删除', detail: '未找到可删除的动作' });
                return;
            }
            setDays(result.days);
            showToast({ severity: 'success', summary: '删除成功', detail: `共删除 ${result.affectedSets} 个动作` });
            return;
        }

        const targetAction = actions.find(action => action.id === operation.actionId);
        if (!targetAction) {
            showToast({ severity: 'error', summary: '追加失败', detail: '未找到目标动作' });
            return;
        }
        const result = appendActionToDays(
            days,
            targetAction,
            operation.weekStart,
            operation.weekEnd,
            operation.weekdays,
        );
        if (result.affectedSets === 0) {
            showToast({ severity: 'info', summary: '未追加', detail: '未命中符合条件的训练日' });
            return;
        }
        setDays(result.days);
        showToast({ severity: 'success', summary: '追加成功', detail: `共追加 ${result.affectedSets} 个动作` });
    };

    const handleAiBatchOperationSuccess = async () => {
        showToast({ severity: 'success', summary: 'AI 修改器成功', detail: '训练计划已更新' });
        setAiBatchDialogVisible(false);
        setOriginalDaysBeforeAi(null);
        setAiModificationKeys(null);
        await loadTemplate();
    };

    const handleAiPreviewResult = (data: { originalTrainingDays: any; updatedTrainingDays: any; modifications: any[] }) => {
        setOriginalDaysBeforeAi(JSON.parse(JSON.stringify(days)));
        const converted: FormPlanTrainingDay[] = (data.updatedTrainingDays || []).map((day: any) => ({
            dayIndex: day.dayIndex ?? 0,
            type: day.type || 'rest',
            note: day.note || '',
            actionSets: day.actionSets || [],
        })).sort((a: FormPlanTrainingDay, b: FormPlanTrainingDay) => a.dayIndex - b.dayIndex);
        setDays(converted);
        const keys = new Set<string>();
        for (const m of data.modifications || []) {
            const dayIdx = m.dayIndex;
            if (m.actionName === '整个训练日' || m.actionName === '训练日类型' || m.actionName === '备注') {
                keys.add(`${dayIdx}-day`);
            } else {
                keys.add(`${dayIdx}-${m.actionName}`);
            }
        }
        setAiModificationKeys(keys.size > 0 ? keys : null);
    };

    const handleAiRestart = () => {
        if (originalDaysBeforeAi) {
            setDays(originalDaysBeforeAi);
            setOriginalDaysBeforeAi(null);
        }
        setAiModificationKeys(null);
    };

    const actionSearchOptions = useMemo(
        () => actions.map(action => ({ label: action.name, value: action.id })),
        [actions]
    );

    const actionSearchResults = useMemo(() => {
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
    }, [days, actionSearchId]);

    // 获取选中的训练日
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

    const maxWeeks = Math.max(1, Math.ceil(days.length / 7));

    if (loading) {
        return (
            <div className="mx-auto">
                <div className="flex items-center justify-between mb-6">
                    {/* 标题 Skeleton */}
                    <Skeleton width="12rem" height="2rem" />

                    {/* 返回按钮 Skeleton */}
                    <Skeleton width="5rem" height="2rem" borderRadius="8px" />
                </div>

                <Card className="shadow-sm mb-6 p-5">
                    {/* 垂直布局（仿 /me/plan-lib/create） */}
                    <div className="flex flex-col gap-6">
                        {/* Week Calendar Skeleton */}
                        <div className="flex flex-col gap-3">
                            <Skeleton width="100%" height="2rem" />
                            <Skeleton width="100%" height="15rem" />
                            <Skeleton width="100%" height="2rem" />
                        </div>

                        {/* PlanDayCard Skeleton */}
                        <div className="flex flex-col gap-4">
                            <Skeleton width="40%" height="2rem" />
                            <Skeleton width="100%" height="12rem" />
                            <Skeleton width="100%" height="12rem" />
                            <Skeleton width="100%" height="12rem" />
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="mt-6 flex justify-end gap-2">
                        <Skeleton width="5rem" height="2.5rem" borderRadius="6px" />
                        <Skeleton width="8rem" height="2.5rem" borderRadius="6px" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className={`mx-auto pt-[calc(0.75rem+env(safe-area-inset-top)+3rem)] sm:pt-[calc(0.75rem+env(safe-area-inset-top)+3.25rem)] md:pt-[calc(0.75rem+env(safe-area-inset-top)+3.5rem)] ${aiBatchDialogVisible ? 'flex gap-0 min-h-0' : ''}`}>
            {/* 主编辑区域：桌面端 AI 面板打开时收缩宽度 */}
            <div className={`flex-1 min-w-0 ${aiBatchDialogVisible ? 'shrink' : ''}`}>
            {/* 页面头部：标题 + 操作工具栏 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-surface-900">编辑训练计划</h1>
                    <p className="text-sm text-surface-500 mt-1">编辑模板元信息与每日编排</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        label="AI 智能导入"
                        icon="pi pi-file-import"
                        className="
                            flex items-center gap-2 px-4 py-2 rounded-2xl
                            bg-surface-0 border border-surface-200
                            text-[12px] font-bold text-surface-700
                            hover:bg-surface-50 hover:border-surface-300
                            active:scale-[0.98] transition-all
                            disabled:opacity-40 disabled:cursor-not-allowed
                        "
                        text
                        onClick={() => setShowImportDialog(true)}
                        disabled={saving}
                        tooltip="从文本智能解析并导入训练计划"
                        tooltipOptions={{ position: 'bottom' }}
                    />
                    <Button
                        label="批量操作"
                        icon="pi pi-sliders-h"
                        className="
                            flex items-center gap-2 px-4 py-2 rounded-2xl
                            bg-surface-0 border border-surface-200
                            text-[12px] font-bold text-surface-700
                            hover:bg-surface-50 hover:border-surface-300
                            active:scale-[0.98] transition-all
                            disabled:opacity-40 disabled:cursor-not-allowed
                        "
                        text
                        onClick={() => setBatchDialogVisible(true)}
                        disabled={saving}
                        tooltip="替换、追加、删除动作"
                        tooltipOptions={{ position: 'bottom' }}
                    />
                    <Button
                        label="AI 修改器"
                        icon="pi pi-bolt"
                        className="
                            flex items-center gap-2 px-4 py-2 rounded-2xl
                            bg-primary-50 border border-primary-200
                            text-[12px] font-bold text-primary-700
                            hover:bg-primary-100 hover:border-primary-300
                            active:scale-[0.98] transition-all
                            disabled:opacity-40 disabled:cursor-not-allowed
                        "
                        text
                        onClick={() => setAiBatchDialogVisible(true)}
                        disabled={saving}
                        tooltip="用自然语言描述批量修改"
                        tooltipOptions={{ position: 'bottom' }}
                    />
                </div>
            </div>

            {/* 每日定义 */}
            <Card className="shadow-sm mb-6 bg-surface-0 border border-surface-100 rounded-3xl p-0 md:p-4">
                {/* 动作搜索 */}
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
                            disabled={saving || actions.length === 0}
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

                {/* 每一天动作列表编译器：选中日的详情编辑 */}
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
                        onActionSetChange={handleActionSetChange}
                        saving={saving}
                        totalDays={days.length}
                        onCopyFromDay={handleCopyFromDay}
                        existingTrainingDays={existingTrainingDays}
                        questions={questions}
                        highlightedModificationKeys={aiModificationKeys}
                    />
                ) : (
                    <div className="text-center py-12 border-2 border-dashed border-surface-200 rounded-lg">
                        <i className="pi pi-calendar text-4xl text-surface-300 mb-3"></i>
                        <p className="text-600">请在上方日历中选择一天进行编辑</p>
                    </div>
                )}
            </Card>

            {/* 模板定义（含 footer 保存/取消） */}
            <BasicInfoForm
                name={name}
                description={description}
                tags={tags}
                suitableFor={suitableFor}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onTagsChange={setTags}
                onSuitableForChange={setSuitableFor}
                saving={saving}
                onSave={handleSave}
                weekDays={weekDays}
                onWeekDaysChange={setWeekDays}
                globalQuestions={questions.filter(q => q.type === 'option' && q.scope === 'global') as any[]}
                globalAnswers={globalAnswers}
                onGlobalAnswerChange={(question, answerIndex) => {
                    setGlobalAnswers(prev => {
                        const next = { ...prev };
                        if (answerIndex === null) {
                            delete next[question];
                            return next;
                        }
                        next[question] = answerIndex;
                        return next;
                    });
                }}
                availableTrainingTags={
                    // 从问卷配置中提取 tags 问题的选项
                    (questions.find(q => q.type === 'tags') as any)?.options?.filter((o: string) => o.trim()) || []
                }
                hideHeader
            />
            <div className="mt-6 flex justify-end gap-2 mb-8">
                <Button
                    label="取消"
                    icon="pi pi-times"
                    onClick={() => router.back()}
                    className="p-button-text"
                    disabled={saving}
                />
                <Button
                    label="保存模板"
                    icon="pi pi-check"
                    className="p-button-primary shadow-lg shadow-primary-200 transition-transform active:scale-95 rounded-2xl px-6"
                    onClick={handleSave}
                    loading={saving}
                />
            </div>

            {/* 悬停在顶部的训练日选择条（替代原计划排期，当前模式下唯一顶部栏） */}
            <StickyScheduleBar
                days={days}
                selectedDayIndex={selectedDayIndex}
                onSelectDay={setSelectedDayIndex}
                onBack={() => router.back()}
                onAddWeek={handleAddWeek}
                saving={saving}
            />

            {/* 智能导入对话框 */}
            <SmartImportDialog
                visible={showImportDialog}
                onHide={() => setShowImportDialog(false)}
                existingActions={actions}
                onImportComplete={handleImportComplete}
                willOverwriteExisting={days.some(d => d.actionSets && d.actionSets.length > 0)}
            />

            {/* 传统批量操作对话框 */}
            <BatchActionsDialog
                visible={batchDialogVisible}
                onHide={() => setBatchDialogVisible(false)}
                actions={actions}
                maxWeeks={maxWeeks}
                onApply={handleBatchApply}
                disabled={saving}
            />

            </div>
            {/* AI 修改器：桌面端右侧推入面板（sticky 粘顶，滚动时保持可见），移动端弹窗 */}
            {params.id && aiBatchDialogVisible && (
                <div className="hidden md:flex md:w-[420px] lg:w-[480px] shrink-0 sticky top-[calc(1rem+70px)] self-start h-[calc(100vh-150px)] min-h-[480px] border-l border-surface-100 bg-surface overflow-hidden rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
                    <BatchOperationDialog
                        visible={aiBatchDialogVisible}
                        onHide={() => setAiBatchDialogVisible(false)}
                        templateId={params.id as string}
                        targetActionType="coach"
                        contextOptions={{
                            // 默认仅必要：教练动作库+公共动作库；模板库/匹配等由用户自行勾选
                            includeStudentProfile: false,
                            includeStudentQuestionnaire: false,
                            includeExecutionHistory: false,
                            includeFeedbacks: false,
                            includeStudentActionLib: false,
                            includeCoachActionLib: true,
                            includePublicActionLib: true,
                            includeCoachTemplates: false,
                            includeTemplateMatch: false,
                        }}
                        existingActions={actions}
                        onSuccess={handleAiBatchOperationSuccess}
                        variant="auto"
                        onPreviewResult={handleAiPreviewResult}
                        onRestart={handleAiRestart}
                        onGetDaysToApply={() => days}
                    />
                </div>
            )}

            <Dialog
                header="保存模板"
                visible={syncDialogVisible}
                onHide={() => setSyncDialogVisible(false)}
                modal
                style={{ width: '90vw', maxWidth: '520px' }}
                className="aero-dialog"
                contentClassName="p-0 border-t border-surface-100"
                footer={
                    <div className="flex justify-end gap-2 px-4 py-3 border-t border-surface-100 bg-surface">
                        <Button
                            label="取消"
                            className="p-button-text"
                            onClick={() => setSyncDialogVisible(false)}
                            disabled={saving}
                        />
                        <Button
                            label="保存"
                            className="p-button-primary"
                            onClick={() => {
                                setSyncDialogVisible(false);
                                handleConfirmSave();
                            }}
                            loading={saving}
                        />
                    </div>
                }
            >
                <div className="flex flex-col gap-4 p-5">
                    <div className="text-sm text-surface-600 leading-relaxed">
                        是否同步到已使用该模板的计划？同步会覆盖这些计划的训练内容。
                    </div>
                    <label className="flex items-center gap-2 text-sm text-surface-700 font-medium">
                        <Checkbox
                            checked={syncInstances}
                            onChange={(e) => setSyncInstances(!!e.checked)}
                        />
                        同步到已使用该模板的计划（默认）
                    </label>
                </div>
            </Dialog>

            {/* 手机端：随时切换训练日（无需回到顶部） */}
            <div className="lg:hidden fixed right-4 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-40">
                <button
                    type="button"
                    onClick={() => setDayPickerVisible(true)}
                    className="
                        flex items-center gap-2 px-4 py-3
                        bg-surface/95 backdrop-blur-md border border-surface-200/70
                        rounded-full shadow-[0_14px_36px_rgba(0,0,0,0.16)]
                        text-[12px] font-black text-surface-800
                        active:scale-[0.98] transition-transform
                    "
                >
                    <Calendar size={16} />
                    <span className="whitespace-nowrap">切换训练日</span>
                </button>
            </div>

            <Dialog
                visible={dayPickerVisible}
                onHide={() => setDayPickerVisible(false)}
                header={null}
                modal
                blockScroll
                dismissableMask
                draggable={false}
                resizable={false}
                style={{
                    width: '100vw',
                    maxWidth: '640px',
                    position: 'fixed',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    bottom: '0',
                    margin: 0
                }}
                contentClassName="p-0 pb-3 rounded-t-3xl overflow-hidden"
            >
                <div className="p-4 border-b border-surface-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-black text-surface-800">
                        <Calendar size={16} />
                        选择训练日
                    </div>
                    <button
                        className="text-[12px] font-bold text-primary-600"
                        onClick={() => setDayPickerVisible(false)}
                    >
                        关闭
                    </button>
                </div>
                <div className="p-3 max-h-[70vh] overflow-auto">
                    <WeekCalendar
                        days={days}
                        selectedDayIndex={selectedDayIndex}
                        onSelectDay={(dayIdx) => {
                            setSelectedDayIndex(dayIdx);
                            setDayPickerVisible(false);
                        }}
                        onAddWeek={handleAddWeek}
                        onAddWeekFromExisting={handleAddWeekFromExisting}
                        onDeleteWeek={handleDeleteWeek}
                        saving={saving}
                    />
                </div>
            </Dialog>
        </div>
    );
};

export default EditPlanPage;