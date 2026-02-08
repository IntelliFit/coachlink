import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';

interface CardioItemFormProps {
    item: CoachPlanAction;
    setIndex: number;
    dayIndex: number;
    saving: boolean;
    onUpdate: (dayIndex: number, setIndex: number, field: string, value: any) => void;
    actionOptions?: { label: string; value: string; action: any }[];
}

export const CardioItemForm: React.FC<CardioItemFormProps> = ({
    item,
    setIndex,
    dayIndex,
    saving,
    onUpdate,
    actionOptions = []
}) => {
    const customData = item.params?.custom_data || {};
    const distance = customData.distance || null; // meters
    const duration = customData.duration ? customData.duration / 60 : null; // stored in seconds, display in minutes
    
    // 运动类型（可以复用 actionId 如果有预设动作，这里简化为直接在 custom_data 中存储或使用 actionId）
    // 目前假设 actionId 已经指向了一个 TYPE=CARDIO 的动作，或者我们允许自定义
    // 这里简单处理为显示参数

    const updateCustomData = (updates: any) => {
        onUpdate(dayIndex, setIndex, 'params', {
            ...item.params,
            custom_data: {
                ...customData,
                ...updates
            }
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
                    placeholder="选择有氧项目"
                    filter
                    showClear
                    className="action-dropdown-compact w-full rounded-xl"
                    panelClassName="action-dropdown-compact-panel max-w-[340px]"
                    scrollHeight="260px"
                    appendTo="self"
                    disabled={saving}
                    itemTemplate={(opt) => opt?.action && <ActionOptionTemplate action={opt.action} />}
                    valueTemplate={(opt) => opt?.action ? <ActionValueTemplate action={opt.action} /> : <span className="text-sm">选择有氧项目</span>}
                />
            </div>

            <div className="md:col-span-2">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    <div className="min-w-0 flex flex-col">
                        <div className="flex justify-between items-end mb-1 px-0.5">
                            <label className="text-surface-500 text-[10px] font-bold truncate leading-none">目标距离</label>
                            <span className="text-surface-400 text-[9px] font-medium leading-none ml-1 flex-shrink-0">km</span>
                        </div>
                        <AeroInputNumber
                            value={distance ? distance / 1000 : null}
                            onValueChange={(e) => updateCustomData({ distance: (e.value || 0) * 1000 })}
                            minFractionDigits={1}
                            maxFractionDigits={2}
                            inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                            disabled={saving}
                            showButtons={false}
                        />
                    </div>

                    <div className="min-w-0 flex flex-col">
                        <div className="flex justify-between items-end mb-1 px-0.5">
                            <label className="text-surface-500 text-[10px] font-bold truncate leading-none">目标时长</label>
                            <span className="text-surface-400 text-[9px] font-medium leading-none ml-1 flex-shrink-0">min</span>
                        </div>
                        <AeroInputNumber
                            value={duration}
                            onValueChange={(e) => updateCustomData({ duration: (e.value || 0) * 60 })}
                            inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                            disabled={saving}
                            showButtons={false}
                        />
                    </div>

                    <div className="min-w-0 flex flex-col">
                        <div className="flex justify-between items-end mb-1 px-0.5">
                            <label className="text-surface-500 text-[10px] font-bold truncate leading-none">建议配速</label>
                            <span className="text-surface-400 text-[9px] font-medium leading-none ml-1 flex-shrink-0">min/km</span>
                        </div>
                        <AeroInputNumber
                            value={customData.pace}
                            onValueChange={(e) => updateCustomData({ pace: e.value })}
                            minFractionDigits={1}
                            inputClassName="w-full border border-surface-200 rounded-2xl text-sm !py-2 !px-3"
                            disabled={saving}
                            showButtons={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
