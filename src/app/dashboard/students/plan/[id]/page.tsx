'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { Dialog } from 'primereact/dialog';

import { useParams, useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { actionLibService } from '@/app/service/actionLibService';
import { planLibService } from '@/app/service/planLibService';
import { CoachActionRow, CoachPlanInstanceRow, ItemType } from '@/types';
import BasicInfoForm from '@/app/dashboard/plan-lib/components/BasicInfoForm';
import PlanDayCard from '@/app/dashboard/plan-lib/components/PlanDayCard';
import WeekCalendar from '@/app/dashboard/plan-lib/components/WeekCalendar';
import { ListActionsDto } from '@/app/api/action-lib/list-actions/entity';
import { GetInstanceDto } from '@/app/api/plan-lib/get-instance/entity';
import { coachService } from '@/app/service/coachService';
import SelectTemplateDialog from './components/SelectTemplateDialog';
import { GetTemplateResponseDto } from '@/app/api/plan-lib/get-template/entity';
import { StudentProfilePanel } from './components/StudentProfilePanel';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { PlanStartConfigDialog, PlanStartConfig } from './components/PlanStartConfigDialog';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import { subscriptionService } from '@/app/service/subscriptionService';
import StudentPlanExecutionView from './components/StudentPlanExecutionView';
import BatchActionsDialog, { BatchOperation } from '@/app/dashboard/plan-lib/components/BatchActionsDialog';
import CoachOneRMConfigPanel from './components/CoachOneRMConfigPanel';
import {
    appendActionToDays,
    deleteActionInDays,
    isActionFullyCompatible,
    replaceActionInDays,
} from '@/lib/planBatchUtils';
import QuestionnaireForm from '@/app/coach/profile/[id]/QuestionnaireForm';
import type { TrainingItem } from '@/types/questionnaires';
import type { FeedbackItem } from '@/app/api/coach/get-student-feedbacks/entity';
import StudentFeedbackPanel from './components/StudentFeedbackPanel';
import { BatchOperationDialog } from '@/components/BatchOperationDialog';

const StudentPlanPage = () => {
    const router = useRouter();
    const params = useParams();

    const { showToast } = useToastContext();
    const { data: session } = useSession();
    const coach = getCoach(session);

    // Plan instance basic info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [type, setType] = useState<string | null>(null);
    const [suitableFor, setSuitableFor] = useState<'beginner' | 'intermediate' | 'advanced'>('beginner');

    // Days management
    const [days, setDays] = useState<FormPlanTrainingDay[]>([]);

    // Subscription data
    const [subscription, setSubscription] = useState<any>(null);

    // Selected day for editing
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

    // Actions from library
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [instanceExists, setInstanceExists] = useState(false);
    const [selectTemplateDialogVisible, setSelectTemplateDialogVisible] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
    const [instanceId, setInstanceId] = useState<string | null>(null);
    const [rawInstance, setRawInstance] = useState<CoachPlanInstanceRow>(null);
    const [batchDialogVisible, setBatchDialogVisible] = useState(false);
    const [aiBatchDialogVisible, setAiBatchDialogVisible] = useState(false);
    const [originalDaysBeforeAi, setOriginalDaysBeforeAi] = useState<FormPlanTrainingDay[] | null>(null);

    // Student data
    const [studentData, setStudentData] = useState<GetStudentResponseDto['student'] | null>(null);
    const [studentDataLoading, setStudentDataLoading] = useState(false);

    // Execution data
    const [executions, setExecutions] = useState<Record<number, any>>({});
    const [executionActions, setExecutionActions] = useState<Record<string, any>>({});

    // 起始执行天数（用于显示"开始"标记）
    const [startExecutionDay, setStartExecutionDay] = useState<number | undefined>(undefined);

    // 问卷编辑对话框
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);

    // 计划导入配置
    const [planStartConfigVisible, setPlanStartConfigVisible] = useState(false);
    const [pendingTemplate, setPendingTemplate] = useState<GetTemplateResponseDto | null>(null);
    const [customStartDate, setCustomStartDate] = useState<Date | null>(null);
    const [importStartConfig, setImportStartConfig] = useState<PlanStartConfig | null>(null);
    const [importModeDialogVisible, setImportModeDialogVisible] = useState(false);
    // 默认应为"覆盖更新"，否则教练在已有进行中计划上点击"更新计划"会误触发"新建阶段"，导致学员进度回到第1天
    const [importMode, setImportMode] = useState<'new_instance' | 'overwrite'>('overwrite');

    // 学员训练反馈
    const [studentFeedbacks, setStudentFeedbacks] = useState<FeedbackItem[]>([]);
    const [feedbackUnreadCount, setFeedbackUnreadCount] = useState(0);
    const [aiFeedbackInstruction, setAiFeedbackInstruction] = useState<string | undefined>(undefined);

    // Load instance data
    useEffect(() => {
        if (!coach?.id || !params.id) return;

        const loadData = async () => {
            try {
                setLoading(true);
                setStudentDataLoading(true);

                // 防止“上一份计划的执行记录”残留到当前页面（尤其是当前无 active 计划时）
                setExecutions({});
                setExecutionActions({});
                setRawInstance(null);

                // 1. 定义所有并发任务
                const actionsPromise = actionLibService.listActions({ page: 1, limit: 100 });
                const studentPromise = coachService.getStudent({ subscriptionId: params.id.toString(), need1RM: true });
                const instancePromise = planLibService.getInstance({ subscriptionId: params.id as string });
                const executionPromise = planLibService.getWithExecutions({ subscriptionId: params.id as string });

                // 2. 使用 Promise.all 并行请求
                // 注意：有些接口报错不应中断整个流程（如 execution 可能为空），所以需处理 catch
                const [actionsRes, studentRes, instanceRes, exeRes] = await Promise.all([
                    actionsPromise.catch(e => (console.error('Actions load failed', e), null)),
                    studentPromise.catch(e => (console.error('Student load failed', e), null)),
                    instancePromise.catch(e => (console.error('Instance load failed', e), null)),
                    executionPromise.catch(e => (console.error('Execution load failed', e), null))
                ]);

                // 3. 先记录动作库结果，后续会与实例内 actions 映射合并
                const baseActions: CoachActionRow[] = (actionsRes?.actions || []) as CoachActionRow[];

                // 4. 处理 Student Data
                if (studentRes?.student) {
                    setStudentData(studentRes.student);
                }
                setStudentDataLoading(false);

                // 5. 处理 Instance (训练计划详情)
                if (instanceRes?.instance) {
                    const instance = instanceRes.instance;
                    // 仅在 active 时作为“当前计划”展示（completed 走历史页，不在当前编辑页展示执行记录）
                    setRawInstance(instance.status === 'active' || instance.status === 'paused' ? instance : null);

                    if (instance.status === 'active') {
                        setInstanceExists(true);
                        setInstanceId(instance.id);
                        setName(instance.name);
                        setDescription(instance.description || '');

                        const convertedDays = (instance.training_days || []).map((day: any) => ({
                            id: day.id,
                            dayIndex: day.dayIndex,
                            type: day.type,
                            note: day.note || '',
                            actionSets: day.actionSets || []
                        })).sort((a, b) => a.dayIndex - b.dayIndex);

                        setDays(convertedDays);
                        if (convertedDays.length > 0) setSelectedDayIndex(convertedDays[0].dayIndex);
                        if (instance.start_execution_day > 1) setStartExecutionDay(instance.start_execution_day);
                    } else if (instance.status === 'completed') {
                        showToast({ severity: 'info', summary: '计划已完成', detail: '请为学员创建新阶段计划' });
                        setInstanceExists(false);
                        // 当前计划已完成：清空编辑区（避免显示旧内容）
                        setInstanceId(null);
                        setDays([]);
                        setSelectedDayIndex(null);
                    }
                }

                // 5.1 合并动作来源：
                // - 教练动作库（action-lib/list-actions）
                // - 当前计划实例返回的 actions 映射（可能包含“非当前教练动作库”的历史动作）
                // 这样可避免教练页出现“未选定动作”，但学员页正常的分裂表现。
                const mergedActionMap = new Map<string, CoachActionRow>();
                baseActions.forEach((a) => {
                    if (a?.id) mergedActionMap.set(a.id, a);
                });
                const instanceActions = (instanceRes?.actions || {}) as Record<string, CoachActionRow>;
                Object.values(instanceActions).forEach((a) => {
                    if (!a?.id) return;
                    if (!mergedActionMap.has(a.id)) {
                        mergedActionMap.set(a.id, a);
                    }
                });
                setActions(Array.from(mergedActionMap.values()));

                // 6. 处理 Executions (执行记录)
                if (exeRes?.executions) {
                    setExecutions(exeRes.executions);
                }
                if (exeRes?.actions) {
                    setExecutionActions(exeRes.actions);
                }

                // 7. 异步加载学员反馈（不阻塞主流程）
                if (instanceRes?.instance?.id && instanceRes.instance.status === 'active') {
                    coachService.getStudentFeedbacks({
                        instanceId: instanceRes.instance.id,
                        markRead: true,
                    }).then((fbRes) => {
                        if (fbRes) {
                            setStudentFeedbacks(fbRes.feedbacks);
                            setFeedbackUnreadCount(fbRes.unread_count);
                        }
                    }).catch((e) => console.warn('Feedbacks load failed', e));
                }

            } catch (error) {
                console.error('加载训练页面失败:', error);
                showToast({ severity: 'error', summary: '加载失败', detail: '无法获取完整学员数据' });
            } finally {
                setLoading(false);
                setStudentDataLoading(false);
            }
        };

        const loadSubscription = async () => {
            const res = await subscriptionService.getSubscription({
                id: params.id as string
            });

            if (res?.subscription) {
                setSubscription(res.subscription);
            }
        }

        loadData();
        loadSubscription();
    }, [coach?.id, params.id]);

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
        if (!newDays[dayIndex]) return;

        const actualDayIndex = dayIndex;

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

        const actualDayIndex = dayIndex;

        if (!newDays[actualDayIndex]) {
            return;
        }

        const actionSet = newDays[actualDayIndex].actionSets[setIndex];

        switch (field) {
            case 'actionId':
            case 'setName':
                actionSet[field] = value as string;
                break;
            case 'params':
                actionSet.params = { ...(actionSet.params || {}), ...(value as any) };
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

        const targetIndex = newDays.findIndex(d => d.dayIndex === targetDayIndex);
        const sourceIndex = newDays.findIndex(d => d.dayIndex === sourceDayIndex);

        if (targetIndex === -1 || sourceIndex === -1) {
            return;
        }

        newDays[targetIndex] = {
            ...newDays[targetIndex],
            type: newDays[sourceIndex].type,
            note: newDays[sourceIndex].note,
            actionSets: newDays[sourceIndex].actionSets
        };

        setDays(newDays);
        showToast({ severity: 'success', summary: '复制成功', detail: `已从第${sourceDayIndex}天复制内容到第${targetDayIndex}天` });
    };

    const handleNoteChange = (dayIndex: number, note: string) => {
        const newDays = [...days];

        if (!newDays[dayIndex]) {
            return;
        }

        const actualDayIndex = dayIndex;

        newDays[actualDayIndex].note = note;
        setDays(newDays);
    }

    // ==================== 自动保存机制 ====================
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const isInitialLoadRef = useRef(true);
    
    // 标记有未保存的更改
    useEffect(() => {
        // 跳过初始加载
        if (isInitialLoadRef.current) {
            return;
        }
        // 只有在实例已存在时才追踪更改
        if (instanceExists && instanceId && days.length > 0) {
            setHasUnsavedChanges(true);
            setAutoSaveStatus('pending');
        }
    }, [days, instanceExists, instanceId]);
    
    // 初始加载完成后设置标记
    useEffect(() => {
        if (!loading && instanceExists) {
            // 给一点延迟，确保所有状态都已设置好
            const timer = setTimeout(() => {
                isInitialLoadRef.current = false;
            }, 1000);
            return () => clearTimeout(timer);
        }
    }, [loading, instanceExists]);

    // 执行静默自动保存（不跳转页面，不显示 toast）
    const performAutoSave = useCallback(async () => {
        if (!coach?.id || !params.id || !instanceExists || !instanceId || !name.trim()) {
            return;
        }

        setAutoSaveStatus('saving');
        
        const daysData = days.map(day => ({
            dayIndex: day.dayIndex,
            type: day.type,
            note: day.note || null,
            actionSets: day.actionSets || []
        }));

        try {
            const res = await planLibService.updateInstance({
                id: instanceId,
                name,
                description: description || null,
                tags: tags || null,
                type: type || null,
                suitableFor: suitableFor || null,
                trainingDays: daysData,
                startExecutionDay: importStartConfig ? ((importStartConfig.startWeek - 1) * 7 + importStartConfig.startDay) : undefined,
            });

            if (res) {
                setAutoSaveStatus('saved');
                setHasUnsavedChanges(false);
                // If this autosave includes an import start config, clear it after first successful persist
                if (importStartConfig) {
                    setImportStartConfig(null);
                }
                // 3秒后恢复空闲状态
                setTimeout(() => setAutoSaveStatus('idle'), 3000);
            } else {
                setAutoSaveStatus('error');
            }
        } catch (error) {
            console.error('自动保存失败:', error);
            setAutoSaveStatus('error');
        }
    }, [coach?.id, params.id, instanceExists, instanceId, name, description, tags, type, suitableFor, days]);

    // 防抖自动保存 - 2秒后自动保存
    useEffect(() => {
        if (!hasUnsavedChanges || !instanceExists || !instanceId) {
            return;
        }

        // 清除之前的定时器
        if (autoSaveTimeoutRef.current) {
            clearTimeout(autoSaveTimeoutRef.current);
        }

        // 设置新的定时器
        autoSaveTimeoutRef.current = setTimeout(() => {
            performAutoSave();
        }, 2000);

        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, [hasUnsavedChanges, instanceExists, instanceId, performAutoSave]);
    // ==================== 自动保存机制结束 ====================

    const handleSave = async () => {
        if (!coach?.id || !params.id) return;

        if (!name.trim()) {
            showToast({ severity: 'error', summary: '保存失败', detail: '请输入计划名称' });
            return;
        }

        setSaving(true);
        // Prepare data according to API format
        const daysData = days.map(day => ({
            dayIndex: day.dayIndex,
            type: day.type,
            note: day.note || null,
            actionSets: day.actionSets || []
        }));

        const shouldCreateNewInstance =
            (!instanceExists || !instanceId) || (instanceExists && instanceId && importMode === 'new_instance');

        if (!shouldCreateNewInstance && instanceExists && instanceId) {
            // Overwrite current instance (keeps executions)
            const res = await planLibService.updateInstance({
                id: instanceId, // Use the actual instance ID, not subscription ID
                name,
                description: description || null,
                tags: tags || null,
                type: type || null,
                suitableFor: suitableFor || null,
                templateId: selectedTemplateId || undefined,
                trainingDays: daysData,
                startExecutionDay: importStartConfig ? ((importStartConfig.startWeek - 1) * 7 + importStartConfig.startDay) : undefined,
            });

            if (res) {
                showToast({ severity: 'success', summary: '保存成功', detail: '训练计划已更新' });
                if (importStartConfig) setImportStartConfig(null);
            } else {
                showToast({ severity: 'error', summary: '保存失败', detail: '无法更新训练计划' });
            }
        } else {
            // Create new instance (archives previous active/paused instances server-side)
            const res = await planLibService.createInstance({
                templateId: selectedTemplateId,
                subscriptionId: params.id.toString(),
                name,
                description: description || null,
                tags: tags || null,
                type: type || null,
                suitableFor: suitableFor || null,
                trainingDays: daysData,
                startDate: customStartDate ? customStartDate.toISOString() : undefined,
                startWeek: importStartConfig?.startWeek,
                startDay: importStartConfig?.startDay,
            });

            if (res) {
                setInstanceExists(true);
                showToast({ severity: 'success', summary: '创建成功', detail: '训练计划已创建' });
            } else {
                showToast({ severity: 'error', summary: '创建失败' });
            }
        }

        // Reset import mode after save:
        // - 已有计划：回到 overwrite，避免下一次误触发新建阶段导致进度重置
        // - 无计划（首次创建）：保持默认 overwrite（后续再编辑即为覆盖更新）
        setImportMode('overwrite');

        router.push('/dashboard/students');

        setSaving(false);
    };

    const confirmCancel = () => {
        confirmDialog({
            message: '确定要离开页面吗？未保存的更改将会丢失。',
            header: '确认取消',
            icon: 'pi pi-exclamation-triangle',
            accept: () => router.push('/dashboard/students'),
            reject: () => { }
        });
    };

    // 新增函数：处理选择模板
    // 新增函数：处理选择模板 -> 弹出配置框
    const handleSelectTemplate = (templateData: GetTemplateResponseDto) => {
        setPendingTemplate(templateData);
        // If there's already an active plan instance, importing a template can either:
        // - overwrite current plan (keep executions)
        // - create a new phase (archive old, executions reset)
        if (instanceExists && instanceId) {
            setImportModeDialogVisible(true);
        } else {
            setImportMode('new_instance');
        setPlanStartConfigVisible(true);
        }
    };

    // 确认配置并应用模板
    const handleConfirmPlanStart = (config: PlanStartConfig) => {
        if (!pendingTemplate) return;

        setPlanStartConfigVisible(false);
        setImportStartConfig(config);
        // Show "开始" marker immediately in coach UI
        const startExecutionDay = (config.startWeek - 1) * 7 + config.startDay;
        setStartExecutionDay(startExecutionDay > 1 ? startExecutionDay : undefined);

        // 1. 计算回推的开始日期
        // 如果选择从第W周第D天开始，说明前 (W-1)*7 + (D-1) 天已经过去了
        const today = new Date();
        const daysToSubtract = (config.startWeek - 1) * 7 + (config.startDay - 1);
        
        if (daysToSubtract > 0) {
            const startDate = new Date(today);
            startDate.setDate(today.getDate() - daysToSubtract);
            setCustomStartDate(startDate);
        } else {
            setCustomStartDate(null);
        }

        // 2. 应用模板数据
        const templateData = pendingTemplate;
        const studentNameRaw =
            (studentData?.profile?.nickname || studentData?.profile?.full_name || "学员").trim();
        const studentName = studentNameRaw || "学员";
        setName(`${studentName}的计划`);
        setDescription(templateData.template.description || '');
        setTags(templateData.template.tags || []);
        setType(templateData.template.type);
        setSuitableFor(templateData.template.suitable_for as 'beginner' | 'intermediate' | 'advanced');
        setSelectedTemplateId(templateData.template.id);

        // 转换训练日数据
        const convertedDays: FormPlanTrainingDay[] = (templateData.days || [])
            .sort((a: FormPlanTrainingDay, b: FormPlanTrainingDay) => a.dayIndex - b.dayIndex);

        setDays(convertedDays);
        setSelectedDayIndex(convertedDays.length > 0 ? convertedDays[0].dayIndex : null);
        
        setPendingTemplate(null);
    };

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

    // 从 aggregated1RM 构建 planReference1RMs，按教练动作 ID 映射，供 PlanDayCard 计算训练重量
    const planReference1RMs = useMemo(() => {
        const map: Record<string, number> = {};
        const agg = studentData?.aggregated1RM;
        if (!agg) return map;
        for (const action of actions) {
            const val = (action.canonical_action_id ? agg[action.canonical_action_id] : undefined)
                ?? agg[action.name]
                ?? agg[action.id];
            if (val != null) map[action.id] = val;
        }
        return map;
    }, [studentData?.aggregated1RM, actions]);

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

    const handleAiPreviewResult = (data: { updatedTrainingDays: any[] }) => {
        setOriginalDaysBeforeAi(JSON.parse(JSON.stringify(days)));
        const converted: FormPlanTrainingDay[] = (data.updatedTrainingDays || []).map((day: any) => ({
            id: day.id,
            dayIndex: day.dayIndex ?? 0,
            type: day.type || 'rest',
            note: day.note || '',
            actionSets: day.actionSets || [],
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
            id: day.id,
            dayIndex: day.dayIndex ?? 0,
            type: day.type || 'rest',
            note: day.note || '',
            actionSets: day.actionSets || [],
        })).sort((a, b) => a.dayIndex - b.dayIndex);
        setDays(converted);
        if (converted.length > 0) setSelectedDayIndex(converted[0].dayIndex);
        showToast({ severity: 'success', summary: 'AI 修改器成功', detail: '修改已应用到当前草稿，请点击更新计划保存' });
    };

    const handleAiBatchOperationSuccess = async () => {
        setAiBatchDialogVisible(false);
        setOriginalDaysBeforeAi(null);
        setActions((prev) => [...prev]);
        const actionsRes = await actionLibService.listActions({ page: 1, limit: 100 });
        if (actionsRes?.actions) {
            setActions(actionsRes.actions as CoachActionRow[]);
        }
    };

    // 根据学员反馈自动打开 AI 修改器
    const handleAiSuggestFromFeedbacks = () => {
        if (studentFeedbacks.length === 0) return;

        const DIFFICULTY_MAP: Record<number, string> = {
            1: '太轻松', 2: '轻松', 3: '刚好', 4: '有点难', 5: '太难了',
        };

        const feedbackSummary = studentFeedbacks
            .slice(0, 10) // 最多取最近10条
            .map((fb) => {
                const diffLabel = fb.difficulty_rating ? `（难度：${DIFFICULTY_MAP[fb.difficulty_rating] || fb.difficulty_rating}）` : '';
                return `- 第${fb.day_index}天${diffLabel}：${fb.content}`;
            })
            .join('\n');

        const instruction = `以下是学员最近的训练反馈，请根据这些反馈对计划进行合理调整：\n\n${feedbackSummary}\n\n请根据以上反馈，适当调整训练计划中的动作、组数、次数或重量，使计划更适合学员当前状态。`;

        setAiFeedbackInstruction(instruction);
        setAiBatchDialogVisible(true);
    };

    // 打开问卷编辑对话框
    const handleOpenQuestionnaire = async () => {
        if (!subscription?.coach_id) {
            showToast({ severity: 'error', summary: '无法获取教练信息' });
            return;
        }

        setQuestionnaireLoading(true);
        try {
            const qRes = await coachService.getQuestionnaires({
                coachId: subscription.coach_id
            });

            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                showToast({ severity: 'info', summary: '该教练暂无问卷配置' });
            }
        } catch (error) {
            console.error('获取问卷失败:', error);
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    // 保存问卷修改
    const handleSaveQuestionnaire = async (answers: TrainingItem[]) => {
        if (!subscription?.id) {
            showToast({ severity: 'error', summary: '无法找到订阅信息' });
            return;
        }

        try {
            const res = await subscriptionService.updateQuestionnaire({
                id: subscription.id,
                questionnaires: answers
            });

            if (res) {
                showToast({ severity: 'success', summary: '问卷更新成功' });
                setQuestionnaireVisible(false);

                // 刷新学员数据
                const studentRes = await coachService.getStudent({ subscriptionId: params.id.toString(), need1RM: true });
                if (studentRes) {
                    setStudentData(studentRes.student);
                }
            } else {
                showToast({ severity: 'error', summary: '问卷更新失败' });
            }
        } catch (error) {
            console.error('保存问卷失败:', error);
            showToast({ severity: 'error', summary: '保存问卷失败' });
        }
    };

    if (loading) {
        return (
            <div className="mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <Skeleton width="12rem" height="2rem" />
                    <Skeleton width="5rem" height="2rem" borderRadius="8px" />
                </div>

                <Card className="shadow-sm mb-6 p-5">
                    {/* 第一行：3 列布局 */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
                        {/* 左侧 Week Calendar Skeleton */}
                        <div className="flex flex-col gap-3">
                            <Skeleton width="100%" height="2rem" />
                            <Skeleton width="100%" height="15rem" />
                            <Skeleton width="100%" height="2rem" />
                        </div>

                        {/* 右侧 PlanDayCard Skeleton */}
                        <div className="lg:col-span-2 flex flex-col gap-4">
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
        <div className="flex h-[fit-content]">
            {/* 主编辑区域 */}
            <div className="flex-1 p-3 sm:p-4">
                <ConfirmDialog />
                <SelectTemplateDialog
                    visible={selectTemplateDialogVisible}
                    onHide={() => setSelectTemplateDialogVisible(false)}
                    onSelectTemplate={handleSelectTemplate}
                    coachId={coach?.id || ''}
                />
                
                <PlanStartConfigDialog 
                    visible={planStartConfigVisible}
                    onHide={() => {
                        setPlanStartConfigVisible(false);
                        setPendingTemplate(null);
                    }}
                    onConfirm={handleConfirmPlanStart}
                    totalWeeks={pendingTemplate ? Math.ceil((pendingTemplate.days?.length || 0) / 7) : 12}
                />

                {/* 导入模板时的模式选择：覆盖当前 vs 新建阶段 */}
                <Dialog
                    visible={importModeDialogVisible}
                    onHide={() => {
                        setImportModeDialogVisible(false);
                        setPendingTemplate(null);
                    }}
                    header={<span className="tracking-tight font-bold text-surface-900 text-lg">导入方式</span>}
                    style={{ width: '95vw', maxWidth: '520px' }}
                    className="aero-dialog"
                    pt={{
                        root: { className: 'rounded-[24px] border-none shadow-2xl bg-surface overflow-hidden' },
                        header: { className: 'p-6 pb-0 border-none' },
                        content: { className: 'p-6 pt-4' }
                    }}
                    blockScroll
                    modal
                >
                    <div className="space-y-4">
                        <div className="text-sm text-surface-600 leading-relaxed">
                            当前订阅下已经存在一份进行中的计划。导入模板时你可以选择：
                            <br />
                            <span className="font-bold">新建阶段</span>：归档旧计划并创建新计划（执行次数会从 0 开始）
                            <br />
                            <span className="font-bold">覆盖当前</span>：直接覆盖当前计划内容（会保留历史执行记录，所以“已完成X次训练”不会清零）
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                label="覆盖当前（保留执行记录）"
                                className="p-button-text"
                                onClick={() => {
                                    setImportMode('overwrite');
                                    setImportModeDialogVisible(false);
                                    setPlanStartConfigVisible(true);
                                }}
                            />
                            <Button
                                label="新建阶段（推荐）"
                                className="p-button-primary"
                                onClick={() => {
                                    setImportMode('new_instance');
                                    setImportModeDialogVisible(false);
                                    setPlanStartConfigVisible(true);
                                }}
                            />
                        </div>
                    </div>
                </Dialog>

                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-900">
                        {studentData?.profile?.nickname ? `${studentData?.profile?.nickname}的训练计划` : '学员训练计划'}
                    </h1>
                    <Button
                        label="取消"
                        icon="pi pi-arrow-left"
                        onClick={confirmCancel}
                        className="p-button-text"
                        disabled={saving}
                    />
                </div>

                {/* 学员信息面板 */}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                    <StudentProfilePanel
                        studentData={studentData}
                        subscription={subscription}
                        loading={studentDataLoading}
                    />

                    <StudentPlanExecutionView
                        subscriptionId={params.id as string}
                        instance={rawInstance}
                        executions={executions}
                        actionsMap={executionActions}
                        loading={loading}
                        planName={name || '学员训练计划'}
                        planDescription={description}
                        isCompleted={false}
                    />

                    {/* 学员训练反馈面板 */}
                    <StudentFeedbackPanel
                        feedbacks={studentFeedbacks}
                        unreadCount={feedbackUnreadCount}
                        onAiSuggest={handleAiSuggestFromFeedbacks}
                    />
                </div>


                {/* 自动保存状态指示器 */}
                {instanceExists && autoSaveStatus !== 'idle' && (
                    <div className={`flex items-center justify-end gap-2 mb-2 text-xs font-medium transition-all ${
                        autoSaveStatus === 'pending' ? 'text-surface-400' :
                        autoSaveStatus === 'saving' ? 'text-blue-500' :
                        autoSaveStatus === 'saved' ? 'text-green-500' :
                        autoSaveStatus === 'error' ? 'text-red-500' : ''
                    }`}>
                        {autoSaveStatus === 'pending' && (
                            <>
                                <i className="pi pi-clock text-xs" />
                                <span>有未保存的更改...</span>
                            </>
                        )}
                        {autoSaveStatus === 'saving' && (
                            <>
                                <i className="pi pi-spin pi-spinner text-xs" />
                                <span>正在自动保存...</span>
                            </>
                        )}
                        {autoSaveStatus === 'saved' && (
                            <>
                                <i className="pi pi-check-circle text-xs" />
                                <span>已自动保存</span>
                            </>
                        )}
                        {autoSaveStatus === 'error' && (
                            <>
                                <i className="pi pi-exclamation-circle text-xs" />
                                <span>自动保存失败</span>
                            </>
                        )}
                    </div>
                )}

                <BasicInfoForm
                    variant="student"
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
                            <Button
                                label="从模板创建"
                                size="small"
                                icon="pi pi-book"
                                className="
                                    flex items-center gap-2 px-4 py-2
                                    bg-surface border border-surface-200 rounded-[14px]
                                    text-[12px] font-black text-surface-700 tracking-tight
                                    transition-all duration-200 active:scale-[0.95]
                                    hover:border-primary-300 hover:text-primary-600 hover:shadow-sm
                                    disabled:opacity-40 disabled:cursor-not-allowed
                                "
                                text
                                onClick={() => setSelectTemplateDialogVisible(true)}
                                disabled={saving}
                            />
                        </>
                    }
                />

                {/* 1RM设置面板 */}
                {subscription && studentData && (
                    <CoachOneRMConfigPanel
                        days={days}
                        actions={actions}
                        studentData={studentData}
                        subscriptionId={params.id as string}
                        onSave={() => {
                            // 刷新学员数据以更新1RM显示
                            const refreshStudent = async () => {
                                try {
                                    const studentRes = await coachService.getStudent({
                                        subscriptionId: params.id.toString(),
                                        need1RM: true,
                                    });
                                    if (studentRes) {
                                        setStudentData(studentRes.student);
                                    }
                                } catch (error) {
                                    console.error('刷新学员数据失败:', error);
                                }
                            };
                            refreshStudent();
                        }}
                    />
                )}

                <Card className="shadow-sm mb-6 bg-surface-0 border border-surface-200/70 rounded-[24px]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 min-h-[500px]">
                        {/* 左侧：周历视图 */}
                        <div className="lg:col-span-1">
                            <WeekCalendar
                                days={days}
                                selectedDayIndex={selectedDayIndex}
                                onSelectDay={setSelectedDayIndex}
                                onAddWeek={handleAddWeek}
                                onAddWeekFromExisting={handleAddWeekFromExisting}
                                onDeleteWeek={handleDeleteWeek}
                                saving={saving}
                                startExecutionDay={startExecutionDay}
                            />
                        </div>

                        {/* 右侧：训练日详情 */}
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
                                    onActionSetChange={handleActionSetChange}
                                    saving={saving}
                                    totalDays={days.length}
                                    onCopyFromDay={handleCopyFromDay}
                                    existingTrainingDays={existingTrainingDays}
                                    studentData={studentData}
                                    subscription={subscription}
                                    execution={executions[selectedDay.dayIndex]}
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
                            onClick={confirmCancel}
                            className="p-button-text"
                            disabled={saving}
                        />
                        <Button
                            label={instanceExists ? "更新计划" : "制定计划"}
                            icon="pi pi-check"
                            className="p-button-primary shadow-lg shadow-primary-200 transition-transform active:scale-95 rounded-2xl px-6"
                            onClick={handleSave}
                            loading={saving}
                        />
                    </div>
                </Card>

                <BatchActionsDialog
                    visible={batchDialogVisible}
                    onHide={() => setBatchDialogVisible(false)}
                    actions={actions}
                    maxWeeks={maxWeeks}
                    onApply={handleBatchApply}
                    disabled={saving}
                />

                <BatchOperationDialog
                    visible={aiBatchDialogVisible}
                    onHide={() => {
                        setAiBatchDialogVisible(false);
                        setAiFeedbackInstruction(undefined);
                    }}
                    mode="local"
                    targetActionType="coach"
                    initialTrainingDays={days}
                    existingActions={actions}
                    onApplyLocal={handleAiApplyLocal}
                    onSuccess={handleAiBatchOperationSuccess}
                    onPreviewResult={handleAiPreviewResult}
                    onRestart={handleAiRestart}
                    onGetDaysToApply={() => days}
                    initialInstruction={aiFeedbackInstruction}
                    contextOptions={{
                        subscriptionId: params.id as string,
                        subjectUserId: studentData?.student_id,
                        // 默认仅必要：学员档案+问卷（知道是谁、要什么）；动作库必选以便改计划；其余由用户自行勾选
                        includeStudentProfile: true,
                        includeStudentQuestionnaire: true,
                        includeExecutionHistory: false,
                        includeFeedbacks: false,
                        includeStudentActionLib: false,
                        includeCoachActionLib: true,
                        includePublicActionLib: true,
                        includeCoachTemplates: false,
                        includeTemplateMatch: false,
                    }}
                />
            </div>

            {/* 问卷编辑对话框 */}
            {subscription && coach && (
                <QuestionnaireForm
                    visible={questionnaireVisible}
                    onHide={() => setQuestionnaireVisible(false)}
                    questions={questionnaireQuestions}
                    coach={coach as any}
                    onSubmit={handleSaveQuestionnaire}
                    loading={questionnaireLoading}
                />
            )}
        </div>
    );
};

export default StudentPlanPage;