'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';

interface PlanScriptDialogProps {
    visible: boolean;
    onHide: () => void;
    script: string;
    onScriptChange: (value: string) => void;
    onApply: () => void;
    applyLoading?: boolean;
    error?: string | null;
}

export default function PlanScriptDialog({
    visible,
    onHide,
    script,
    onScriptChange,
    onApply,
    applyLoading = false,
    error = null,
}: PlanScriptDialogProps) {
    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header="计划脚本"
            className="w-[96vw] max-w-5xl"
            breakpoints={{ '960px': '96vw' }}
        >
            <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-xs leading-6 text-surface-600">
                    <div>`W1` 表示周，`D1` 表示天，`off` 表示休息日，`!` 表示日备注，`#` 表示动作备注。</div>
                    <div>`4x7 @9rm r270` 表示 4 组 7 次、9RM、休息 270 秒。</div>
                </div>

                <InputTextarea
                    value={script}
                    onChange={(e) => onScriptChange(e.target.value)}
                    rows={24}
                    autoResize={false}
                    className="w-full font-mono text-xs leading-6"
                    placeholder="在这里编辑计划脚本"
                />

                {error ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        label="关闭"
                        className="rounded-2xl"
                        text
                        onClick={onHide}
                        disabled={applyLoading}
                    />
                    <Button
                        label="应用脚本"
                        icon="pi pi-check"
                        className="rounded-2xl"
                        onClick={onApply}
                        loading={applyLoading}
                    />
                </div>
            </div>
        </Dialog>
    );
}
