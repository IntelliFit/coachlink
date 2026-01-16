import React from 'react';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';

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
            <div>
                <label className="block text-900 text-xs mb-1 font-medium">选择习惯模板 (可选)</label>
                <Dropdown 
                    value={item.actionId}
                    options={actionOptions}
                    onChange={(e) => {
                        onUpdate(dayIndex, setIndex, 'actionId', e.value);
                    }}
                    placeholder="选择习惯项目..."
                    className="w-full mb-2"
                    filter
                    showClear
                />
                {!item.actionId && (
                    <div>
                        <label className="block text-900 text-xs mb-1">或 输入习惯名称</label>
                        <InputText
                            value={habitName}
                            onChange={(e) => updateCustomData({ habit_name: e.target.value })}
                            placeholder="例如：冥想、阅读、早起"
                            className="w-full"
                            disabled={saving}
                        />
                    </div>
                )}
            </div>

            <div>
                <label className="block text-900 text-xs mb-1">目标时长 (可选)</label>
                <AeroInputNumber
                    value={targetDuration}
                    onValueChange={(e) => updateCustomData({ target_duration: e.value })}
                    suffix=" 分钟"
                    className="w-full"
                    disabled={saving}
                    placeholder="例如：10分钟"
                />
            </div>
        </div>
    );
};
