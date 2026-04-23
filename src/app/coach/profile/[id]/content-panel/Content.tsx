'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
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
            <div className="flex flex-col gap-3 rounded-3xl border border-surface-100 bg-surface px-5 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="text-xs font-black uppercase tracking-[0.24em] text-surface-400">
                        Coach Column
                    </div>
                    <h2 className="mt-2 text-xl font-black tracking-tight text-surface-900">
                        文章不只是列表，也可以沉淀成专栏
                    </h2>
                    <p className="mt-2 text-sm text-surface-500">
                        如果你想连续看这位教练写的图文内容，可以直接进入专栏页集中浏览。
                    </p>
                </div>
                <Link
                    href={`/articles/coach/${coachId}`}
                    className="inline-flex items-center gap-2 self-start rounded-2xl border border-surface-200 bg-surface px-4 py-3 text-sm font-bold text-surface-700 hover:border-primary-200 hover:text-primary-600 transition-colors"
                >
                    进入专栏
                    <ArrowRight className="w-4 h-4" />
                </Link>
            </div>
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
