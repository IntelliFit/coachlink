'use client';

import React, { useEffect, useState } from 'react';
import { MessageCircle, Star, Calendar, Clock } from 'lucide-react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { userService } from '@/app/service/userService';
import { useToastContext } from '@/context/ToastContext';
import type { CoachStudentCommentRow } from '@/types';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';

interface ReviewsProps {
    coachId: string;
    userSubscription: QueryCoachSubscription | null;
    isOwnProfile: boolean;
}

const CoachReviewsPanel: React.FC<ReviewsProps> = ({ coachId, userSubscription, isOwnProfile }) => {
    const { showToast } = useToastContext();
    const [comments, setComments] = useState<CoachStudentCommentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasuserSubscription, setHasuserSubscription] = useState(false);
    const [subscriptionDuration, setSubscriptionDuration] = useState('');

    useEffect(() => {
        // 检查用户是否有活跃的订阅
        if (userSubscription) {
            setHasuserSubscription(true);

            // 计算订阅时长
            if (userSubscription.created_at) {
                const startDate = new Date(userSubscription.created_at);
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - startDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                setSubscriptionDuration(`${diffDays}天`);
            }
        }

        // 获取评论
        fetchComments();
    }, [coachId, userSubscription]);

    const fetchComments = async () => {
        try {
            setLoading(true);
            const res = await userService.getStudentComments({ coach_id: coachId });

            if (res) {
                setComments(res.comments);
            }
        } catch (error) {
            console.error('获取评论失败:', error);
            showToast({ severity: 'error', summary: '获取评论失败' });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {[1, 2, 3].map((item) => (
                    <div key={item} className="border rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <Skeleton shape="circle" size="3rem" />
                            <div>
                                <Skeleton width="8rem" className="mb-2" />
                                <Skeleton width="6rem" height="0.75rem" />
                            </div>
                        </div>
                        <Skeleton width="100%" height="4rem" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!isOwnProfile && hasuserSubscription && (
                <div className=" rounded-lg p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-medium text-blue-900">您已订阅此教练</h3>
                            <p className="text-sm text-blue-700 flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                订阅时长: {subscriptionDuration}
                            </p>
                        </div>
                        <Button
                            label="发表评价"
                            icon="pi pi-plus"
                            outlined
                            onClick={() => showToast({ severity: 'info', summary: '提示', detail: '发表评价功能即将上线' })}
                        />
                    </div>
                </div>
            )}

            {comments.length === 0 ? (
                <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-surface-400 mx-auto mb-4" />
                    <p className="text-surface-600 text-lg">暂无学员评价</p>
                    {!isOwnProfile && hasuserSubscription && (
                        <p className="text-surface-500 mt-2">成为第一个发表评价的学员吧！</p>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">学员评价 ({comments.length})</h3>
                    </div>

                    {comments.map((comment) => (
                        <Card key={comment.id} className="shadow-sm">
                            <div className="flex gap-4">
                                <Avatar
                                    label={comment.student_id.substring(0, 2).toUpperCase()}
                                    size="large"
                                    shape="circle"
                                    className="flex-shrink-0 bg-primary-100 text-primary-700"
                                />
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="font-medium">学员</span>
                                        <div className="flex text-amber-500">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                                <Star key={star} className="w-4 h-4 fill-current" />
                                            ))}
                                        </div>
                                        <span className="text-sm text-surface-500 flex items-center gap-1 ml-auto">
                                            <Clock className="w-4 h-4" />
                                            {new Date(comment.created_at || '').toLocaleDateString('zh-CN')}
                                        </span>
                                    </div>
                                    <p className="text-surface-700 whitespace-pre-wrap">{comment.comment}</p>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CoachReviewsPanel;