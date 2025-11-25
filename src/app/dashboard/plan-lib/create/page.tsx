'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { actionLibService } from '@/app/service/actionLibService';
import { planLibService } from '@/app/service/planLibService';
import { CoachActionRow } from '@/types';
import BasicInfoForm from '../components/BasicInfoForm';
import PlanDayCard from '../components/PlanDayCard';
import WeekCalendar from '../components/WeekCalendar';
import { ListActionsDto } from '@/app/api/action-lib/list-actions/entity';

interface PlanDay {
    dayIndex: number;
    type: 'training' | 'rest';
    note: string;
    actionSets: ActionSet[];
}

interface ActionSet {
    actionId: string;
    setName: string;
    sets: number;
    reps: number;
    intensity: string;
    restSeconds: number;
}

const CreatePlanPage = () => {
    const router = useRouter();
    const { showToast } = useToastContext();
    const { data: session } = useSession();
    const coach = getCoach(session);

    // Plan template basic info
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('custom');

    // Days management
    const [days, setDays] = useState<PlanDay[]>([
        { dayIndex: 1, type: 'training', note: '', actionSets: [] },
        { dayIndex: 2, type: 'training', note: '', actionSets: [] },
        { dayIndex: 3, type: 'training', note: '', actionSets: [] },
        { dayIndex: 4, type: 'training', note: '', actionSets: [] },
        { dayIndex: 5, type: 'training', note: '', actionSets: [] },
        { dayIndex: 6, type: 'training', note: '', actionSets: [] },
        { dayIndex: 7, type: 'training', note: '', actionSets: [] }
    ]);

    // Selected day for editing
    const [selectedDayIndex, setSelectedDayIndex] = useState<number | null>(1);

    // Actions from library
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Load actions from library
    useEffect(() => {
        if (!coach?.id) return;

        const loadActions = async () => {
            try {
                const reqData: ListActionsDto = {
                    page: 1,
                    limit: 100
                };
                const res = await actionLibService.listActions(reqData);
                if (res) {
                    setActions(res.actions);
                }
            } catch (error) {
                console.error('加载动作库失败:', error);
                showToast({ severity: 'error', summary: '加载失败', detail: '无法加载动作库' });
            } finally {
                setLoading(false);
            }
        };

        loadActions();
    }, [coach?.id]);

    const handleAddWeek = () => {
        const currentLength = days.length;
        const newDays = [...days];

        // 添加7天
        for (let i = 1; i <= 7; i++) {
            newDays.push({
                dayIndex: currentLength + i,
                type: 'training',
                note: '',
                actionSets: []
            });
        }

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
            sets: 3,
            reps: 10,
            intensity: '',
            restSeconds: 60
        });
        setDays(newDays);
    };


    const handleNoteChange = (dayIndex: number, note: string) => {
        const newDays = [...days];
        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex + 1);
        if (actualDayIndex === -1) return;

        newDays[actualDayIndex].note = note;
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
        field: keyof ActionSet,
        value: string | number
    ) => {
        const newDays = [...days];

        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex + 1);

        if (actualDayIndex === -1) {
            return;
        }

        const actionSet = newDays[actualDayIndex].actionSets[setIndex];
        
        // 使用类型守卫分别处理不同类型字段的赋值
        switch (field) {
            case 'actionId':
            case 'setName':
            case 'intensity':
                actionSet[field] = value as string;
                break;
            case 'sets':
            case 'reps':
            case 'restSeconds':
                actionSet[field] = value as number;
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

        if (targetIndex === -1 || sourceIndex === -1) return;

        // 复制源日的动作集到目标日，但要保持目标日的dayIndex不变
        newDays[targetIndex] = {
            ...newDays[targetIndex],
            actionSets: newDays[sourceIndex].actionSets.map(set => ({
                ...set,
                // 为新复制的动作集生成新的唯一标识符
                actionId: set.actionId,
                setName: set.setName,
                sets: set.sets,
                reps: set.reps,
                intensity: set.intensity,
                restSeconds: set.restSeconds
            }))
        };

        setDays(newDays);
        showToast({ severity: 'success', summary: '复制成功', detail: `已从第${sourceDayIndex}天复制动作到第${targetDayIndex}天` });
    };

    const handleSave = async () => {
        if (!coach?.id) return;

        if (!name.trim()) {
            showToast({ severity: 'error', summary: '保存失败', detail: '请输入模板名称' });
            return;
        }

        setSaving(true);
        try {
            // Prepare data according to API format
            const daysData = days.map(day => ({
                day_index: day.dayIndex,
                type: day.type,
                note: day.note || null,
                action_sets: day.type === 'training'
                    ? day.actionSets.map(set => ({
                        action_id: set.actionId,
                        set_order: day.actionSets.indexOf(set) + 1,
                        sets: set.sets,
                        reps: set.reps,
                        intensity: set.intensity || null,
                        rest_seconds: set.restSeconds || null
                    }))
                    : []
            }));

            await planLibService.addTemplate({
                name,
                description: description || null,
                type,
                days: daysData
            });

            showToast({ severity: 'success', summary: '保存成功', detail: '训练计划模板已创建' });
            router.push('/dashboard/plan-lib');
        } catch (error) {
            console.error('保存模板失败:', error);
            showToast({ severity: 'error', summary: '保存失败', detail: '无法创建训练计划模板' });
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

    return (
        <div className="mx-auto">
            <BasicInfoForm
                name={name}
                description={description}
                type={type}
                onNameChange={setName}
                onDescriptionChange={setDescription}
                onTypeChange={setType}
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
                            <div className="card shadow-sm flex align-items-center justify-content-center h-full min-h-20rem">
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
                </div>¸
            </Card>
        </div>
    );
};

export default CreatePlanPage;