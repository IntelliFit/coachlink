'use client';

import React, { useEffect, useState } from 'react';
import ContentItem from './ContentItem';
import ContentSkeleton from './ContentSkeleton';
import { coachService } from '@/app/service/coachService';
import { CoachContentRow } from '@/types';
import { Paginator, PaginatorPageChangeEvent } from 'primereact/paginator';

interface CoachContentPanelProps {
    coachId: string;
    userSubscription: any;
    onSubscribeSuccess: (tier: number) => void;
}

const CoachContentPanel: React.FC<CoachContentPanelProps> = ({
    coachId,
    userSubscription,
    onSubscribeSuccess
}) => {
    const [loading, setLoading] = useState<boolean>(true);
    const [contentError, setContentError] = useState<string | null>(null);
    const [coachContent, setCoachContent] = useState<CoachContentRow[]>([]);
    const [first, setFirst] = useState<number>(0);
    const [rows, setRows] = useState<number>(10);
    const [totalRecords, setTotalRecords] = useState<number>(0);

    const load = async (page: number = 0, limit: number = 10) => {
        if (!coachId) return;

        setLoading(true);
        setContentError(null);

        try {
            const res = await coachService.getContents({
                coachId,
                limit: limit,
                offset: page * limit,
            });

            if (res && res.contents) {
                setCoachContent(res.contents);
                setTotalRecords(res.total || res.contents.length);
            } else {
                setCoachContent([]);
                setTotalRecords(0);
            }
        } catch (error: any) {
            console.error('获取教练内容失败:', error);
            setContentError(error?.message || '获取内容失败，请稍后重试');
            setCoachContent([]);
            setTotalRecords(0);
        } finally {
            setLoading(false);
        }
    };

    const onPageChange = (event: PaginatorPageChangeEvent) => {
        setFirst(event.first);
        setRows(event.rows);
        load(event.page, event.rows);
    };

    useEffect(() => {
        load(0, rows);

    }, [coachId, rows]);

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
            <Paginator
                first={first}
                rows={rows}
                totalRecords={totalRecords}
                onPageChange={onPageChange}
                className="mt-6"
            />
        </div>
    );
};

export default CoachContentPanel;