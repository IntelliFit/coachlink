import React from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { ActionOptionTemplate, ActionValueTemplate, ActionEmptyMessage } from './PlanDayCard';

interface HabitItemFormProps {
    item: CoachPlanAction;
    setIndex: number;
    dayIndex: number;
    saving: boolean;
    onUpdate: (dayIndex: number, setIndex: number, field: string, value: any) => void;
    actionOptions?: { label: string; value: string; action: any }[];
}

export const HabitItemForm: React.FC<HabitItemFormProps> = ({
    item,
    setIndex,
    dayIndex,
    saving,
    onUpdate,
    actionOptions = []
}) => {
    const customData = item.params?.custom_data || {};
    const targetDuration = customData.target_duration || null; // minutes
    const habitName = customData.habit_name || ''; // 如果没有 actionId，允许输入名字
    const note = item.params?.note || '';

    const updateCustomData = (updates: any) => {
        onUpdate(dayIndex, setIndex, 'params', {
            ...item.params,
            custom_data: {
                ...customData,
                ...updates
            }
        });
    };

    const updateNote = (nextNote: string) => {
        onUpdate(dayIndex, setIndex, 'params', {
            ...item.params,
            note: nextNote,
        });
    };

    return (
        <div className="grid grid-cols-1 gap-3">
            <div className="md:col-span-2 max-w-[340px]">
                <label className="block text-surface-500 text-[10px] font-bold mb-1 px-0.5">动作</label>
                <Dropdown
                    value={item.actionId}
                    options={actionOptions}
                    onChange={(e) => onUpdate(dayIndex, setIndex, 'actionId', e.value)}
                    optionLabel="label"
                    placeholder="选择习惯项目"
                    filter
                    emptyMessage={<ActionEmptyMessage type="empty" />}
                    emptyFilterMessage={<ActionEmptyMessage type="filter" />}
                    showClear
                    className="action-dropdown-compact w-full rounded-xl"
                    panelClassName="action-dropdown-compact-panel max-w-[340px]"
                    scrollHeight="260px"
                    appendTo="self"
                    disabled={saving}
                    itemTemplate={(opt) => opt?.action && <ActionOptionTemplate action={opt.action} />}
                    valueTemplate={(opt) => opt?.action ? <ActionValueTemplate action={opt.action} /> : <span className="text-sm">选择习惯项目</span>}
                />
            </div>

            {!item.actionId && (
                <div className="md:col-span-2 max-w-[340px]">
                    <label className="block text-surface-500 text-[10px] font-bold mb-1 px-0.5">或输入习惯名称</label>
                    <InputText
                        value={habitName}
                        onChange={(e) => updateCustomData({ habit_name: e.target.value })}
                        placeholder="例如：冥想、阅读、早起"
                        className="w-full border border-surface-200 rounded-2xl text-sm py-2 px-3"
                        disabled={saving}
                    />
                </div>
            )}

            <div className="md:col-span-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    <div className="min-w-0 flex flex-col">
                        <div className="flex justify-between items-end mb-1 px-0.5">
                            <label className="text-surface-500 text-[10px] font-bold truncate leading-none">目标时长</label>
                            <span className="text-surface-400 text-[9px] font-medium leading-none ml-1 flex-shrink-0">min</span>
                        </div>
                        <AeroInputNumber
                            value={targetDuration}
                            onValueChange={(e) => updateCustomData({ target_duration: e.value })}
                            inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                            disabled={saving}
                            showButtons={false}
                        />
                    </div>
                    <div className="min-w-0 flex flex-col col-span-2 sm:col-span-3">
                        <label className="block text-surface-500 text-[10px] font-bold mb-1 px-0.5">备注</label>
                        <InputTextarea
                            value={note}
                            onChange={(e) => updateNote(e.target.value)}
                            rows={1}
                            className="w-full border border-surface-200 rounded-2xl text-sm py-2 px-3 resize-none"
                            placeholder="例如：日饮水 2L / 阅读 30分钟"
                            disabled={saving}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
