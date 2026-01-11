'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';

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
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import { subscriptionService } from '@/app/service/subscriptionService';
import StudentPlanExecutionView from './components/StudentPlanExecutionView';
import QuestionnaireForm from '@/app/coach/profile/[id]/QuestionnaireForm';
import type { TrainingItem } from '@/types/questionnaires';

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

                // 3. 处理 Actions
                if (actionsRes?.actions) {
                    setActions(actionsRes.actions);
                }

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

                // 6. 处理 Executions (执行记录)
                if (exeRes?.executions) {
                    setExecutions(exeRes.executions);
                }
                if (exeRes?.actions) {
                    setExecutionActions(exeRes.actions);
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
        if (!newDays[dayIndex]) return;

        const actualDayIndex = dayIndex;

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

        if (instanceExists && instanceId) {
            // Update existing instance
            const res = await planLibService.updateInstance({
                id: instanceId, // Use the actual instance ID, not subscription ID
                name,
                description: description || null,
                tags: tags || null,
                type: type || null,
                suitableFor: suitableFor || null,
                trainingDays: daysData,
            });

            if (res) {
                showToast({ severity: 'success', summary: '保存成功', detail: '训练计划已更新' });
            } else {
                showToast({ severity: 'error', summary: '保存失败', detail: '无法更新训练计划' });
            }

        } else {
            // Create new instance
            const res = await planLibService.createInstance({
                templateId: selectedTemplateId,
                subscriptionId: params.id.toString(),

                name,
                description: description || null,
                tags: tags || null,
                type: type || null,
                suitableFor: suitableFor || null,
                trainingDays: daysData
            });

            if (res) {
                setInstanceExists(true);
                showToast({ severity: 'success', summary: '创建成功', detail: '训练计划已创建' });
            } else {
                showToast({ severity: 'error', summary: '创建失败' });
            }
        }

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
    const handleSelectTemplate = (templateData: GetTemplateResponseDto) => {
        // 设置基本信息
        setName(templateData.template.name);
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
            <div className="flex-1 p-4">
                <ConfirmDialog />
                <SelectTemplateDialog
                    visible={selectTemplateDialogVisible}
                    onHide={() => setSelectTemplateDialogVisible(false)}
                    onSelectTemplate={handleSelectTemplate}
                    coachId={coach?.id || ''}
                />

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

                <div className='grid grid-cols-2 gap-6'>
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
                </div>


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
                    }
                />



                <Card className="shadow-sm mb-6 bg-surface-0 border border-surface-200/70 rounded-[24px]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
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
                        <div className="lg:col-span-2">
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