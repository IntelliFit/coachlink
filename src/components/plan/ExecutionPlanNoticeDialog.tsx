'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dialog } from 'primereact/dialog';

type ExecutionPlanNoticeMode = 'confirm' | 'read';

interface ExecutionPlanNoticeDialogProps {
    visible: boolean;
    mode?: ExecutionPlanNoticeMode;
    executionNotice?: string | null;
    planName?: string | null;
    onHide?: () => void;
    onConfirm?: () => void;
    confirmLabel?: string;
    confirmLoading?: boolean;
}

const SAFETY_BASELINES = [
    '出现锐痛、头晕、胸闷或其他异常不适时，先停止训练。',
    '重量、次数、RPE、视频和备注要按真实情况记录。',
    '看不懂动作或强度要求时，先暂停并联系教练确认。',
];

export default function ExecutionPlanNoticeDialog({
    visible,
    mode = 'confirm',
    executionNotice,
    planName,
    onHide,
    onConfirm,
    confirmLabel,
    confirmLoading = false,
}: ExecutionPlanNoticeDialogProps) {
    const [checked, setChecked] = useState(mode === 'read');
    const coachNotice = String(executionNotice || '').trim();

    useEffect(() => {
        if (!visible) return;
        setChecked(mode === 'read');
    }, [mode, visible]);

    const requiresConfirm = mode === 'confirm';
    const finalConfirmLabel = confirmLabel || (requiresConfirm ? '我已阅读，开始训练' : '我知道了');

    return (
        <Dialog
            header="执行计划阅读须知"
            visible={visible}
            onHide={onHide || (() => undefined)}
            closable={!requiresConfirm}
            draggable={false}
            resizable={false}
            modal
            className="w-[min(94vw,640px)]"
        >
            <div className="space-y-5 text-surface-700">
                <div className="rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3">
                    <div className="flex items-start gap-3">
                        <i className="pi pi-info-circle mt-0.5 text-primary-700" />
                        <div>
                            <div className="text-sm font-bold text-primary-900">先看教练给这份计划写的执行须知</div>
                            <p className="mt-1 text-sm leading-relaxed text-primary-800">
                                {planName
                                    ? `开始「${planName}」之前，请先确认这份计划的执行要求、注意事项和记录方式。`
                                    : '开始训练前，请先确认这份计划的执行要求、注意事项和记录方式。'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
                    <div className="mb-2 text-sm font-bold text-surface-900">教练执行须知</div>
                    {coachNotice ? (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-surface-700">
                            {coachNotice}
                        </div>
                    ) : (
                        <div className="text-sm leading-relaxed text-surface-600">
                            教练暂未填写这份计划的专属执行须知。开始前仍请遵守下面的安全底线，并在不确定时先联系教练。
                        </div>
                    )}
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                    <div className="mb-2 text-sm font-bold text-amber-900">平台安全底线</div>
                    <div className="space-y-2">
                        {SAFETY_BASELINES.map((item, index) => (
                            <div key={item} className="flex gap-3">
                                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-900">
                                    {index + 1}
                                </div>
                                <p className="m-0 text-sm leading-relaxed text-amber-900">{item}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {requiresConfirm && (
                    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-surface-200 px-4 py-3">
                        <Checkbox
                            inputId="execution-plan-notice-confirm"
                            checked={checked}
                            onChange={(event) => setChecked(Boolean(event.checked))}
                            className="mt-0.5"
                        />
                        <span className="text-sm leading-relaxed text-surface-700">
                            我已阅读并理解教练设置的执行须知和平台安全底线，会按真实情况安全执行并记录反馈。
                        </span>
                    </label>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    {!requiresConfirm && (
                        <Button
                            label={finalConfirmLabel}
                            icon="pi pi-check"
                            onClick={onConfirm || onHide}
                            className="w-full sm:w-auto"
                        />
                    )}
                    {requiresConfirm && (
                        <Button
                            label={finalConfirmLabel}
                            icon="pi pi-play"
                            severity="success"
                            disabled={!checked || confirmLoading}
                            loading={confirmLoading}
                            onClick={onConfirm}
                            className="w-full sm:w-auto"
                        />
                    )}
                </div>
            </div>
        </Dialog>
    );
}
