'use client';

import React, { act, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { CoachActionRow, CoachSubscriptionRow, ItemType } from '@/types';
import CopyTrainingDayDialog from './CopyTrainingDayDialog';
import ActionSetForm from './ActionSetForm';
import ExecutionDetails from './ExecutionDetails';
import { FormPlanTrainingDay, CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { TrainingItem, TrainingOptionQuestion } from '@/types/questionnaires';
import { PolymorphicItemMenu } from './PolymorphicItemMenu';
import { DietItemForm } from './DietItemForm';
import { CardioItemForm } from './CardioItemForm';
import { HabitItemForm } from './HabitItemForm';
import { ArrowDown, ArrowUp, Calendar, Coffee, Copy, Filter, Trash2 } from 'lucide-react';
import { Dialog } from 'primereact/dialog';

// 定义动作选项的接口
interface ActionOption {
    label: string;
    value: string;
    action: CoachActionRow;
}

/** 动作库为空或筛选无结果时的提示，含跳转动作库链接 */
export const ActionEmptyMessage: React.FC<{ type: 'empty' | 'filter' }> = ({ type }) => {
    const pathname = usePathname() || '';
    const actionLibHref = pathname.startsWith('/me') ? '/me/action-lib' : '/dashboard/action-lib';
    const text = type === 'empty'
        ? '暂无可选动作，可'
        : '未找到匹配的动作，可';
    return (
        <div className="py-3 px-3 text-sm text-surface-500 text-center">
            {text}
            <Link href={actionLibHref} className="text-primary-600 font-bold underline underline-offset-4 hover:text-primary-700 ml-0.5">
                前往动作库
            </Link>
            添加自定义动作
        </div>
    );
};

// 自定义选项模板组件（紧凑版：减小间距与高度）
export const ActionOptionTemplate: React.FC<{ action: CoachActionRow }> = ({ action }) => {
    return (
        <div className="flex items-start gap-1.5 max-w-full py-0.5">
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                    <div className="text-sm font-black text-surface-900 truncate leading-tight">{action.name}</div>
                </div>

                <div className="mt-0.5 flex flex-wrap gap-0.5 max-w-full">
                    {(action.positions || []).slice(0, 4).map((position, idx) => (
                        <div
                            className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-px rounded-md leading-tight"
                            key={idx}
                        >
                            {position}
                        </div>
                    ))}

                    {action.enableAutoWeightCompute && (
                        <div className="bg-primary-100 text-primary-700 text-[9px] font-bold px-1.5 py-px rounded-md leading-tight">
                            自动计算重量
                        </div>
                    )}

                    {action.type && action.type !== 'STRENGTH' && (
                        <div className="bg-purple-100 text-purple-700 text-[9px] font-bold px-1.5 py-px rounded-md leading-tight">
                            {action.type}
                        </div>
                    )}
                </div>

                {action.detail && (
                    <div className="text-[10px] text-surface-500 mt-0.5 line-clamp-1 break-words leading-tight">
                        {action.detail}
                    </div>
                )}
            </div>
        </div>
    );
};

// 自定义选中值模板组件（紧凑版）
export const ActionValueTemplate: React.FC<{ action: CoachActionRow | null }> = ({ action }) => {
    if (!action) {
        return <span className="text-sm">选择动作</span>;
    }

    return (
        <div className="flex items-center gap-1.5 min-w-0">
            <div className="text-sm font-black truncate min-w-0 leading-tight">{action.name}</div>
            {/* Mobile 只显示少量徽章，避免撑宽输入框 */}
            <div className="hidden sm:flex flex-wrap gap-0.5">
                {(action.positions || []).slice(0, 2).map((position, idx) => (
                    <div
                        key={idx}
                        className="bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-px rounded-md leading-tight"
                    >
                        {position}
                    </div>
                ))}
                {action.enableAutoWeightCompute && (
                    <div className="bg-primary-100 text-primary-700 text-[9px] font-bold px-1.5 py-px rounded-md leading-tight">
                        自动计算重量
                    </div>
                )}
            </div>
        </div>
    );
};

interface PlanDayCardProps {
    day: FormPlanTrainingDay;
    dayIndex: number;
    actions: CoachActionRow[];
    onDayTypeChange: (index: number, type: 'training' | 'rest') => void;
    onRemoveDay: (index: number) => void;
    onNoteChange: (dayIndex: number, note: string) => void;
    onAddActionSet: (dayIndex: number, type?: ItemType) => void; // 支持 type 参数
    onRemoveActionSet: (dayIndex: number, setIndex: number) => void;
    onMoveActionSet: (dayIndex: number, setIndex: number, direction: 'up' | 'down') => void;
    onActionSetChange: (
        dayIndex: number,
        setIndex: number,
        field: string,
        value: string | number | object
    ) => void;
    saving: boolean;
    totalDays: number;
    // 修改属性定义
    onCopyFromDay: (targetDayIndex: number, sourceDayIndex: number) => void;
    existingTrainingDays: FormPlanTrainingDay[];
    studentData?: any | null; // 添加studentData属性
    questions?: TrainingItem[];
    subscription?: CoachSubscriptionRow | null;
    execution?: any; // 添加执行数据属性
    planReference1RMs?: Record<string, number>;
    /** AI 修改器高亮：key 为 dayIndex-actionName 或 dayIndex-day */
    highlightedModificationKeys?: Set<string> | null;
}


const PlanDayCard: React.FC<PlanDayCardProps> = ({
    day,
    dayIndex,
    actions,
    onDayTypeChange,
    onRemoveDay,
    onNoteChange,
    onAddActionSet,
    onRemoveActionSet,
    onMoveActionSet,
    onActionSetChange,
    saving,
    totalDays,
    onCopyFromDay,
    existingTrainingDays,
    studentData,
    questions,
    subscription,
    execution,
    planReference1RMs,
    highlightedModificationKeys = null
}) => {
    // 添加状态管理
    const [copyDialogVisible, setCopyDialogVisible] = useState(false);
    // 条件筛选相关状态
    const [filterDialogVisible, setFilterDialogVisible] = useState(false);
    const [selectedQuestions, setSelectedQuestions] = useState<TrainingOptionQuestion[]>([]);
    const [currentActionSetIndex, setCurrentActionSetIndex] = useState<number | null>(null);
    const [activeTabIndexes, setActiveTabIndexes] = useState<number[]>([]);

    useEffect(() => {
        const indexes = [];
        for (let i = 0; i < day.actionSets.length; i++) {
            indexes.push(0);
        }
        setActiveTabIndexes(indexes);

        const questions: TrainingOptionQuestion[] = [];
        for (const actionSet of day.actionSets) {
            if (actionSet.type === 'no-filter') {
                questions.push(null as any);
            } else {
                questions.push(actionSet.question);
            }
        }

        setSelectedQuestions(questions);
    }, [day]);

    // 将CoachActionRow数组转换为Dropdown选项
    const actionOptions: ActionOption[] = actions.map(action => ({
        label: action.name,
        value: action.id,
        action: action
    }));

    // 获取过滤后的动作选项
    const getFilteredOptions = (itemType: ItemType | undefined) => {
        return actions.filter(action => {
            // 如果是力量训练（或未定义），显示 STRENGTH 类型或无类型的动作
            if (!itemType || itemType === 'STRENGTH') {
                return !action.type || action.type === 'STRENGTH';
            }
            // 其他类型精确匹配
            return action.type === itemType;
        }).map(action => ({
            label: action.name,
            value: action.id,
            action: action
        }));
    };

    const actionName = (setIndex: number) => {
        const actionSet = day.actionSets[setIndex];

        // 优先显示 group_title (如果存在)
        if (actionSet.group_title) {
            // 这里可以处理分组显示的逻辑，目前暂时只返回标准名称
        }

        if (actionSet.type === 'one-filter') {
            return actionSet.question.question;
        } else {
            const actionId = (actionSet as any).actionId;
            const itemType = (actionSet as any).itemType;

            // 优先从动作库取名称（含 CARDIO/DIET/HABIT 从库中选的动作）
            if (actionId) {
                const label = actionOptions.find(option => option.action.id === actionId)?.label;
                if (label) return label;
            }
            // 无 actionId 时：习惯可输入自定义名，其他用类型占位
            if (itemType && itemType !== 'STRENGTH') {
                const customName = (actionSet.params?.custom_data?.habit_name) ||
                    (itemType === 'DIET' ? '饮食建议' :
                        itemType === 'CARDIO' ? '有氧运动' : '习惯');
                return customName;
            }

            return '';
        }
    }

    // 获取当前项的 ItemType（优先用 actionSet.itemType，否则从动作库推断）
    const getItemType = (set: CoachPlanAction | any): ItemType => {
        if (set.itemType) return set.itemType as ItemType;
        const actionId = (set as any).actionId;
        if (actionId) {
            const action = actions.find(a => a.id === actionId);
            const t = action?.type as ItemType | undefined;
            if (t && ['STRENGTH', 'CARDIO', 'DIET', 'HABIT'].includes(t)) return t;
        }
        return 'STRENGTH';
    };

    // 获取图标
    const getItemIcon = (type: ItemType) => {
        switch (type) {
            case 'DIET': return 'pi pi-apple';
            case 'CARDIO': return 'pi pi-heart';
            case 'HABIT': return 'pi pi-check-circle';
            default: return 'pi pi-bolt'; // STRENGTH
        }
    };

    // 获取颜色
    const getItemColorClass = (type: ItemType) => {
        switch (type) {
            case 'DIET': return 'text-orange-500 bg-orange-50';
            case 'CARDIO': return 'text-red-500 bg-red-50';
            case 'HABIT': return 'text-green-500 bg-green-50';
            default: return 'text-primary bg-primary-50';
        }
    };

    // 获取类型中文名称（与 PolymorphicItemMenu 一致）
    const getItemTypeLabel = (type: ItemType) => {
        switch (type) {
            case 'STRENGTH': return '力量训练';
            case 'CARDIO': return '有氧运动';
            case 'DIET': return '饮食建议';
            case 'HABIT': return '习惯打卡';
            default: return '力量训练';
        }
    };

    // 处理复制操作
    const handleCopyFromDay = (targetDayIndex: number, sourceDayIndex: number) => {
        // 检查是否需要确认覆盖
        const hasContent = day.note.trim() !== '' || day.actionSets.length > 0;

        if (hasContent) {
            // 显示确认对话框
            confirmDialog({
                message: '当前训练日已有内容，复制将覆盖现有内容，是否继续？',
                header: '确认覆盖',
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: '确认',
                rejectLabel: '取消',
                accept: () => {
                    onCopyFromDay(targetDayIndex, sourceDayIndex)
                }
            });
        } else {
            onCopyFromDay(targetDayIndex, sourceDayIndex)
        }
    };

    const optionQuestions = questions?.filter(
        q => q.type === 'option' && q.scope !== 'global'  // 只显示非全局的选项问题
    ) as TrainingOptionQuestion[] || [];

    // 检查是否应该显示条件筛选按钮
    const shouldShowFilterButton = questions && optionQuestions.length > 0;

    // 处理条件筛选
    const handleFilterSelect = (question: TrainingOptionQuestion) => {
        if (currentActionSetIndex === null) return;

        const newSelectedQuestions = [...selectedQuestions];
        newSelectedQuestions[currentActionSetIndex] = question;
        setSelectedQuestions(newSelectedQuestions);

        const actionSet = day.actionSets[currentActionSetIndex];
        actionSet.type = 'one-filter';
        (actionSet as any).question = question;
        // 初始化 actions
        (actionSet as any).actions = question.options.map((option: any) => ({
            type: 'no-filter',
            actionId: '',
            setName: '',
            params: {}
        }));
        onActionSetChange(dayIndex, currentActionSetIndex, 'all', actionSet);

        const newActiveIndexes = [...activeTabIndexes];
        newActiveIndexes[currentActionSetIndex] = 0;
        setActiveTabIndexes(newActiveIndexes);

        setFilterDialogVisible(false);
    };

    // 处理 Group Title 变更 (当前项及其后的所有同组项)
    const handleGroupTitleChange = (setIndex: number, newTitle: string) => {
        onActionSetChange(dayIndex, setIndex, 'group_title', newTitle);
        // 实际上应该由父组件处理批量更新，或者这里只更新当前项，依赖后端/上层逻辑聚合
        // 简化起见，这里我们认为 group_title 是 Item 属性，UI 渲染时会自动聚合
    };

    const isDayHighlighted = highlightedModificationKeys?.has(`${day.dayIndex}-day`) ?? false;
    return (
        <div className="flex flex-col gap-5 p-0 sm:p-4 md:p-6">
            {/* 顶部操作区：吸顶（避免每次回到最上面） */}
            <div className={`sticky top-2 z-20 backdrop-blur-md rounded-[20px] p-3 flex flex-col gap-3 ${
                isDayHighlighted
                    ? 'bg-primary-50/70 dark:bg-primary-900/30 border-2 border-primary-300 dark:border-primary-500/60'
                    : 'bg-surface/95 border border-surface-100/60'
            }`}>
                {/* 头部：日序号、周/日、训练项数量 - 更清晰均衡的布局 */}
                <div className="flex flex-wrap items-stretch gap-3">
                    {/* 左侧：日序号 + 周/日 */}
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col justify-center gap-0.5">
                            <h3 className="text-base sm:text-lg font-black text-surface-900 tracking-tight leading-tight">
                                第 {day.dayIndex} 天
                            </h3>
                            <span className="text-[11px] font-bold text-surface-500 tabular-nums">
                                W{Math.ceil(day.dayIndex / 7)} · D{((day.dayIndex - 1) % 7) + 1}
                            </span>
                        </div>
                    </div>

                    {/* 中间：训练项数量或休息日 */}
                    <div className="flex-1 min-w-[120px] flex items-center">
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-50/80 border border-surface-100/60">
                            {day.type === 'training' ? (
                                <>
                                    <span className="text-[11px] font-bold text-surface-500">训练项</span>
                                    <span className="text-sm font-black text-surface-900 tabular-nums">{day.actionSets.length}</span>
                                    <span className="text-[11px] font-bold text-surface-500">个</span>
                                </>
                            ) : (
                                <span className="text-[12px] font-bold text-surface-500">休息日</span>
                            )}
                        </div>
                    </div>

                    {/* 右侧：训练日/休息日切换 */}
                    <div className="flex items-center gap-2 p-1 bg-surface-100/50 rounded-[14px] shrink-0">
                        {['training', 'rest'].map((type) => (
                            <button
                                key={type}
                                onClick={() => onDayTypeChange(dayIndex, type as any)}
                                className={`
                                    px-4 py-1.5 rounded-[10px] text-[12px] font-black transition-all active:scale-[0.95]
                                    ${day.type === type
                                        ? 'bg-surface text-surface-900 shadow-sm'
                                        : 'text-surface-400 hover:text-surface-600'}
                                `}
                            >
                                {type === 'training' ? '训练日' : '休息日'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 功能条：复制 + 添加项目 */}
                <div className="flex justify-between items-center bg-surface-50/50 px-3 py-2 rounded-[16px] border border-surface-100/40">
                    <div className="flex items-center gap-2">
                        {existingTrainingDays?.length > 0 && (
                            <button
                                onClick={() => setCopyDialogVisible(true)}
                                className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-black text-surface-600 hover:text-primary-600 transition-colors"
                            >
                                <Copy size={14} /> 从其他天复制
                            </button>
                        )}
                    </div>
                    {day.type === 'training' && (
                        <PolymorphicItemMenu onAdd={(type) => onAddActionSet(day.dayIndex, type)} />
                    )}
                </div>
            </div>

            {day.type === 'training' ? (
                <div className="flex flex-col gap-4 p-0 md:p-2">
                        {day.actionSets.map((set, setIndex) => {
                            const itemType = getItemType(set);
                            const isStrength = itemType === 'STRENGTH';
                            const filteredOptions = getFilteredOptions(itemType);

                        const setName = actionName(setIndex) || '未选定动作';
                        const isHighlighted = highlightedModificationKeys?.has(`${day.dayIndex}-${setName}`) ?? false;
                        return (
                            <div
                                key={setIndex}
                                className={`group relative rounded-[24px] md:p-4 p-0 shadow-[0_4px_20px_rgba(0,0,0,0.02)] transition-all hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${
                                    isHighlighted
                                        ? 'bg-primary-50/50 border-2 border-primary-300 dark:bg-primary-900/20 dark:border-primary-500/60'
                                        : 'bg-surface border border-surface-100'
                                }`}
                            >
                                {/* 动作头部：数值中心化 */}
                                <div className="flex justify-between items-start mb-4 md:mb-6">
                                    <div className="flex gap-3 items-center">
                                        <span className="text-xs font-black text-surface-400 shrink-0">#{setIndex + 1}</span>
                                        <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${getItemColorClass(itemType)}`}>
                                            <i className={`pi ${getItemIcon(itemType)} text-lg`} />
                                        </div>
                                        <div className="flex flex-col justify-center gap-1">
                                            <h5 className="text-lg font-black text-surface-900 tracking-tight leading-none">
                                                {actionName(setIndex) || '未选定动作'}
                                            </h5>
                                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest leading-none">
                                                {getItemTypeLabel(itemType)}
                                            </span>
                                        </div>
                                    </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => onMoveActionSet(dayIndex, setIndex, 'up')}
                                                disabled={setIndex === 0}
                                                title="上移动作"
                                                className="p-2 text-surface-300 hover:text-surface-600 disabled:text-surface-200 disabled:cursor-not-allowed transition-colors active:scale-[0.9]"
                                            >
                                                <ArrowUp size={16} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onMoveActionSet(dayIndex, setIndex, 'down')}
                                                disabled={setIndex === day.actionSets.length - 1}
                                                title="下移动作"
                                                className="p-2 text-surface-300 hover:text-surface-600 disabled:text-surface-200 disabled:cursor-not-allowed transition-colors active:scale-[0.9]"
                                            >
                                                <ArrowDown size={16} />
                                            </button>
                                            {isStrength && shouldShowFilterButton && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setCurrentActionSetIndex(setIndex); setFilterDialogVisible(true); }}
                                                    className="p-2 text-surface-400 hover:text-primary-500 transition-colors active:scale-[0.9]"
                                                >
                                                    <Filter size={16} />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => onRemoveActionSet(dayIndex, setIndex)}
                                                className="p-2 text-surface-300 hover:text-red-500 transition-colors active:scale-[0.9]"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* 条件分支切换：Aero 胶囊风格 */}
                                    {isStrength && selectedQuestions[setIndex] && (
                                        <div className="flex gap-1.5 p-1 bg-surface-50 rounded-[14px] mb-6 w-fit">
                                            {selectedQuestions[setIndex].options.map((option, index) => (
                                                <button
                                                    key={index}
                                                    onClick={() => {
                                                        setActiveTabIndexes(prev => {
                                                            const newIndexes = [...prev];
                                                            newIndexes[setIndex] = index;
                                                            return newIndexes;
                                                        });
                                                    }}
                                                    className={`
                                                px-3 py-1.5 rounded-[10px] text-[11px] font-black transition-all
                                                ${activeTabIndexes[setIndex] === index
                                                        ? 'bg-surface text-primary-600 shadow-sm'
                                                        : 'text-surface-400 hover:text-surface-600'}
                                            `}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                        </div>
                                    )}

                                {/* 动态表单区域：利用层级去线化 */}
                                <div className="md:bg-surface-50/30 md:rounded-[20px] p-0 md:p-0 md:border md:border-surface-100/50">
                                    {/* 1. 力量训练 (STRENGTH) */}
                                    {itemType === 'STRENGTH' && (
                                        <ActionSetForm
                                            set={set.type === 'one-filter' ? (set as any).actions[activeTabIndexes[setIndex] || 0] : set}
                                            setIndex={setIndex}
                                            actionOptions={filteredOptions}
                                            dayIndex={dayIndex}
                                            saving={saving}
                                            onActionSetChange={(dayIdx, innerSetIdx, field, value) => {
                                                if (set.type === 'one-filter') {
                                                    const activeIndex = activeTabIndexes[setIndex] || 0;
                                                    const actions = (set as any).actions;

                                                        // 分支条件下的局部数据更新
                                                        if (field === 'all') {
                                                            actions[activeIndex] = value;
                                                        } else if (field === 'params') {
                                                            actions[activeIndex].params = { ...actions[activeIndex].params, ...(value as any) };
                                                        } else {
                                                            actions[activeIndex][field] = value;
                                                        }
                                                        onActionSetChange(dayIdx, setIndex, 'all', set);
                                                    } else {
                                                        onActionSetChange(dayIdx, innerSetIdx, field, value);
                                                    }
                                                }}
                                                actions={actions}
                                                studentData={studentData}
                                                subscription={subscription}
                                                // 1RM 数值中心化引用
                                                planReference1RM={planReference1RMs?.[set.type === 'one-filter'
                                                    ? ((set as any).actions[activeTabIndexes[setIndex] || 0]?.actionId as string)
                                                    : (set.actionId as string)]}
                                                isGlobalOneRMConfigEnabled={planReference1RMs !== undefined}
                                            />
                                        )}

                                        {/* 2. 饮食建议 (DIET) */}
                                        {itemType === 'DIET' && (
                                            <DietItemForm
                                                item={set as any}
                                                setIndex={setIndex}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onUpdate={onActionSetChange}
                                                actionOptions={filteredOptions}
                                            />
                                        )}

                                        {/* 3. 有氧运动 (CARDIO) */}
                                        {itemType === 'CARDIO' && (
                                            <CardioItemForm
                                                item={set as any}
                                                setIndex={setIndex}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onUpdate={onActionSetChange}
                                                actionOptions={filteredOptions}
                                            />
                                        )}

                                        {/* 4. 习惯追踪 (HABIT) */}
                                        {itemType === 'HABIT' && (
                                            <HabitItemForm
                                                item={set as any}
                                                setIndex={setIndex}
                                                dayIndex={dayIndex}
                                                saving={saving}
                                                onUpdate={onActionSetChange}
                                                actionOptions={filteredOptions}
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}

                        {/* 动作列表末尾：窄高添加按钮，与动作卡片同宽 */}
                        <PolymorphicItemMenu
                            compact
                            onAdd={(type) => onAddActionSet(day.dayIndex, type)}
                            disabled={saving}
                        />

                        {/* 执行详情模块 */}
                        <ExecutionDetails execution={execution} />

                        {/* 条件筛选对话框 */}
                        {shouldShowFilterButton && (
                            <Dialog
                                visible={filterDialogVisible}
                                onHide={() => setFilterDialogVisible(false)}
                                header={
                                    <div className="flex items-center gap-2 py-1">
                                        <div className="p-2 bg-primary-50 rounded-lg text-primary-600">
                                            <i className="pi pi-filter" style={{ fontSize: '1rem' }} />
                                        </div>
                                        <span className="text-base font-black tracking-tighter text-surface-900">选择筛选条件</span>
                                    </div>
                                }
                                style={{ width: '90vw', maxWidth: '500px' }}
                                modal
                                className="aero-dialog"
                                contentClassName="p-0 border-t border-surface-100"
                                footer={
                                    <div className="p-4 bg-surface border-t border-surface-100 flex justify-end">
                                        <button
                                            onClick={() => {
                                                if (currentActionSetIndex === null) return;
                                                const newSelectedQuestions = [...selectedQuestions];
                                                newSelectedQuestions[currentActionSetIndex] = null as any;
                                                setSelectedQuestions(newSelectedQuestions);
                                                setFilterDialogVisible(false);
                                            }}
                                            className="px-6 py-2.5 text-xs font-black text-red-400 hover:text-red-600 transition-colors flex items-center gap-2"
                                        >
                                            <i className="pi pi-times" style={{ fontSize: '0.7rem' }} />
                                            取消当前条件
                                        </button>
                                    </div>
                                }
                            >
                                <div className="flex flex-col gap-4 p-6">
                                    {/* 说明文字区域 */}
                                    <div className="flex gap-3 p-4 bg-surface-50/50 rounded-[18px] border border-surface-100">
                                        <div className="text-primary-500 pt-0.5">
                                            <i className="pi pi-info-circle" />
                                        </div>
                                        <div className="text-[12px] leading-relaxed text-surface-500 font-medium">
                                            为当前动作选择一个分支条件用于匹配智能计划，
                                            <br />
                                            如果需要修改下面的选项，请前往
                                            <a href="/dashboard/questionnaire" className="text-primary-600 font-bold underline underline-offset-4 ml-1 hover:text-primary-700">
                                                学员问卷
                                            </a>
                                        </div>
                                    </div>

                                    {/* 选项列表：采用与日历项一致的卡片风格 */}
                                    <div className="flex flex-col gap-2.5 mt-2">
                                        {optionQuestions.map((question, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleFilterSelect(question)}
                                                className="
                            group relative flex items-center justify-between p-4
                            bg-white border border-surface-100 rounded-[20px]
                            transition-all duration-300 text-left
                            hover:border-primary-300 hover:bg-primary-50/20 hover:shadow-sm
                            active:scale-[0.98]
                        "
                                            >
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[10px] font-black text-primary-500 uppercase tracking-widest">
                                                        Question {index + 1}
                                                    </span>
                                                    <span className="text-[14px] font-black text-surface-800 tracking-tight">
                                                        {question.question}
                                                    </span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold px-2 py-1 bg-surface-100 text-surface-500 rounded-lg group-hover:bg-primary-100 group-hover:text-primary-600 transition-colors">
                                                        共 {question.options.length} 项
                                                    </span>
                                                    <i className="pi pi-chevron-right text-[10px] text-surface-300 group-hover:text-primary-400 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </Dialog>
                        )}
                </div>
            ) : (
                /* 休息日：骨架感占位 */
                <div className="flex flex-col items-center justify-center py-16 bg-surface-50/40 rounded-[32px] border border-dashed border-surface-200">
                    <div className="w-16 h-16 rounded-full bg-surface flex items-center justify-center text-surface-300 shadow-sm mb-4">
                        <Coffee size={28} strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-black text-surface-900 tracking-tight">全力恢复</h4>
                    <p className="text-[11px] font-bold text-surface-400 uppercase tracking-widest mt-1">Recovery Day</p>
                </div>
            )}

            {/* 底部备注：利用微下沉层级实现的 Aero 文本域 */}
            <div className="mt-6 px-1">
                <div className="flex items-center gap-2 mb-2 ml-1">
                    <label className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em]">
                        日备注
                    </label>
                    <div className="h-[1px] flex-1 bg-surface-100/50"></div>
                </div>

                <InputTextarea
                    value={day.note || ''}
                    onChange={(e) => onNoteChange(dayIndex, e.target.value)}
                    placeholder="记录今日训练的注意事项、学员反馈重点..."
                    rows={2}
                    autoResize
                    // 使用 inputClassName（或在 InputTextarea 中直接用 className）
                    className={`
                        w-full p-4
                        bg-surface-50/50 border border-surface-100/50 rounded-[18px]
                        text-[13px] font-medium text-surface-700 leading-relaxed
                        placeholder:text-surface-300
                        transition-all duration-300
                        hover:bg-surface-50 hover:border-surface-200
                        focus:bg-rounded-2xl focus:border-primary-300 focus:shadow-[0_8px_20px_-12px_rgba(0,0,0,0.1)]
                        focus:ring-0 outline-none
                        resize-none
                    `.trim()}
                />
            </div>

            {/* 添加复制对话框 */}
            {existingTrainingDays && existingTrainingDays.length > 0 && (
                <CopyTrainingDayDialog
                    visible={copyDialogVisible}
                    onHide={() => setCopyDialogVisible(false)}
                    trainingDays={existingTrainingDays}
                    onSelectDay={(sourceDayIndex) => {
                        handleCopyFromDay(dayIndex + 1, sourceDayIndex);
                        setCopyDialogVisible(false);
                    }}
                    saving={saving}
                    actions={actions}
                    targetDayIndex={dayIndex}
                />
            )}
        </div>
    );
};

export default PlanDayCard;
