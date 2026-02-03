import React from 'react';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { CoachPlanAction } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';

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
             <div className="mb-2">
                <label className="block text-900 text-xs mb-1 font-medium">选择饮食建议模板 (可选)</label>
                <Dropdown 
                    value={item.actionId}
                    options={actionOptions}
                    onChange={(e) => {
                        onUpdate(dayIndex, setIndex, 'actionId', e.value);
                        // Optional: Pre-fill content if action has default details
                        // const selected = actionOptions.find(opt => opt.value === e.value)?.action;
                    }}
                    placeholder="选择饮食项目..."
                    className="w-full"
                    filter
                    showClear
                />
            </div>
            <div>
                <label className="block text-900 text-xs mb-1">食物重量 / 份量</label>
                <InputTextarea
                    value={content}
                    onChange={(e) => updateCustomData({ content: e.target.value })}
                    rows={2}
                    className="w-full"
                    placeholder="例如：100g / 2片 / 1杯"
                    disabled={saving}
                />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-900 text-xs mb-1">参考热量 (kcal)</label>
                    <AeroInputNumber
                        value={calories}
                        onValueChange={(e) => updateCustomData({ calories: e.value })}
                        suffix=" kcal"
                        className="w-full"
                        disabled={saving}
                    />
                </div>
                <div>
                    <label className="block text-900 text-xs mb-1">备注</label>
                    <InputTextarea
                        value={note}
                        onChange={(e) => updateNote(e.target.value)}
                        rows={2}
                        className="w-full"
                        placeholder="如：早餐/晚餐/烹饪方式"
                        disabled={saving}
                    />
                </div>
            </div>
            
            {/* 图片上传预留位 - 暂时只支持文本链接或后续实现 */}
        </div>
    );
};
