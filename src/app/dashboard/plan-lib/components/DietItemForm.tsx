import React from 'react';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { ActionOptionTemplate, ActionValueTemplate, ActionEmptyMessage } from './PlanDayCard';

interface DietItemFormProps {
    item: CoachPlanAction; // 使用通用类型，但在内部处理 custom_data
    setIndex: number;
    dayIndex: number;
    saving: boolean;
    onUpdate: (dayIndex: number, setIndex: number, field: string, value: any) => void;
    actionOptions?: { label: string; value: string; action: any }[]; // Optional for now
}


export const DietItemForm: React.FC<DietItemFormProps> = ({
    item,
    setIndex,
    dayIndex,
    saving,
    onUpdate,
    actionOptions = []
}) => {

    // 从 params 中获取数据（兼容现有架构）
    const customData = item.params?.custom_data || {};
    const content = customData.content || '';
    const calories = customData.calories || null;
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
                    placeholder="选择饮食项目"
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
                    valueTemplate={(opt) => opt?.action ? <ActionValueTemplate action={opt.action} /> : <span className="text-sm">选择饮食项目</span>}
                />
            </div>

            <div className="md:col-span-2">
                <label className="block text-surface-500 text-[10px] font-bold mb-1 px-0.5">食物重量 / 份量</label>
                <InputTextarea
                    value={content}
                    onChange={(e) => updateCustomData({ content: e.target.value })}
                    rows={2}
                    className="w-full border border-surface-200 rounded-2xl text-sm py-2 px-3 resize-none"
                    placeholder="例如：100g / 2片 / 1杯"
                    disabled={saving}
                />
            </div>

            <div className="md:col-span-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="min-w-0 flex flex-col">
                        <div className="flex justify-between items-end mb-1 px-0.5">
                            <label className="text-surface-500 text-[10px] font-bold truncate leading-none">参考热量</label>
                            <span className="text-surface-400 text-[9px] font-medium leading-none ml-1 flex-shrink-0">kcal</span>
                        </div>
                        <AeroInputNumber
                            value={calories}
                            onValueChange={(e) => updateCustomData({ calories: e.value })}
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
                            placeholder="如：早餐/晚餐/烹饪方式"
                            disabled={saving}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
