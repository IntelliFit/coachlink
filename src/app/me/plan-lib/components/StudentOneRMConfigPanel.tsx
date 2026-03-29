'use client';

import React, { useMemo, useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { CoachActionRow } from '@/types';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { useToastContext } from '@/context/ToastContext';
import { isOneRMEligibleAction } from '@/lib/oneRmEligibility';

interface StudentOneRMConfigPanelProps {
    days: FormPlanTrainingDay[];
    actions: CoachActionRow[];
    value: Record<string, number>;
    onChange: (newValue: Record<string, number>) => void;
    onSaved?: () => void | Promise<void>;
}

const normalizeName = (name?: string | null) => (name || '').trim().toLowerCase();

const StudentOneRMConfigPanel: React.FC<StudentOneRMConfigPanelProps> = ({
    days,
    actions,
    value,
    onChange,
    onSaved,
}) => {
    const { showToast } = useToastContext();
    const [saving, setSaving] = useState(false);

    const eligibleActions = useMemo(() => {
        const usedActionIds = new Set<string>();
        const usedActionNames = new Set<string>();

        days.forEach(day => {
            day.actionSets?.forEach((set: any) => {
                const actionId = set.action_id || set.actionId;
                if (actionId && typeof actionId === 'string') {
                    usedActionIds.add(actionId);
                }
                if (set.actionName && typeof set.actionName === 'string') {
                    usedActionNames.add(normalizeName(set.actionName));
                }
            });
        });

        return actions.filter(action => {
            const isUsed =
                usedActionIds.has(action.id) ||
                (action.name ? usedActionNames.has(normalizeName(action.name)) : false);

            if (!isUsed) return false;

            return isOneRMEligibleAction({
                type: action.type,
                attrs: action.attrs || undefined,
                enableAutoWeightCompute:
                    action.enableAutoWeightCompute ?? (action as any).enable_auto_weight_compute,
            });
        });
    }, [days, actions]);

    const handleValueChange = (actionId: string, nextValue: number | null) => {
        const next = { ...value };
        if (nextValue === null || !Number.isFinite(nextValue) || nextValue <= 0) {
            delete next[actionId];
        } else {
            next[actionId] = nextValue;
        }
        onChange(next);
    };

    const handleSave = async () => {
        if (eligibleActions.length === 0) {
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/student/action-lib/batch-update-1rm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    updates: eligibleActions.map(action => ({
                        actionId: action.id,
                        reference_1rm: value[action.id] ?? null,
                    })),
                }),
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || '保存失败');
            }

            showToast({
                severity: 'success',
                summary: '保存成功',
                detail: `已更新 ${data.data?.updated || 0} 个动作的1RM`,
            });

            await onSaved?.();
        } catch (error) {
            console.error('保存学员 1RM 失败:', error);
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: '无法保存学员动作 1RM',
            });
        } finally {
            setSaving(false);
        }
    };

    if (eligibleActions.length === 0) {
        return null;
    }

    return (
        <Card className="mb-6 bg-primary-50 border-primary-100 shadow-none">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <i className="pi pi-sliders-h text-primary text-xl"></i>
                    <h3 className="text-lg font-bold text-900 m-0">学员动作 1RM 设定</h3>
                </div>
                <Button
                    label="保存"
                    icon="pi pi-check"
                    onClick={handleSave}
                    loading={saving}
                    className="p-button-sm"
                />
            </div>
            <p className="text-sm text-600 mb-4">
                设置当前计划涉及动作的全局 1RM，训练组里的自动负荷会优先按这里计算。
                <br />
                <span className="text-xs text-500">
                    * 清空后会回退为未设置状态；保存后会同步到你的动作库。
                </span>
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {eligibleActions.map(action => (
                    <div
                        key={action.id}
                        className="bg-white p-3 rounded border border-surface-200"
                    >
                        <label
                            className="block text-sm font-medium text-700 mb-1 truncate"
                            title={action.name}
                        >
                            {action.name}
                        </label>
                        <div className="p-inputgroup h-9">
                            <AeroInputNumber
                                value={value[action.id] ?? null}
                                onValueChange={(e) => handleValueChange(action.id, e.value ?? null)}
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

export default StudentOneRMConfigPanel;
