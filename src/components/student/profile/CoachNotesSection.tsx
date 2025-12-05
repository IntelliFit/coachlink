import React, { useEffect, useState } from 'react';
import { MessageSquare, Quote } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { Chip } from 'primereact/chip';
import { ProfileData } from './types';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { CoachReviewRow, CoachesRow } from '@/types';

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
            <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                    <MessageSquare className="text-primary" size={20} />
                    教链评语
                </h2>
                <div className="text-center py-4">
                    加载中...
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
        date: review.created_at ? new Date(review.created_at).toLocaleString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }) : '',
        content: review.review_text || '',
        tags: [] // 标签信息需要从其他地方获取或生成
    }));

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                <MessageSquare className="text-primary" size={20} />
                教链评语
            </h2>

            <div className="grid grid-cols-1 gap-6">
                {formattedReviews.map((note) => (
                    <div key={note.id} className="relative bg-surface-50 rounded-xl p-6 border border-surface-300">
                        <Quote className="absolute top-4 right-4 text-surface-300" size={40} />
                        
                        <div className="flex items-center gap-3 mb-4">
                            <Avatar 
                                image={note.coachAvatar || undefined} 
                                label={!note.coachAvatar ? note.coachName.charAt(0) : undefined}
                                shape="circle" 
                                className="bg-surface-200 text-primary font-bold"
                            />
                            <div>
                                <div className="font-bold text-surface-900">{note.coachName}</div>
                                <div className="text-xs text-surface-500">{note.date}</div>
                            </div>
                        </div>

                        <p className="text-surface-700 leading-relaxed mb-4 relative z-10">
                            {note.content}
                        </p>

                        {note.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {note.tags.map((tag, index) => (
                                    <Chip key={index} label={tag} className="text-xs bg-surface border border-blue-300 text-blue-300" />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};