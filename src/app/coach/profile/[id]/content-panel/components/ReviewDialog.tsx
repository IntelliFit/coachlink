'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { Rating } from 'primereact/rating';
import { InputTextarea } from 'primereact/inputtextarea';
import { useToastContext } from '@/context/ToastContext';
import { userService } from '@/app/service/userService';

interface ReviewDialogProps {
    visible: boolean;
    onHide: () => void;
    coachId: string;
    onReviewSubmitted: () => void;
}

const ReviewDialog: React.FC<ReviewDialogProps> = ({
    visible,
    onHide,
    coachId,
    onReviewSubmitted
}) => {
    const { showToast } = useToastContext();
    const [rating, setRating] = useState<number | null>(null);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (rating === null) {
            showToast({ severity: 'warn', summary: '请选择评分' });
            return;
        }

        if (!comment.trim()) {
            showToast({ severity: 'warn', summary: '请输入评价内容' });
            return;
        }

        try {
            setSubmitting(true);
            await userService.createStudentComment({
                coach_id: coachId,
                comment: comment,
                rating: rating
            });

            showToast({ severity: 'success', summary: '评价发表成功' });
            resetForm();
            onReviewSubmitted();
            onHide();
        } catch (error: any) {
            console.error('发表评价失败:', error);
            showToast({ severity: 'error', summary: '发表评价失败', detail: error.message || '未知错误' });
        } finally {
            setSubmitting(false);
        }
    };

    const resetForm = () => {
        setRating(null);
        setComment('');
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
                label="提交评价"
                icon="pi pi-check"
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting}
            />
        </div>
    );

    return (
        <Dialog
            header="发表评价"
            visible={visible}
            onHide={() => {
                onHide();
                resetForm();
            }}
            footer={footerContent}
            className="w-full max-w-md md:max-w-2xl"
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">评分 *</label>
                    <div className="flex items-center gap-2">
                        <Rating
                            value={rating}
                            onChange={(e) => setRating(e.value as number)}
                            cancel={false}
                            stars={5}
                        />
                        <span className="text-sm text-surface-500">
                            {rating ? `${rating}星` : '未选择'}
                        </span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">评价内容 *</label>
                    <InputTextarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={5}
                        className="w-full"
                        placeholder="请分享您的体验和建议..."
                    />
                </div>
            </div>
        </Dialog>
    );
};

export default ReviewDialog;