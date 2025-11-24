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
import BasicInfoForm from './components/BasicInfoForm';
import PlanDayCard from './components/PlanDayCard';
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
        { dayIndex: 2, type: 'rest', note: '', actionSets: [] },
        { dayIndex: 3, type: 'training', note: '', actionSets: [] }
    ]);

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

    const handleAddDay = () => {
        const newDayIndex = days.length + 1;
        setDays([
            ...days,
            { dayIndex: newDayIndex, type: 'training', note: '', actionSets: [] }
        ]);
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
        newDays[dayIndex].actionSets.push({
            actionId: '',
            setName: '',
            sets: 3,
            reps: 10,
            intensity: '',
            restSeconds: 60
        });
        setDays(newDays);
    };

    const handleRemoveActionSet = (dayIndex: number, setIndex: number) => {
        const newDays = [...days];
        newDays[dayIndex].actionSets.splice(setIndex, 1);
        setDays(newDays);
    };

    const handleActionSetChange = (
        dayIndex: number,
        setIndex: number,
        field: keyof ActionSet,
        value: string | number
    ) => {
        const newDays = [...days];
        const actionSets = [...newDays[dayIndex].actionSets];
        actionSets[setIndex] = {
            ...actionSets[setIndex],
            [field]: value
        };
        newDays[dayIndex].actionSets = actionSets;
        setDays(newDays);
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

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="shadow-sm">
                <div className="flex flex-column md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-900">创建训练计划模板</h1>
                        <p className="text-600 mt-1">设置模板基本信息和训练日安排</p>
                    </div>
                    <div className="flex gap-2">
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
                </div>

                {/* Basic Info Section */}
                <div className="mb-8">
                    <h2 className="text-xl font-semibold text-900 mb-4">基本信息</h2>
                    <BasicInfoForm
                        name={name}
                        description={description}
                        type={type}
                        onNameChange={setName}
                        onDescriptionChange={setDescription}
                        onTypeChange={setType}
                        saving={saving}
                    />
                </div>

                {/* Days Section */}
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-900">训练日安排</h2>
                        <Button
                            label="添加训练日"
                            icon="pi pi-plus"
                            onClick={handleAddDay}
                            disabled={saving}
                        />
                    </div>

                    <div className="space-y-6">
                        {days.map((day, dayIndex) => (
                            <PlanDayCard
                                key={dayIndex}
                                day={day}
                                dayIndex={dayIndex}
                                actions={actions}
                                onDayTypeChange={handleDayTypeChange}
                                onRemoveDay={handleRemoveDay}
                                onNoteChange={(dayIndex, note) => {
                                    const newDays = [...days];
                                    newDays[dayIndex].note = note;
                                    setDays(newDays);
                                }}
                                onAddActionSet={handleAddActionSet}
                                onRemoveActionSet={handleRemoveActionSet}
                                onActionSetChange={handleActionSetChange}
                                saving={saving}
                                totalDays={days.length}
                            />
                        ))}
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

export default CreatePlanPage;