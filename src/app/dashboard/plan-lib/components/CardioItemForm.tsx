import React from 'react';
import { Dropdown } from 'primereact/dropdown';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';

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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <div className="md:col-span-2">
                 <label className="block text-900 text-xs mb-1 font-medium">选择有氧运动 (可选)</label>
                 <Dropdown 
                    value={item.actionId}
                    options={actionOptions}
                    onChange={(e) => {
                        onUpdate(dayIndex, setIndex, 'actionId', e.value);
                    }}
                    placeholder="选择有氧项目..."
                    className="w-full"
                    filter
                    showClear
                />
             </div>

            <div>
                <label className="block text-900 text-xs mb-1">目标距离 (km)</label>
                <AeroInputNumber
                    value={distance ? distance / 1000 : null}
                    onValueChange={(e) => updateCustomData({ distance: (e.value || 0) * 1000 })}
                    suffix=" km"
                    minFractionDigits={1}
                    maxFractionDigits={2}
                    className="w-full"
                    disabled={saving}
                />
            </div>

            <div>
                <label className="block text-900 text-xs mb-1">目标时长 (分钟)</label>
                <AeroInputNumber
                    value={duration}
                    onValueChange={(e) => updateCustomData({ duration: (e.value || 0) * 60 })} // convert to seconds
                    suffix=" min"
                    className="w-full"
                    disabled={saving}
                />
            </div>

             <div>
                <label className="block text-900 text-xs mb-1">建议配速</label>
                <AeroInputNumber
                    value={customData.pace}
                    onValueChange={(e) => updateCustomData({ pace: e.value })}
                    prefix="约 "
                    suffix=" min/km"
                     minFractionDigits={1}
                    className="w-full"
                    disabled={saving}
                />
            </div>
        </div>
    );
};
