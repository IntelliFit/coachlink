'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Dropdown } from 'primereact/dropdown';
import { Button } from 'primereact/button';
import { CoachActionRow } from '@/types';
import { ActionOptionTemplate, ActionValueTemplate } from './PlanDayCard';
import { isActionFullyCompatible } from '@/lib/planBatchUtils';

export type BatchOperation =
    | { type: 'replace'; fromActionId: string; toActionId: string }
    | { type: 'delete'; actionId: string }
    | {
        type: 'append';
        actionId: string;
        weekStart: number;
        weekEnd: number;
        weekdays: number[];
    };

interface BatchActionsDialogProps {
    visible: boolean;
    onHide: () => void;
    actions: CoachActionRow[];
    maxWeeks: number;
    onApply: (operation: BatchOperation) => void;
    disabled?: boolean;
}

const weekdayOptions = [
    { label: '周一', value: 1 },
    { label: '周二', value: 2 },
    { label: '周三', value: 3 },
    { label: '周四', value: 4 },
    { label: '周五', value: 5 },
    { label: '周六', value: 6 },
    { label: '周日', value: 7 },
];

const BatchActionsDialog: React.FC<BatchActionsDialogProps> = ({
    visible,
    onHide,
    actions,
    maxWeeks,
    onApply,
    disabled = false,
}) => {
    const [mode, setMode] = useState<'replace' | 'delete' | 'append'>('replace');
    const [fromActionId, setFromActionId] = useState<string>('');
    const [toActionId, setToActionId] = useState<string>('');
    const [deleteActionId, setDeleteActionId] = useState<string>('');
    const [appendActionId, setAppendActionId] = useState<string>('');
    const [weekStart, setWeekStart] = useState<number>(1);
    const [weekEnd, setWeekEnd] = useState<number>(Math.max(1, maxWeeks));
    const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);

    const actionOptions = useMemo(
        () =>
            actions.map(action => ({
                label: action.name,
                value: action.id,
                action,
            })),
        [actions],
    );

    const weekOptions = useMemo(
        () =>
            Array.from({ length: Math.max(1, maxWeeks) }, (_, idx) => ({
                label: `第 ${idx + 1} 周`,
                value: idx + 1,
            })),
        [maxWeeks],
    );

    const fromAction = actions.find(action => action.id === fromActionId) || null;
    const toAction = actions.find(action => action.id === toActionId) || null;
    const isCompatible = isActionFullyCompatible(fromAction, toAction);

    const canApply = (() => {
        if (disabled) return false;
        if (mode === 'replace') {
            return Boolean(fromActionId && toActionId && isCompatible);
        }
        if (mode === 'delete') {
            return Boolean(deleteActionId);
        }
        return Boolean(appendActionId && weekStart <= weekEnd && weekdays.length > 0);
    })();

    const handleApply = () => {
        if (!canApply) return;
        if (mode === 'replace') {
            onApply({ type: 'replace', fromActionId, toActionId });
        } else if (mode === 'delete') {
            onApply({ type: 'delete', actionId: deleteActionId });
        } else {
            onApply({
                type: 'append',
                actionId: appendActionId,
                weekStart,
                weekEnd,
                weekdays,
            });
        }
        onHide();
    };

    return (
        <Dialog
            header="批量操作"
            visible={visible}
            onHide={onHide}
            modal
            style={{ width: '90vw', maxWidth: '560px' }}
            className="aero-dialog"
            contentClassName="p-0 border-t border-surface-100"
            footer={
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-surface-100 bg-surface">
                    <Button
                        label="取消"
                        className="p-button-text"
                        onClick={onHide}
                        disabled={disabled}
                    />
                    <Button
                        label="应用"
                        className="p-button-primary"
                        onClick={handleApply}
                        disabled={!canApply}
                    />
                </div>
            }
        >
            <div className="flex flex-col gap-4 p-5">
                <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                        操作类型
                    </label>
                    <Dropdown
                        value={mode}
                        options={[
                            { label: '动作替换（完全兼容）', value: 'replace' },
                            { label: '批量删除动作', value: 'delete' },
                            { label: '按周追加动作', value: 'append' },
                        ]}
                        onChange={(e) => setMode(e.value)}
                        className="w-full"
                        disabled={disabled}
                    />
                </div>

                {mode === 'replace' && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                                替换前动作
                            </label>
                            <Dropdown
                                value={fromActionId}
                                options={actionOptions}
                                onChange={(e) => setFromActionId(e.value)}
                                placeholder="选择动作"
                                itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                                valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                                className="w-full"
                                filter
                                disabled={disabled}
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                                替换为动作
                            </label>
                            <Dropdown
                                value={toActionId}
                                options={actionOptions}
                                onChange={(e) => setToActionId(e.value)}
                                placeholder="选择动作"
                                itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                                valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                                className="w-full"
                                filter
                                disabled={disabled}
                            />
                        </div>
                        {fromActionId && toActionId && (
                            <div
                                className={`text-[12px] font-bold px-3 py-2 rounded-xl ${
                                    isCompatible
                                        ? 'bg-primary-50 text-primary-700'
                                        : 'bg-red-50 text-red-500'
                                }`}
                            >
                                {isCompatible
                                    ? '动作属性完全一致，可保留原有组数/次数/休息'
                                    : '动作属性不一致，无法替换'}
                            </div>
                        )}
                    </div>
                )}

                {mode === 'delete' && (
                    <div className="flex flex-col gap-2">
                        <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                            删除动作
                        </label>
                        <Dropdown
                            value={deleteActionId}
                            options={actionOptions}
                            onChange={(e) => setDeleteActionId(e.value)}
                            placeholder="选择动作"
                            itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                            valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                            className="w-full"
                            filter
                            disabled={disabled}
                        />
                    </div>
                )}

                {mode === 'append' && (
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                                追加动作
                            </label>
                            <Dropdown
                                value={appendActionId}
                                options={actionOptions}
                                onChange={(e) => setAppendActionId(e.value)}
                                placeholder="选择动作"
                                itemTemplate={(option) => <ActionOptionTemplate action={option.action} />}
                                valueTemplate={(option) => <ActionValueTemplate action={option?.action || null} />}
                                className="w-full"
                                filter
                                disabled={disabled}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                                    起始周
                                </label>
                                <Dropdown
                                    value={weekStart}
                                    options={weekOptions}
                                    onChange={(e) => setWeekStart(e.value)}
                                    className="w-full"
                                    disabled={disabled}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                                    结束周
                                </label>
                                <Dropdown
                                    value={weekEnd}
                                    options={weekOptions}
                                    onChange={(e) => setWeekEnd(e.value)}
                                    className="w-full"
                                    disabled={disabled}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-[11px] font-black text-surface-400 uppercase tracking-widest px-1">
                                周内天
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {weekdayOptions.map((option) => {
                                    const active = weekdays.includes(option.value);
                                    return (
                                        <button
                                            type="button"
                                            key={option.value}
                                            onClick={() => {
                                                setWeekdays((prev) =>
                                                    active
                                                        ? prev.filter((d) => d !== option.value)
                                                        : [...prev, option.value],
                                                );
                                            }}
                                            className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                                                active
                                                    ? 'bg-primary-500 text-surface shadow-md shadow-primary-500/20'
                                                    : 'bg-surface-50 text-surface-400 hover:bg-surface-100'
                                            }`}
                                            disabled={disabled}
                                        >
                                            {option.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
};

export default BatchActionsDialog;







