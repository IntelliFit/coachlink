'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';

import { useParams, useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { actionLibService } from '@/app/service/actionLibService';
import { planLibService } from '@/app/service/planLibService';
import { CoachActionRow } from '@/types';
import BasicInfoForm from '@/app/dashboard/plan-lib/components/BasicInfoForm';
import PlanDayCard from '@/app/dashboard/plan-lib/components/PlanDayCard';
import WeekCalendar from '@/app/dashboard/plan-lib/components/WeekCalendar';
import { ListActionsDto } from '@/app/api/action-lib/list-actions/entity';
import { GetTemplateDto } from '@/app/api/plan-lib/get-template/entity';
import { UpdateTemplateDto } from '@/app/api/plan-lib/update-template/entity';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/add-template/entity';


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

    // Days management
    const [days, setDays] = useState<FormPlanTrainingDay[]>([]);

    // Selected day for editing
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(null);

    // Actions from library
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load template data
    useEffect(() => {
        if (!coach?.id || !params.id) return;

        const loadTemplate = async () => {
            try {
                // Load actions first
                const reqData: ListActionsDto = {
                    page: 1,
                    limit: 100
                };
                const res = await actionLibService.listActions(reqData);
                if (res) {
                    setActions(res.actions);
                }

                // Load template data
                const templateReq: GetTemplateDto = {
                    id: params.id as string
                };
                const templateRes = await planLibService.getTemplate(templateReq);

                if (templateRes) {
                    // Fill form with template data
                    setName(templateRes.template.name);
                    setDescription(templateRes.template.description || '');
                    setTags(templateRes.template.tags || []);
                    setSuitableFor(templateRes.template.suitable_for as 'beginner' | 'intermediate' | 'advanced' || 'beginner');

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

        loadTemplate();
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

    const handleAddActionSet = (dayIndex: number) => {
        const newDays = [...days];
        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex);
        if (actualDayIndex === -1) return;

        newDays[actualDayIndex].actionSets.push({
            actionId: '',
            setName: '',
            params: {}
        });
        setDays(newDays);
    };

    const handleRemoveActionSet = (dayIndex: number, setIndex: number) => {
        const newDays = [...days];
        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex);
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
                // 我们保留原始属性，只更新必要的字段
                actionId: set.actionId,
                setName: set.setName,
                sets: set.sets,
                reps: set.reps,
                intensity: set.intensity,
                restSeconds: set.restSeconds
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

    const handleSave = async () => {
        if (!coach?.id || !params.id) return;

        if (!name.trim()) {
            showToast({ severity: 'error', summary: '保存失败', detail: '请输入模板名称' });
            return;
        }

        setSaving(true);
        try {
            // Prepare data according to API format
            const daysData = days.map(day => ({
                dayIndex: day.dayIndex,
                type: day.type,
                note: day.note || null,
                actionSets: day.actionSets || []
            }));

            await planLibService.updateTemplate({
                id: params.id as string,
                name,
                description: description || null,
                tags: tags,
                suitableFor: suitableFor,
                trainingDays: daysData
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
        <div className="mx-auto">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-900">编辑训练计划</h1>
                <Button
                    label="返回"
                    icon="pi pi-arrow-left"
                    onClick={() => router.back()}
                    className="p-button-text"
                    disabled={saving}
                />
            </div>

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
            />

            <Card className="shadow-sm mb-6">
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
                        label="保存模板"
                        icon="pi pi-check"
                        onClick={handleSave}
                        loading={saving}
                    />
                </div>
            </Card>
        </div>
    );
};

export default EditPlanPage;