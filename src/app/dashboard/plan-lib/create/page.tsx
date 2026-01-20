'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Calendar } from 'lucide-react';
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
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { checkTrainingDays } from '@/utils/template';
import { TrainingItem } from '@/types/questionnaires';
import { coachService } from '@/app/service/coachService';
import SmartImportDialog from '../components/SmartImportDialog';
import { ItemType } from '@/types/student';

const CreatePlanPage = () => {
    const router = useRouter();
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

    // Actions from library
    const [actions, setActions] = useState<CoachActionRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [questions, setQuestions] = useState<TrainingItem[]>([]);
    
    // Smart import dialog
    const [showImportDialog, setShowImportDialog] = useState(false);
    // Mobile day picker
    const [dayPickerVisible, setDayPickerVisible] = useState(false);


    // Load actions from library
    useEffect(() => {
        if (!coach?.id) return;

        loadActions();
        loadQuestions();

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
                actionSets: [],
                actionSetsCount: 0
            });
        }

        setDays(newDays);
    };

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

    const loadQuestions = async () => {
        const res = await coachService.getQuestionnaires();
        if (res) {
            setQuestions(res.questionnaires || []);
        } else {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载问卷列表' });
        }
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
                actionSets: [],
                actionSetsCount: 0
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
        field: string,
        value: string | number | object
    ) => {
        const newDays = [...days];

        const actualDayIndex = newDays.findIndex(d => d.dayIndex === dayIndex + 1);

        if (actualDayIndex === -1) {
            console.warn(`Day not found: dayIndex=${dayIndex}, looking for ${dayIndex + 1}`);
            return;
        }

        // 确保 actionSets 存在
        if (!newDays[actualDayIndex].actionSets) {
            newDays[actualDayIndex].actionSets = [];
        }

        const actionSet = newDays[actualDayIndex].actionSets[setIndex];

        // 如果 actionSet 不存在，跳过
        if (!actionSet) {
            console.warn(`ActionSet not found: actualDayIndex=${actualDayIndex}, setIndex=${setIndex}`);
            return;
        }

        switch (field) {
            case 'actionId':
            case 'setName':
                actionSet[field] = value as string;
                break;
            case 'params':
                // 确保 params 存在
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

    // 智能导入完成处理
    const handleImportComplete = (importedDays: FormPlanTrainingDay[]) => {
        setDays(importedDays);
        if (importedDays.length > 0) {
            setSelectedDayIndex(importedDays[0].dayIndex);
        }
        showToast({ severity: 'success', summary: '导入成功', detail: `成功导入 ${importedDays.length} 天的训练计划` });
        // 重新加载动作库以包含新创建的动作
        loadActions();
    };

    const handleSave = async () => {
        if (!coach?.id) return;

        if (!name.trim()) {
            showToast({ severity: 'error', summary: '保存失败', detail: '请输入模板名称' });
            return;
        }

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
            await planLibService.addTemplate({
                name,
                description: description || null,
                tags: tags,
                suitableFor: suitableFor,
                trainingDays: daysData
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
            {/* 智能导入按钮 - 放在顶部显眠位置 */}
            <div className="mb-4 flex items-center gap-4">
                <h1 className="text-2xl font-bold text-900">新建训练计划模板</h1>
                <Button
                    label="智能导入"
                    icon="pi pi-bolt"
                    severity="help"
                    onClick={() => setShowImportDialog(true)}
                    disabled={saving || loading}
                    tooltip="使用智能导入快速导入训练计划"
                    tooltipOptions={{ position: 'right' }}
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
            />

            <Card className="shadow-sm mb-6 bg-surface-0 border border-surface-200/70 rounded-[24px]">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-[500px]">
                    {/* 左侧：周历视图 */}
                    <div className="lg:col-span-1 sticky top-20 self-start max-h-[70vh] md:max-h-[75vh] overflow-auto">
                        <WeekCalendar
                            days={days}
                            selectedDayIndex={selectedDayIndex}
                            onSelectDay={setSelectedDayIndex}
                            onAddWeek={handleAddWeek}
                            onDeleteWeek={handleDeleteWeek}
                            onAddWeekFromExisting={handleAddWeekFromExisting}
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
                                questions={questions}
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
                        className="p-button-primary shadow-lg shadow-primary-200 transition-transform active:scale-95 rounded-2xl px-6"
                        onClick={handleSave}
                        loading={saving}
                    />
                </div>
            </Card>

            {/* 智能导入对话框 */}
            <SmartImportDialog
                visible={showImportDialog}
                onHide={() => setShowImportDialog(false)}
                existingActions={actions}
                onImportComplete={handleImportComplete}
            />

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
                        onDeleteWeek={handleDeleteWeek}
                        onAddWeekFromExisting={handleAddWeekFromExisting}
                        saving={saving}
                    />
                </div>
            </Dialog>
        </div>
    );
};

export default CreatePlanPage;