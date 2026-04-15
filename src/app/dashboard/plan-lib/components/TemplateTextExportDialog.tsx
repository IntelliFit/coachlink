'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';

interface TemplateTextExportDialogProps {
    visible: boolean;
    onHide: () => void;
    templateName: string;
    text: string;
    loading?: boolean;
    onCopy: () => void;
    onDownload: () => void;
}

export default function TemplateTextExportDialog({
    visible,
    onHide,
    templateName,
    text,
    loading = false,
    onCopy,
    onDownload,
}: TemplateTextExportDialogProps) {
    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header="导出计划文本"
            className="w-[96vw] max-w-4xl"
            breakpoints={{ '960px': '96vw' }}
        >
            <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">
                        Template
                    </div>
                    <div className="mt-1 text-sm font-bold text-surface-900">
                        {templateName || '未命名计划'}
                    </div>
                </div>

                <InputTextarea
                    value={text}
                    readOnly
                    rows={22}
                    autoResize={false}
                    className="w-full font-mono text-xs leading-6"
                    placeholder={loading ? '正在生成导出文本...' : '暂无可导出的文本'}
                />

                <div className="flex flex-wrap justify-end gap-2">
                    <Button
                        label="下载 .txt"
                        icon="pi pi-download"
                        onClick={onDownload}
                        disabled={loading || !text}
                        className="rounded-2xl"
                        text
                    />
                    <Button
                        label="复制文本"
                        icon="pi pi-copy"
                        onClick={onCopy}
                        disabled={loading || !text}
                        className="rounded-2xl"
                    />
                </div>
            </div>
        </Dialog>
    );
}
