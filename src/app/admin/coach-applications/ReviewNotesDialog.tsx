'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';

interface ReviewNotesDialogProps {
    visible: boolean;
    applicationId: string;
    onSubmit: (notes: string) => void;
    onHide: () => void;
}

const ReviewNotesDialog: React.FC<ReviewNotesDialogProps> = ({ 
    visible, 
    applicationId,
    onSubmit,
    onHide
}) => {
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
            header="请输入审核意见"
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
                    placeholder="请输入拒绝该申请的原因或审核意见..."
                />
            </div>
            <div className="text-sm text-surface-500">
                请输入拒绝该教练申请的具体原因，这将帮助申请人了解如何改进并重新提交申请。
            </div>
        </Dialog>
    );
};

export default ReviewNotesDialog;