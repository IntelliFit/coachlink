'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';

export type ReviewNotesMode = 'reject' | 'needs_info';

const MODE_COPY: Record<ReviewNotesMode, { header: string; placeholder: string; hint: string }> = {
    reject: {
        header: '请输入驳回原因',
        placeholder: '请输入拒绝该申请的原因或审核意见...',
        hint: '请输入拒绝该教练申请的具体原因，这将帮助申请人了解如何改进并重新提交申请。',
    },
    needs_info: {
        header: '请说明需要补充的材料',
        placeholder: '例如：请补充个人简介、训练经历和 1-2 份学员案例或资质证明',
        hint: '申请人会收到系统私信，可在「我的 → 申请成为教练」补充后重新提交。',
    },
};

interface ReviewNotesDialogProps {
    visible: boolean;
    applicationId: string;
    mode?: ReviewNotesMode;
    onSubmit: (notes: string) => void;
    onHide: () => void;
}

const ReviewNotesDialog: React.FC<ReviewNotesDialogProps> = ({
    visible,
    applicationId,
    mode = 'reject',
    onSubmit,
    onHide
}) => {
    const copy = MODE_COPY[mode];
    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!notes.trim()) {
            return;
        }

        setSubmitting(true);
        try {
            await onSubmit(notes);
            setNotes('');
            onHide();
        } catch (error) {
            console.error('提交审核意见失败:', error);
        } finally {
            setSubmitting(false);
        }
    };

    const footerContent = (
        <div className="flex justify-end gap-2">
            <Button 
                label="取消" 
                icon="pi pi-times" 
                onClick={onHide} 
                className="p-button-text"
                disabled={submitting}
            />
            <Button 
                label={submitting ? "提交中..." : "提交"} 
                icon={submitting ? "pi pi-spin pi-spinner" : "pi pi-check"}
                onClick={handleSubmit}
                disabled={!notes.trim() || submitting}
                autoFocus
            />
        </div>
    );

    return (
        <Dialog
            header={copy.header}
            visible={visible}
            onHide={onHide}
            style={{ width: '50vw' }}
            breakpoints={{ '960px': '75vw', '640px': '90vw' }}
            footer={footerContent}
        >
            <div className="mb-4">
                <label htmlFor="reviewNotes" className="block text-sm font-medium text-surface-700 mb-2">
                    审核意见
                </label>
                <InputTextarea
                    id="reviewNotes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    className="w-full"
                    placeholder={copy.placeholder}
                />
            </div>
            <div className="text-sm text-surface-500">
                {copy.hint}
            </div>
        </Dialog>
    );
};

export default ReviewNotesDialog;