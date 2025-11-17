'use client';

import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';
import CoachContentItem from './CoachContentItem';
import CoachContentSkeleton from './CoachContentSkeleton';

// 临时定义ServiceCoachContent类型，直到找到真正的定义
type ServiceCoachContent = {
    id: string;
    title: string;
    content: string;
    required_tier: number;
    is_featured: boolean;
    views_count: number;
    likes_count: number;
    comments_count: number;
    created_at: string;
    tags: string[];
    media_urls: string[];
    thumbnail_url: string | null;
    content_type: string;
};

interface CoachContentProps {
    coachId: string;
    userSubscription: any;
    isLoading: boolean;
    contentError: string | null;
    coachContent: ServiceCoachContent[];
    onSubscribeSuccess: () => void;
}

const CoachContent: React.FC<CoachContentProps> = ({
    coachId,
    userSubscription,
    isLoading,
    contentError,
    coachContent,
    onSubscribeSuccess
}) => {
    if (isLoading) {
        return <CoachContentSkeleton />;
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

    if (coachContent.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-surface-500">该教练还没有发布任何内容</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {coachContent.map((content) => (
                <CoachContentItem
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

export default CoachContent;