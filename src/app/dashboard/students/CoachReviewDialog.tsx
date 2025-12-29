'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { Skeleton } from 'primereact/skeleton';
import { 
    MessageSquare, 
    History, 
    Send, 
    Trash2, 
    Pencil, 
    X, 
    Check, 
    Clock,
    User
} from 'lucide-react';
import { CoachesRow, CoachReviewRow } from '@/types';
import { subscriptionService } from '@/app/service/subscriptionService';
import { StudentSubscription } from '@/app/api/coach/list-students/entity';

interface CoachReviewDialogProps {
    visible: boolean;
    coach: CoachesRow;
    student: StudentSubscription | null;
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

    useEffect(() => {
        if (visible && student?.id) {
            loadReviews();
        }
    }, [visible, student?.id]);

    const loadReviews = async () => {
        setLoading(true);
        try {
            const data = await subscriptionService.getCoachReviews({ studentId: student?.student_id || '' });
            if (data) setReviews(data.reviews);
        } catch (error) {
            showToast('error', '加载失败', '无法获取评价列表');
        } finally {
            setLoading(false);
        }
    };

    const showToast = (severity: any, summary: string, detail: string) => {
        toast.current?.show({ severity, summary, detail, life: 3000 });
    };

    const handleSave = async () => {
        if (!reviewText.trim()) return;
        setSaving(true);
        try {
            await subscriptionService.createCoachReview({
                subscriptionId: student!.id,
                studentId: student!.student_id,
                coachId: coach.id,
                reviewText,
                mediaUrls: []
            });
            showToast('success', '发布成功', '已添加新的教练评价');
            setReviewText('');
            loadReviews();
            onSave();
        } catch (error) {
            showToast('error', '发布失败', '请稍后重试');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (reviewId: string) => {
        try {
            await subscriptionService.deleteCoachReview({ reviewId });
            showToast('success', '已删除', '评价记录已移除');
            loadReviews();
            onSave();
        } catch (error) {
            showToast('error', '删除失败', '操作无法完成');
        }
    };

    const saveEditedReview = async () => {
        if (!editingReviewId || !editReviewText.trim()) return;
        try {
            await subscriptionService.updateCoachReview({
                reviewId: editingReviewId,
                reviewText: editReviewText,
                mediaUrls: []
            });
            showToast('success', '更新成功', '评价内容已修改');
            setEditingReviewId(null);
            loadReviews();
            onSave();
        } catch (error) {
            showToast('error', '更新失败', '无法保存修改');
        }
    };

    // 渲染历史记录项
    const renderReviewItem = (review: CoachReviewRow) => {
        const isEditing = editingReviewId === review.id;
        
        return (
            <div key={review.id} className={`group relative p-5 rounded-[24px] border transition-all duration-300 ${
                isEditing ? 'border-primary bg-primary-50/10 ring-4 ring-primary-50' : 'border-surface-100 bg-surface hover:border-surface-200 hover:shadow-sm'
            }`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2 text-surface-400">
                        <Clock size={14} />
                        <span className="text-[10px] font-bold uppercase tracking-widest">
                            {new Date(review.created_at || '').toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                    
                    {!isEditing && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                                icon={<Pencil size={14} />} 
                                className="p-button-text p-button-rounded text-surface-400 hover:text-primary w-8 h-8"
                                onClick={() => { setEditingReviewId(review.id); setEditReviewText(review.review_text || ''); }}
                            />
                            <Button 
                                icon={<Trash2 size={14} />} 
                                className="p-button-text p-button-rounded text-surface-400 hover:text-red-500 w-8 h-8"
                                onClick={() => handleDelete(review.id)}
                            />
                        </div>
                    )}
                </div>

                {isEditing ? (
                    <div className="space-y-3">
                        <InputTextarea
                            value={editReviewText}
                            onChange={(e) => setEditReviewText(e.target.value)}
                            rows={3}
                            className="w-full border-none bg-surface focus:ring-0 p-0 text-sm leading-relaxed"
                        />
                        <div className="flex justify-end gap-2">
                            <Button label="取消" className="p-button-text text-xs font-bold uppercase text-surface-400 hover:text-surface-600" onClick={() => setEditingReviewId(null)} />
                            <Button label="保存修改" className="p-button-primary rounded-xl px-4 py-2 text-xs font-bold shadow-sm" onClick={saveEditedReview} />
                        </div>
                    </div>
                ) : (
                    <p className="text-sm text-surface-700 leading-relaxed font-medium">
                        {review.review_text}
                    </p>
                )}
            </div>
        );
    };

    return (
        <>
            <Toast ref={toast} />
            <Dialog
                visible={visible}
                onHide={onHide}
                style={{ width: '640px' }}
                modal
                draggable={false}
                resizable={false}
                showHeader={false}
                contentClassName="rounded-lg overflow-hidden"
            >
                {/* 顶部标题栏 */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-surface-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-50 rounded-2xl flex items-center justify-center text-primary">
                            <MessageSquare size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight text-surface-900">教练评价反馈</h2>
                            <p className="text-xs text-surface-400 font-bold uppercase tracking-tighter">学员: {student?.profile?.nickname}</p>
                        </div>
                    </div>
                    <Button 
                        icon={<X size={20} />} 
                        className="p-button-text p-button-rounded text-surface-400 hover:bg-surface-50 w-10 h-10" 
                        onClick={onHide} 
                    />
                </div>

                <div className="bg-surface-50/30 p-8 space-y-8 max-h-[75vh] overflow-y-auto">
                    {/* 输入区域 */}
                    <div className="bg-surface rounded-[28px] p-6 shadow-sm border border-surface-100 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
                            <Send size={14} /> 新增评价记录
                        </div>
                        <InputTextarea
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                            rows={4}
                            className="w-full border-none bg-surface-50/50 focus:bg-surface focus:ring-2 focus:ring-primary-100 rounded-2xl p-4 text-sm transition-all"
                            placeholder="输入对学员本周训练的点评、建议或鼓励..."
                        />
                        <div className="flex justify-end">
                            <Button 
                                label="发布评价" 
                                icon={<PlusIcon />} 
                                onClick={handleSave} 
                                loading={saving}
                                disabled={!reviewText.trim()}
                                className="p-button-primary rounded-2xl px-6 py-3 font-black text-sm tracking-wide shadow-lg active:scale-95 transition-all"
                            />
                        </div>
                    </div>

                    {/* 历史记录区域 */}
                    <div className="space-y-4 px-1">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-surface-400">
                                <History size={14} /> 评价历史汇总
                            </div>
                            <span className="text-[10px] font-black text-primary bg-primary-50 px-2 py-0.5 rounded-full">
                                {reviews.length} 条记录
                            </span>
                        </div>

                        <div className="space-y-3">
                            {loading ? (
                                [1, 2].map(i => <Skeleton key={i} height="100px" className="rounded-[24px]" />)
                            ) : reviews.length === 0 ? (
                                <div className="text-center py-12 bg-surface rounded-[24px] border border-dashed border-surface-200">
                                    <p className="text-sm text-surface-400 font-medium tracking-tight">暂无历史评价，开启您的第一次反馈吧</p>
                                </div>
                            ) : (
                                reviews.map(renderReviewItem)
                            )}
                        </div>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

const PlusIcon = () => <span className="mr-2"><Send size={16} /></span>;