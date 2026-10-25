'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Skeleton } from 'primereact/skeleton';
import { publicActionLibService } from '@/app/service/publicActionLibService';
import type { PublicActionItemDto } from '@/app/api/public-action-lib/list-actions/entity';
import FormattedActionText from '@/components/shared/FormattedActionText';
import { useToastContext } from '@/context/ToastContext';
import SectionHeader from './SectionHeader';

// 动态导入，避免首次加载时拉入动作库的重型组件
const PublicActionDetailDialog = dynamic(
    () => import('@/components/action-lib/PublicActionDetailDialog'),
    { ssr: false },
);

const MAX_ACTIONS = 6;

function isVideoUrl(url: string | null | undefined) {
    if (!url) return false;
    const u = url.toLowerCase();
    return ['.mp4', '.webm', '.mov', '.m4v'].some((ext) => u.endsWith(ext)) || u.includes('/videos/');
}

export default function HotActionsSection() {
    const router = useRouter();
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const [actions, setActions] = useState<PublicActionItemDto[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<PublicActionItemDto | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            try {
                const res = await publicActionLibService.listActions({ page: 1, limit: MAX_ACTIONS });
                if (!cancelled) setActions(res?.actions || []);
            } catch (e) {
                console.error('Failed to load hot actions', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        load();
        return () => { cancelled = true; };
    }, []);

    const addToLibrary = async (action: PublicActionItemDto) => {
        if (!session?.user?.id) {
            router.push(`/login?redirect=${encodeURIComponent('/coach/discovery')}`);
            return;
        }
        try {
            await publicActionLibService.addToMyLib({ actionId: action.id });
            showToast({ severity: 'success', summary: '已加入动作库' });
            setActions((prev) => prev.map((x) => (x.id === action.id ? { ...x, isAdded: true } : x)));
        } catch (e) {
            console.error('Failed to add action', e);
            showToast({ severity: 'error', summary: '添加失败，请稍后再试' });
        }
    };

    if (!loading && actions.length === 0) return null;

    return (
        <section className="flex flex-col gap-5">
            <SectionHeader title="热门动作" moreHref="/me/action-lib?tab=public" moreText="动作库" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                {loading
                    ? [1, 2, 3].map((i) => <Skeleton key={i} height="132px" className="rounded-2xl" />)
                    : actions.map((action) => (
                        <div key={action.id} className="flex flex-col gap-2 rounded-2xl border border-surface-200 bg-surface-0 p-5">
                            <button
                                type="button"
                                onClick={() => setSelected(action)}
                                className="flex flex-col gap-2 text-left"
                            >
                                <span className="flex items-start justify-between gap-2">
                                    <span className="line-clamp-2 text-base font-bold text-surface-900">{action.name}</span>
                                    {isVideoUrl(action.url) && (
                                        <span className="shrink-0 rounded-md bg-primary-50 px-2 py-0.5 text-[11px] font-bold text-primary-700">视频</span>
                                    )}
                                </span>
                                <FormattedActionText
                                    text={action.detail}
                                    className="min-h-[2.5em] text-[13px] text-surface-600"
                                    lineClampClassName="line-clamp-2"
                                />
                            </button>
                            <span className="mt-auto flex items-center justify-between">
                                <span className="text-[13px] text-surface-500">{action.like_count || 0} 赞</span>
                                <button
                                    type="button"
                                    disabled={action.isAdded}
                                    onClick={() => addToLibrary(action)}
                                    className={`h-9 rounded-xl px-4 text-sm font-bold ${
                                        action.isAdded
                                            ? 'cursor-not-allowed bg-surface-100 text-surface-500'
                                            : 'border border-surface-300 text-surface-900 hover:bg-surface-50'
                                    }`}
                                >
                                    {action.isAdded ? '已添加' : '添加'}
                                </button>
                            </span>
                        </div>
                    ))}
            </div>
            <PublicActionDetailDialog
                visible={!!selected}
                action={selected}
                onHide={() => setSelected(null)}
                viewerActionType="student"
            />
        </section>
    );
}
