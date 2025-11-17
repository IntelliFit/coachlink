'use client';

import React, { useEffect, useState } from 'react';
import ContentItem from './ContentItem';
import ContentSkeleton from './ContentSkeleton';
import { coachService } from '@/app/service/coachService';
import { CoachContentRow } from '@/types';


interface CoachContentPanelProps {
    isLoading: boolean;
    coachId: string;
    userSubscription: any;
    onSubscribeSuccess: () => void;
}

const CoachContentPanel: React.FC<CoachContentPanelProps> = ({
    coachId,
    userSubscription,
    onSubscribeSuccess
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [contentError, setContentError] = useState<string | null>(null);
    const [coachContent, setCoachContent] = useState<CoachContentRow[]>([]);

    const load = async () => {
        if (!coachId) return;

        setLoading(true);
        setContentError(null);

        try {
            const res = await coachService.getContents({
                coachId,
                limit: 50,
                offset: 0,
            });

            if (res && res.contents) {
                setCoachContent(res.contents);
            } else {
                setCoachContent([]);
            }
        } catch (error: any) {
            console.error('获取教练内容失败:', error);
            setContentError(error?.message || '获取内容失败，请稍后重试');
            setCoachContent([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [coachId]);

    if (loading) {
        return <ContentSkeleton />;
    }

    if (contentError) {
        return (
            <div className="text-center py-12">
                <p className="text-red-500 mb-4">{contentError}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="text-primary-600 hover:text-primary-700 font-medium"
                >
                    重新加载
                </button>
            </div>
        );
    }

    if (!coachContent || coachContent.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-surface-500">该教练还没有发布任何内容</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {coachContent.map((content) => (
                <ContentItem
                    key={content.id}
                    content={content}
                    coachId={coachId}
                    userSubscription={userSubscription}
                    onSubscribeSuccess={onSubscribeSuccess}
                />
            ))}
        </div>
    );
};

export default CoachContentPanel;