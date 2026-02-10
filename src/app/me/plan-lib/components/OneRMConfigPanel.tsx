import React, { useEffect, useState } from 'react';
import { Card } from 'primereact/card';
import { CoachActionRow } from '@/types';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';

interface OneRMConfigPanelProps {
    days: FormPlanTrainingDay[];
    actions: CoachActionRow[];
    value: Record<string, number>;
    onChange: (newValue: Record<string, number>) => void;
}

const OneRMConfigPanel: React.FC<OneRMConfigPanelProps> = ({ days, actions, value, onChange }) => {
    // 找出所有使用了 "支持自动计算" 动作的 actionId
    const [relevantActions, setRelevantActions] = useState<CoachActionRow[]>([]);

    useEffect(() => {
        const usedActionIds = new Set<string>();
        const usedActionNames = new Set<string>();
        days.forEach(day => {
            day.actionSets.forEach(set => {
                if (set.actionId && typeof set.actionId === 'string') {
                    usedActionIds.add(set.actionId);
                }
                if (set.actionName && typeof set.actionName === 'string') {
                    usedActionNames.add(set.actionName.trim().toLowerCase());
                }
            });
        });

        const canConfigureOneRM = (action: CoachActionRow) => {
            const rawAction = action as CoachActionRow & Record<string, any>;
            if (typeof rawAction.enableAutoWeightCompute === 'boolean') return rawAction.enableAutoWeightCompute;
            if (typeof rawAction.enable_auto_weight_compute === 'boolean') return rawAction.enable_auto_weight_compute;
            if (typeof rawAction.enableautoweightcompute === 'boolean') return rawAction.enableautoweightcompute;
            return Array.isArray(action.attrs) && action.attrs.includes('强度');
        };

        // 筛选出：既在计划中使用，又开启了 enableAutoWeightCompute 的动作
        const filtered = actions.filter(
            a =>
                (usedActionIds.has(a.id) ||
                    (a.name ? usedActionNames.has(a.name.trim().toLowerCase()) : false)) &&
                canConfigureOneRM(a)
        );
        setRelevantActions(filtered);
    }, [days, actions]);

    if (relevantActions.length === 0) {
        return null; // 如果计划中没有相关动作，不显示此面板
    }

    const handleValueChange = (actionId: string, val: number) => {
        onChange({
            ...value,
            [actionId]: val
        });
    };

    return (
        <Card className="mb-6 bg-primary-50 border-primary-100 shadow-none">
            <div className="flex items-center gap-2 mb-3">
                <i className="pi pi-sliders-h text-primary text-xl"></i>
                <h3 className="text-lg font-bold text-900 m-0">核心动作 1RM 设定</h3>
            </div>
            <p className="text-sm text-600 mb-4">
                在此处设置动作的极限重量(1RM)，将自动应用到计划中的所有训练组。
                <br/>
                <span className="text-xs text-500">
                    * 如果您在具体的一组中手动修改了1RM，该组将以手动值为准。
                </span>
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {relevantActions.map(action => (
                    <div key={action.id} className="bg-white p-3 rounded border border-surface-200">
                        <label className="block text-sm font-medium text-700 mb-1 truncate" title={action.name}>
                            {action.name}
                        </label>
                        <div className="p-inputgroup h-9">
                            <AeroInputNumber
                                value={value[action.id] || null}
                                onValueChange={(e) => handleValueChange(action.id, e.value || 0)}
                                placeholder="输入 1RM"
                                min={0}
                                max={500}
                                maxFractionDigits={1}
                                className="p-inputtext-sm"
                            />
                            <span className="p-inputgroup-addon text-xs">kg</span>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export default OneRMConfigPanel;
