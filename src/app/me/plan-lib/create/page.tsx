'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { studentActionLibService } from '@/app/service/studentActionLibService';
import { studentPlanLibService } from '@/app/service/studentPlanLibService';
import { StudentActionRow } from '@/types/student';
import { CoachActionRow } from '@/types';
import PlanDayCard from '@/app/dashboard/plan-lib/components/PlanDayCard';
import WeekCalendar from '@/app/dashboard/plan-lib/components/WeekCalendar';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import StudentSmartImportDialog from '../components/StudentSmartImportDialog';
import { studentService } from '@/app/service/studentService';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import OneRMConfigPanel from '../components/OneRMConfigPanel';

const CreatePlanPage = () => {
    const router = useRouter();
    const { showToast } = useToastContext();
    const { data: session } = useSession();

    // Plan basic info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    // Days management
    const [days, setDays] = useState<FormPlanTrainingDay[]>([
        { dayIndex: 1, type: 'training', note: '', actionSets: [], actionSetsCount: 0 },
        { dayIndex: 2, type: 'training', note: '', actionSets: [], actionSetsCount: 0 },
        { dayIndex: 3, type: 'training', note: '', actionSets: [], actionSetsCount: 0 },
        { dayIndex: 4, type: 'training', note: '', actionSets: [], actionSetsCount: 0 },
        { dayIndex: 5, type: 'training', note: '', actionSets: [], actionSetsCount: 0 },
        { dayIndex: 6, type: 'training', note: '', actionSets: [], actionSetsCount: 0 },
        { dayIndex: 7, type: 'training', note: '', actionSets: [], actionSetsCount: 0 }
    ]);

    // Selected day for editing
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(1);

    // Actions from library (converted to CoachActionRow format for compatibility)
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Smart import dialog
    const [showImportDialog, setShowImportDialog] = useState(false);

    // 学生数据状态，用于自动计算重量
    const [studentData, setStudentData] = useState<GetStudentResponseDto['student'] | null>(null);

    // Plan-level 1RM configuration
    const [planReference1RMs, setPlanReference1RMs] = useState<Record<string, number>>({});

    // Load actions and student profile
    const loadActions = async () => {
        try {
            const res = await studentActionLibService.listActions({ page: 1, limit: 1000 });
            if (res?.actions) {
                const parseAutoComputeFlag = (action: StudentActionRow & Record<string, any>) => {
                    if (typeof action.enableAutoWeightCompute === 'boolean') return action.enableAutoWeightCompute;
                    if (typeof action.enable_auto_weight_compute === 'boolean') return action.enable_auto_weight_compute;
                    if (typeof action.enableautoweightcompute === 'boolean') return action.enableautoweightcompute;
                    // 兜底：具备“强度”属性的力量动作，视为可配置 1RM
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
                    created_at: action.created_at,
                    updated_at: action.updated_at,
                    enableAutoWeightCompute: parseAutoComputeFlag(action as StudentActionRow & Record<string, any>),
                    includesBodyWeight: parseIncludesBodyWeightFlag(action as StudentActionRow & Record<string, any>),
                    canonical_action_id: action.canonical_action_id
                }));
                setActions(convertedActions);
            }
        } catch (error) {
            console.error('加载动作库失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作库' });
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
                    reviewed: 0
                });
            }
        } catch (error) {
            console.error('加载档案失败:', error);
        }
    }

    useEffect(() => {
        if (!session?.user?.id) return;

        setLoading(true);
        Promise.all([loadActions(), fetchProfile()])
            .finally(() => setLoading(false));
    }, [session?.user?.id]);

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
            actionSets: day.actionSets.map(set => ({ ...set }))
        }));

        setDays([...days, ...newDays]);
    };

    const handleDeleteWeek = (weekStartIndex: number) => {
        const weekStart = weekStartIndex * 7;
        const newDays = days.filter((_, index) => index < weekStart || index >= weekStart + 7);

        // 重新编号
        const reindexedDays = newDays.map((day, index) => ({
            ...day,
            dayIndex: index + 1
        }));

        setDays(reindexedDays);

        if (selectedDayIndex !== null) {
            if (selectedDayIndex > weekStart && selectedDayIndex <= weekStart + 7) {
                setSelectedDayIndex(null);
            } else if (selectedDayIndex > weekStart + 7) {
                setSelectedDayIndex(selectedDayIndex - 7);
            }
        }
    };

    const handleRemoveDay = (index: number) => {
        const dayToRemove = days[index];
        const newDays = [...days];

        // 将该天设为休息日而不是删除
        newDays[index] = {
            ...dayToRemove,
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

    const handleAddActionSet = (dayIndexVal: number) => {
        const newDays = [...days];
        // PlanDayCard 传递的是 day.dayIndex (1-based)，需要查找对应的数组索引
        // 或者如果 dayIndexVal 是数组索引，这里也能兼容（如果 dayIndex 正好等于数组索引+1）
        // 更安全的方式是查找对应的 dayIndex
        const arrayIndex = newDays.findIndex(d => d.dayIndex === dayIndexVal);

        if (arrayIndex === -1) {
            console.error('Cannot find day with dayIndex:', dayIndexVal);
            return;
        }

        const day = newDays[arrayIndex];
        day.actionSets.push({
            actionId: '',
            actionName: '',
            params: {
                sets: 3,
                reps: '10',
                intensity: '',
                rest: '60秒'
            }
        } as any);
        day.actionSetsCount = day.actionSets.length;
        setDays(newDays);
    };

    const handleNoteChange = (dayIndex: number, note: string) => {
        const newDays = [...days];
        newDays[dayIndex] = { ...newDays[dayIndex], note };
        setDays(newDays);
    };

    const handleRemoveActionSet = (dayIndex: number, setIndex: number) => {
        const newDays = [...days];
        newDays[dayIndex].actionSets.splice(setIndex, 1);
        newDays[dayIndex].actionSetsCount = newDays[dayIndex].actionSets.length;
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
            await studentPlanLibService.saveFavorite({
                name: name.trim(),
                description: description.trim() || undefined,
                training_days: days
            });
            showToast({ severity: 'success', summary: '保存成功', detail: '常用计划已创建' });
            router.push('/me/plan-lib');
        } catch (error: any) {
            console.error('保存计划失败:', error);
            showToast({ severity: 'error', summary: '保存失败', detail: error?.message || '无法保存计划' });
        } finally {
            setSaving(false);
        }
    };

    // 智能导入完成回调
    const handleImportComplete = async (
        importedDays: any[],
        importedGlobalDescription?: string | null,
    ) => {
        // 确认覆盖现有内容
        if (days.some(d => d.actionSets.length > 0)) {
            const confirmed = window.confirm('导入将覆盖现有的训练内容，是否继续？');
            if (!confirmed) return;
        }

        // 转换导入数据的格式以配合 FormPlanTrainingDay
        const convertedDays: FormPlanTrainingDay[] = importedDays.map(day => ({
            dayIndex: day.dayIndex,
            type: day.type || 'training',
            note: day.note || '',
            actionSets: (day.actionSets || []).map((set: any, idx: number) => ({
                type: 'no-filter',
                actionId: set.action_id || set.actionId,
                setName: set.set_name || set.setName || `动作${idx + 1}`,
                params: {
                    '组数': set.sets || set.params?.['组数'] || 3,
                    '次数': set.reps || set.params?.['次数'] || 8,
                    '休息时间': set.rest_seconds || set.params?.['休息时间'] || 120,
                    '强度': set.intensity || set.params?.['强度'] || undefined,
                }
            })),
            actionSetsCount: (day.actionSets || []).length,
        }));

        setDays(convertedDays);

        // 选中第一个训练日
        const firstTrainingDay = convertedDays.find(d => d.type === 'training');
        if (firstTrainingDay) {
            setSelectedDayIndex(firstTrainingDay.dayIndex);
        }

        // 重新加载动作库（可能创建了新动作）
        await loadActions();

        // 如果当前未填写描述，则用“全局说明”自动回填
        if (importedGlobalDescription?.trim()) {
            setDescription((prev) => (prev?.trim() ? prev : importedGlobalDescription.trim()));
        }

        showToast({ severity: 'success', summary: '导入成功', detail: `已导入 ${convertedDays.length} 天训练计划` });
    };

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
        <div className="mx-auto p-0 md:p-4">
            <Card className="
                bg-transparent border-none p-0 shadow-none
                sm:bg-surface-0 sm:border sm:border-surface-200/70 sm:rounded-[24px] sm:shadow-sm sm:p-6
            "
                
            >
                {/* 顶部区域 */}
                <div className="border-surface-200 p-0 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">创建训练计划</h1>
                            <p className="text-600 mt-1">设计您的个人训练计划</p>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                label="智能导入"
                                icon="pi pi-bolt"
                                className="rounded-2xl flex-1 md:flex-none"
                                outlined
                                onClick={() => setShowImportDialog(true)}
                            />
                            <Button
                                label="保存计划"
                                icon="pi pi-check"
                                loading={saving}
                                onClick={handleSave}
                                className='rounded-2xl bg-surface-800 border-none flex-1 md:flex-none'
                            />
                        </div>
                    </div>
                </div>

                <div className="p-0 py-4 md:p-6 sm:p-0">
                    {/* 基本信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-sm font-medium text-700 mb-2">计划名称 *</label>
                            <InputText
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="例如：每周三练增肌计划"
                                className="w-full rounded-xl"
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
                                className="w-full rounded-xl"
                            />
                        </div>
                    </div>

                    {/* Global 1RM Configuration Panel */}
                    <OneRMConfigPanel
                        days={days}
                        actions={actions}
                        value={planReference1RMs}
                        onChange={setPlanReference1RMs}
                    />

                    {/* 周日历视图 */}
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

                    {/* 选中日的详情编辑 */}
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
                            studentData={studentData}
                            planReference1RMs={planReference1RMs}
                        />
                    )}

                    {!selectedDay && (
                        <div className="text-center py-12 border-2 border-dashed border-surface-200 rounded-lg">
                            <i className="pi pi-calendar text-4xl text-surface-300 mb-3"></i>
                            <p className="text-600">请在上方日历中选择一天进行编辑</p>
                        </div>
                    )}
                </div>
            </Card>

            {/* 动作库为空的提示 */}
            {!loading && actions.length === 0 && (
                <Card className="shadow-sm mt-4">
                    <div className="text-center py-6">
                        <i className="pi pi-info-circle text-3xl text-primary mb-3"></i>
                        <h3 className="text-lg font-semibold text-900 mb-2">动作库为空</h3>
                        <p className="text-600 mb-4">请先在动作库中添加一些训练动作，然后再创建计划</p>
                        <Button
                            label="前往动作库"
                            icon="pi pi-arrow-right"
                            onClick={() => router.push('/me/action-lib')}
                        />
                    </div>
                </Card>
            )}

            {/* 智能导入对话框 */}
            <StudentSmartImportDialog
                visible={showImportDialog}
                onHide={() => setShowImportDialog(false)}
                existingActions={actions}
                onImportComplete={handleImportComplete}
            />
        </div>
    );
};

export default CreatePlanPage;
