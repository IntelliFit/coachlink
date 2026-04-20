import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ProfileData } from './types';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { CoachReviewRow, CoachesRow } from '@/types';
import { formatBeijingDate } from '@/lib/beijingTime';

interface CoachNotesSectionProps {
    data: ProfileData;
    userId: string;
}

export const CoachNotesSection: React.FC<CoachNotesSectionProps> = ({ data, userId }) => {
    const [reviews, setReviews] = useState<CoachReviewRow[]>([]);
    const [loading, setLoading] = useState(true);

    const loadReviews = async () => {
        try {
            setLoading(true);
            const res = await subscriptionService.getCoachReviews({ studentId: userId });
            if (res) {
                // 获取每个评价对应的教练信息
                const reviewsWithCoachInfo = await Promise.all(
                    res.reviews.map(async (review) => {
                        let coach: CoachesRow | null = null;
                        if (review.coach_id) {
                            const coachRes = await coachService.getCoach({ id: review.coach_id });
                            if (coachRes) {
                                coach = coachRes.coach;
                            }
                        }
                        return {
                            ...review,
                            coach
                        };
                    })
                );
                
                // 只设置包含教练信息的评价
                setReviews(reviewsWithCoachInfo);
            }
        } catch (error) {
            console.error('获取教练评价失败:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReviews();
    }, [userId]);

    if (loading) {
        return (
            <div className="bg-surface rounded-2xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
                <h2 className="text-base font-black text-surface-900 flex items-center gap-2 mb-3">
                    <MessageSquare className="text-primary" size={20} />
                    教链评语
                </h2>
                <div className="flex justify-center py-6">
                    <ProgressSpinner style={{ width: '36px', height: '36px' }} className="text-primary" strokeWidth="4" />
                </div>
            </div>
        );
    }

    if (!reviews || reviews.length === 0) {
        return null;
    }

    // 将教练评价数据转换为展示所需的格式
    const formattedReviews = reviews.map(review => ({
        id: review.id,
        coachName: review.coach?.name || '教练',
        coachAvatar: review.coach?.avatar_url || '',
        date: review.created_at ? formatBeijingDate(review.created_at, 'zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : '',
        content: review.review_text || '',
        tags: [] // 标签信息需要从其他地方获取或生成
    }));

    const latest = formattedReviews[0];
    const rest = formattedReviews.slice(1);

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-black text-surface-900 flex items-center gap-2">
                    <MessageSquare className="text-primary" size={18} />
                    教链评语
                </h2>
                <div className="text-[11px] font-bold text-surface-500">
                    {formattedReviews.length} 条
                </div>
            </div>

            <div className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                <div className="flex items-center gap-2">
                    <Avatar
                        image={latest.coachAvatar || undefined}
                        label={!latest.coachAvatar ? latest.coachName.charAt(0) : undefined}
                        shape="circle"
                        className="bg-surface-200 text-primary font-bold w-8 h-8"
                    />
                    <div className="min-w-0">
                        <div className="text-sm font-black text-surface-900 leading-tight truncate">{latest.coachName}</div>
                        <div className="text-[11px] text-surface-500 leading-tight truncate">{latest.date}</div>
                    </div>
                </div>

                <p className="mt-2 text-sm text-surface-700 leading-snug line-clamp-2">
                    {latest.content}
                </p>
            </div>

            {rest.length > 0 && (
                <details className="mt-2">
                    <summary className="cursor-pointer select-none text-xs font-bold text-primary-600 hover:text-primary-700">
                        查看全部评语
                    </summary>
                    <div className="mt-2 space-y-2">
                        {rest.map((note) => (
                            <div key={note.id} className="bg-surface-50 rounded-xl p-3 border border-surface-200">
                                <div className="flex items-center gap-2">
                                    <Avatar
                                        image={note.coachAvatar || undefined}
                                        label={!note.coachAvatar ? note.coachName.charAt(0) : undefined}
                                        shape="circle"
                                        className="bg-surface-200 text-primary font-bold w-7 h-7"
                                    />
                                    <div className="min-w-0">
                                        <div className="text-sm font-black text-surface-900 leading-tight truncate">{note.coachName}</div>
                                        <div className="text-[11px] text-surface-500 leading-tight truncate">{note.date}</div>
                                    </div>
                                </div>
                                <p className="mt-2 text-sm text-surface-700 leading-snug line-clamp-2">
                                    {note.content}
                                </p>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    );
};
