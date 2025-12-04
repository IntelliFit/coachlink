import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { useRef, useState, useEffect } from 'react';
import { CoachesRow, CoachReviewRow, CoachSubscriptionRow } from '@/types';
import { subscriptionService } from '@/app/service/subscriptionService';
import { StudentSubscription } from '@/app/api/coach/get-students/entity';

interface CoachReviewDialogProps {
    visible: boolean;
    coach: CoachesRow;
    student: StudentSubscription;
    onHide: () => void;
    onSave: () => void;
}

export const CoachReviewDialog = ({
    visible,
    coach,
    student,
    onHide,
    onSave
}: CoachReviewDialogProps) => {
    const toast = useRef<Toast>(null);
    const [reviewText, setReviewText] = useState('');
    const [reviews, setReviews] = useState<CoachReviewRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
    const [editReviewText, setEditReviewText] = useState('');

    // 加载已有评价
    useEffect(() => {
        if (visible && student?.id) {
            loadReviews();
        }
    }, [visible, student?.id]);

    const loadReviews = async () => {
        setLoading(true);
        try {
            const data = await subscriptionService.getCoachReviews({ studentId: student?.student_id || '' });
            if (data) {
                setReviews(data.reviews);
            }
        } catch (error) {
            showToast('error', '加载评价失败', '无法获取教练评价列表');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (severity: 'success' | 'info' | 'warn' | 'error', summary: string, detail: string) => {
        toast.current?.show({
            severity,
            summary,
            detail,
            life: 3000
        });
    };

    const handleSave = async () => {
        if (!reviewText.trim()) {
            showToast('warn', '输入验证失败', '请输入评价内容');
            return;
        }

        setSaving(true);
        try {            
            await subscriptionService.createCoachReview({
                subscriptionId: student.id,
                studentId: student.student_id,
                coachId: coach.id,
                reviewText,
                mediaUrls: []
            });

            showToast('success', '保存成功', '教练评价已创建');
            setReviewText('');
            loadReviews(); // 重新加载评价列表
            onSave(); // 通知父组件刷新
        } catch (error) {
            showToast('error', '保存失败', '无法创建教练评价');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (reviewId: string) => {
        try {
            await subscriptionService.deleteCoachReview({ reviewId });
            showToast('success', '删除成功', '教练评价已删除');
            loadReviews(); // 重新加载评价列表
            onSave(); // 通知父组件刷新
        } catch (error) {
            showToast('error', '删除失败', '无法删除教练评价');
        }
    };

    const startEditing = (review: CoachReviewRow) => {
        setEditingReviewId(review.id);
        setEditReviewText(review.review_text || '');
    };

    const cancelEditing = () => {
        setEditingReviewId(null);
        setEditReviewText('');
    };

    const saveEditedReview = async () => {
        if (!editingReviewId) return;

        if (!editReviewText.trim()) {
            showToast('warn', '输入验证失败', '请输入评价内容');
            return;
        }

        try {
            await subscriptionService.updateCoachReview({
                reviewId: editingReviewId,
                reviewText: editReviewText,
                mediaUrls: [] // 默认传递空数组
            });

            showToast('success', '更新成功', '教练评价已更新');
            setEditingReviewId(null);
            setEditReviewText('');
            loadReviews(); // 重新加载评价列表
            onSave(); // 通知父组件刷新
        } catch (error) {
            showToast('error', '更新失败', '无法更新教练评价');
        }
    };

    return (
        <>
            <Toast ref={toast} />
            <Dialog
                header="教练评价"
                visible={visible}
                style={{ width: '750px', maxWidth: '90vw' }}
                modal
                draggable={false}
                onHide={onHide}
            >
                <div className="p-4">
                    <div className="mb-4">
                        <label htmlFor="reviewText" className="block text-sm font-medium mb-2">
                            评价内容
                        </label>
                        <InputTextarea
                            id="reviewText"
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            rows={4}
                            className="w-full"
                            placeholder="请输入对学员的评价..."
                        />
                        <div className="mt-2">
                            <Button 
                                label="添加评价" 
                                icon="pi pi-plus" 
                                onClick={handleSave} 
                                loading={saving}
                                disabled={!reviewText.trim()}
                            />
                        </div>
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <h3 className="text-lg font-medium mb-3">历史评价</h3>
                        {loading ? (
                            <div className="text-center py-4">
                                <i className="pi pi-spin pi-spinner"></i> 加载中...
                            </div>
                        ) : reviews.length === 0 ? (
                            <p className="text-center text-surface-500 py-4">
                                暂无评价记录
                            </p>
                        ) : (
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                {reviews.map((review) => (
                                    <div 
                                        key={review.id} 
                                        className="border rounded-lg p-3 bg-surface-50"
                                    >
                                        <div className="flex justify-between">
                                            <div className="text-sm text-surface-500">
                                                {new Date(review.created_at || '').toLocaleString()}
                                            </div>
                                            <div className="flex gap-1">
                                                {editingReviewId === review.id ? (
                                                    <Button 
                                                        icon="pi pi-times" 
                                                        className="p-button-rounded p-button-text p-button-sm"
                                                        onClick={cancelEditing}
                                                    />
                                                ) : (
                                                    <>
                                                        <Button 
                                                            icon="pi pi-pencil" 
                                                            className="p-button-rounded p-button-text p-button-sm"
                                                            onClick={() => startEditing(review)}
                                                        />
                                                        <Button 
                                                            icon="pi pi-trash" 
                                                            className="p-button-rounded p-button-danger p-button-text p-button-sm"
                                                            onClick={() => handleDelete(review.id)}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {editingReviewId === review.id ? (
                                            <div className="my-2">
                                                <InputTextarea
                                                    value={editReviewText}
                                                    onChange={(e) => setEditReviewText(e.target.value)}
                                                    rows={3}
                                                    className="w-full mb-2"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button 
                                                        label="取消" 
                                                        className="p-button-text"
                                                        onClick={cancelEditing}
                                                    />
                                                    <Button 
                                                        label="保存" 
                                                        onClick={saveEditedReview}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                {review.review_text && (
                                                    <p className="my-2">{review.review_text}</p>
                                                )}
                                                {/* 查看模式下不再显示编辑按钮，编辑按钮已移至右上角操作区 */}
                                            </div>
                                        )}
                                        
                                        {review.media_urls && review.media_urls.length > 0 && (
                                            <div className="mt-2">
                                                <span className="text-sm font-medium">媒体:</span>
                                                <ul className="list-disc pl-5 mt-1">
                                                    {review.media_urls.map((url, idx) => (
                                                        <li key={idx}>
                                                            <a 
                                                                href={url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="text-primary hover:underline"
                                                            >
                                                                媒体链接 {idx + 1}
                                                            </a>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Dialog>
        </>
    );
};