'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { CoachActionRow } from '@/types';
import { FormPlanTrainingDay } from '@/app/api/plan-lib/create-template/entity';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import { useToastContext } from '@/context/ToastContext';
import { isOneRMEligibleAction } from '@/lib/oneRmEligibility';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';

interface CoachOneRMConfigPanelProps {
    days: FormPlanTrainingDay[];
    actions: CoachActionRow[];
    studentData: GetStudentResponseDto['student'] | null;
    subscriptionId: string;
    onSave?: (updates: SavedOneRMUpdate[]) => void;
}

export interface SavedOneRMUpdate {
    coachActionId: string;
    studentActionId: string;
    actionName: string;
    canonicalActionId: string | null;
    reference_1rm: number | null;
}

interface StudentActionWith1RM {
    id: string;
    name: string;
    reference_1rm: number | null;
    canonical_action_id: string | null;
}

type MatchedActionMap = Record<string, StudentActionWith1RM>;

const CoachOneRMConfigPanel: React.FC<CoachOneRMConfigPanelProps> = ({
    days,
    actions,
    studentData,
    subscriptionId,
    onSave,
}) => {
    const { showToast } = useToastContext();
    const [studentActions, setStudentActions] = useState<StudentActionWith1RM[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [oneRMValues, setOneRMValues] = useState<Record<string, number | null>>({});
    const [savedOneRMValues, setSavedOneRMValues] = useState<Record<string, number | null>>({});
    const loadedSignatureRef = useRef('');

    const normalizeName = (name?: string | null) => (name || '').trim().toLowerCase();

    const buildMatchedMap = (
        coachActions: CoachActionRow[],
        studentRows: any[],
    ): { map: MatchedActionMap; values: Record<string, number | null> } => {
        const map: MatchedActionMap = {};
        const values: Record<string, number | null> = {};

        for (const coachAction of coachActions) {
            let matched = studentRows.find((sa) =>
                coachAction.canonical_action_id &&
                sa.canonical_action_id &&
                sa.canonical_action_id === coachAction.canonical_action_id,
            );

            if (!matched) {
                const targetName = normalizeName(coachAction.name);
                matched = studentRows.find((sa) => normalizeName(sa.name) === targetName);
            }

            if (matched) {
                map[coachAction.id] = {
                    id: matched.id,
                    name: matched.name,
                    reference_1rm: matched.reference_1rm,
                    canonical_action_id: matched.canonical_action_id,
                };
                values[coachAction.id] = matched.reference_1rm;
            } else {
                map[coachAction.id] = {
                    id: '',
                    name: coachAction.name,
                    reference_1rm: null,
                    canonical_action_id: coachAction.canonical_action_id || null,
                };
                values[coachAction.id] = null;
            }
        }

        return { map, values };
    };

    // 找出计划中需要1RM的动作
    const eligibleActions = useMemo(() => {
        const usedActionIds = new Set<string>();
        const usedActionNames = new Set<string>();
        
        days.forEach(day => {
            day.actionSets?.forEach((set: any) => {
                const actionId = set.action_id || set.actionId;
                if (actionId) {
                    usedActionIds.add(actionId);
                }
                if (set.actionName && typeof set.actionName === 'string') {
                    usedActionNames.add(set.actionName.trim().toLowerCase());
                }
            });
        });

        return actions.filter(action => {
            const isUsed = usedActionIds.has(action.id) ||
                (action.name ? usedActionNames.has(action.name.trim().toLowerCase()) : false);
            
            if (!isUsed) return false;

            return isOneRMEligibleAction({
                type: action.type,
                attrs: action.attrs || undefined,
                enableAutoWeightCompute: action.enableAutoWeightCompute ?? (action as any).enable_auto_weight_compute,
            });
        });
    }, [days, actions]);

    const eligibleActionSignature = useMemo(
        () => eligibleActions
            .map(action => [action.id, action.canonical_action_id || '', normalizeName(action.name)].join(':'))
            .sort()
            .join('|'),
        [eligibleActions],
    );

    const normalizeOneRMValue = (value: number | null | undefined) => {
        const numeric = Number(value);
        return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
    };

    const hasDirtyValues = useMemo(
        () => eligibleActions.some(action =>
            normalizeOneRMValue(oneRMValues[action.id]) !==
            normalizeOneRMValue(savedOneRMValues[action.id])
        ),
        [eligibleActions, oneRMValues, savedOneRMValues],
    );

    // 加载学员动作库
    useEffect(() => {
        if (!subscriptionId || eligibleActions.length === 0) {
            setStudentActions([]);
            setOneRMValues({});
            setSavedOneRMValues({});
            setLoading(false);
            loadedSignatureRef.current = '';
            return;
        }

        const requestSignature = `${subscriptionId}:${eligibleActionSignature}`;
        if (loadedSignatureRef.current === requestSignature) return;
        loadedSignatureRef.current = requestSignature;

        const loadStudentActions = async () => {
            let loadFailed = false;
            setLoading(true);
            try {
                const res = await fetch('/api/coach/get-student-actions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subscriptionId }),
                });

                const data = await res.json();
                if (!res.ok || !data.success || !Array.isArray(data.data?.actions)) {
                    throw new Error(data.message || '无法获取学员动作库数据');
                }

                const studentActionRows = data.data.actions as any[];
                const matched = buildMatchedMap(eligibleActions, studentActionRows);
                if (loadedSignatureRef.current !== requestSignature) return;
                setStudentActions(Object.values(matched.map));
                setOneRMValues(matched.values);
                setSavedOneRMValues(matched.values);
            } catch (error) {
                loadFailed = true;
                console.error('加载学员动作库失败:', error);
                showToast({
                    severity: 'error',
                    summary: '加载失败',
                    detail: '无法获取学员动作库数据',
                });
            } finally {
                if (loadedSignatureRef.current === requestSignature) {
                    if (loadFailed) loadedSignatureRef.current = '';
                    setLoading(false);
                }
            }
        };

        loadStudentActions();
    }, [subscriptionId, eligibleActionSignature]);

    const handleValueChange = (coachActionId: string, val: number | null) => {
        setOneRMValues(prev => ({
            ...prev,
            [coachActionId]: val,
        }));
    };

    const handleSave = async () => {
        if (!studentData?.id) {
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: '学员信息不存在',
            });
            return;
        }

        // 只提交相对已保存值真正发生变化、且已经同步到学员动作库的动作。
        const updates: Array<{ actionId: string; reference_1rm: number | null }> = [];
        const savedUpdates: SavedOneRMUpdate[] = [];
        
        eligibleActions.forEach((coachAction) => {
            const studentAction = studentActions.find((s) =>
                (coachAction.canonical_action_id &&
                    s.canonical_action_id &&
                    s.canonical_action_id === coachAction.canonical_action_id) ||
                normalizeName(s.name) === normalizeName(coachAction.name),
            );
            if (studentAction && studentAction.id) {
                const value = normalizeOneRMValue(oneRMValues[coachAction.id]);
                const savedValue = normalizeOneRMValue(savedOneRMValues[coachAction.id]);
                if (value === savedValue) return;

                updates.push({
                    actionId: studentAction.id,
                    reference_1rm: value,
                });
                savedUpdates.push({
                    coachActionId: coachAction.id,
                    studentActionId: studentAction.id,
                    actionName: coachAction.name,
                    canonicalActionId: coachAction.canonical_action_id || null,
                    reference_1rm: value,
                });
            }
        });

        if (updates.length === 0) {
                showToast({
                    severity: 'info',
                    summary: '无需更新',
                    detail: hasDirtyValues
                        ? '改动的动作尚未同步到学员动作库，请先保存计划'
                        : '1RM 数值没有变化',
                });
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/coach/batch-update-student-1rm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscriptionId, updates }),
            });

            const data = await res.json();
            if (data.success) {
                showToast({
                    severity: 'success',
                    summary: '保存成功',
                    detail: `已更新 ${data.data?.updated || 0} 个动作的1RM`,
                });

                const savedValuePatch = Object.fromEntries(
                    savedUpdates.map(update => [update.coachActionId, update.reference_1rm]),
                );
                setSavedOneRMValues(prev => ({ ...prev, ...savedValuePatch }));
                setOneRMValues(prev => ({ ...prev, ...savedValuePatch }));
                setStudentActions(prev => prev.map(action => {
                    const update = savedUpdates.find(item => item.studentActionId === action.id);
                    return update ? { ...action, reference_1rm: update.reference_1rm } : action;
                }));
                onSave?.(savedUpdates);
            } else {
                throw new Error(data.message || '保存失败');
            }
        } catch (error) {
            console.error('保存1RM失败:', error);
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: error instanceof Error ? error.message : '无法保存1RM设置',
            });
        } finally {
            setSaving(false);
        }
    };

    if (eligibleActions.length === 0) {
        return null;
    }

    if (loading) {
        return (
            <Card className="mb-6 bg-primary-50 border-primary-100 shadow-none">
                <div className="flex justify-center py-6">
                    <ProgressSpinner style={{ width: '40px', height: '40px' }} className="text-primary" strokeWidth="4" />
                </div>
            </Card>
        );
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
                    disabled={saving || !hasDirtyValues}
                    className="p-button-sm"
                />
            </div>
            <p className="text-sm text-600 mb-4">
                为学员设置动作的极限重量(1RM)，将用于自动计算训练负荷。
                <br/>
                <span className="text-xs text-500">
                    * 如果学员动作库中还没有这些动作，请先保存计划以自动同步。
                </span>
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {eligibleActions.map((coachAction, index) => {
                    const studentAction = studentActions.find((s) =>
                        (coachAction.canonical_action_id &&
                            s.canonical_action_id &&
                            s.canonical_action_id === coachAction.canonical_action_id) ||
                        normalizeName(s.name) === normalizeName(coachAction.name),
                    );
                    const hasStudentAction = studentAction && studentAction.id;
                    const currentValue = oneRMValues[coachAction.id] ?? null;

                    return (
                        <div
                            key={coachAction.id}
                            className={`bg-white p-3 rounded border ${
                                hasStudentAction ? 'border-surface-200' : 'border-amber-300 bg-amber-50'
                            }`}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <label
                                    className="block text-sm font-medium text-700 truncate flex-1"
                                    title={coachAction.name}
                                >
                                    {coachAction.name}
                                </label>
                                {!hasStudentAction && (
                                    <span className="text-xs text-amber-600 ml-2">未同步</span>
                                )}
                            </div>
                            <div className="p-inputgroup h-9">
                                <AeroInputNumber
                                    value={currentValue}
                                    onValueChange={(e) =>
                                        handleValueChange(
                                            coachAction.id,
                                            e.value ?? null
                                        )
                                    }
                                    placeholder="输入 1RM"
                                    min={0}
                                    max={500}
                                    maxFractionDigits={1}
                                    className="p-inputtext-sm"
                                    disabled={!hasStudentAction}
                                />
                                <span className="p-inputgroup-addon text-xs">kg</span>
                            </div>
                            {!hasStudentAction && (
                                <div className="mt-1 text-xs text-amber-600">
                                    请先保存计划以同步动作
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

export default CoachOneRMConfigPanel;

