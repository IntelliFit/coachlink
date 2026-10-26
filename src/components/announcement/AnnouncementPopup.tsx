'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import type { UserAnnouncement } from '@/lib/announcements';
import AnnouncementCard from './AnnouncementCard';

/** 打开即弹的公告弹窗；多条时可左右切换，「知道了」逐条看完后关闭。 */
export default function AnnouncementPopup({ items, onClose }: { items: UserAnnouncement[]; onClose: () => void }) {
    const router = useRouter();
    const [index, setIndex] = useState(0);
    const current = items[Math.min(index, items.length - 1)];
    const isLast = index >= items.length - 1;

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowRight') setIndex((i) => Math.min(items.length - 1, i + 1));
            if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [items.length, onClose]);

    if (!current) return null;

    const openDetail = () => {
        onClose();
        router.push(`/announcements/${current.id}`);
    };
    const next = () => (isLast ? onClose() : setIndex(index + 1));

    return (
        <div
            className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="平台通知"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    aria-label="关闭"
                    onClick={onClose}
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white transition-opacity hover:opacity-80"
                >
                    <X className="h-5 w-5" />
                </button>
                {items.length > 1 && (
                    <div className="absolute left-3 top-3 z-10 rounded-full bg-black/40 px-2.5 py-1 text-xs font-bold text-white">
                        {index + 1} / {items.length}
                    </div>
                )}

                <button type="button" className="block w-full text-left" onClick={openDetail}>
                    <AnnouncementCard data={current} />
                </button>

                <div className="flex gap-3 px-6 pb-5 pt-3">
                    <button
                        type="button"
                        onClick={openDetail}
                        className="flex-1 rounded-2xl bg-primary-500 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-80"
                    >
                        查看详情
                    </button>
                    <button
                        type="button"
                        onClick={next}
                        className="flex-1 rounded-2xl border border-surface-200 bg-surface py-3 text-sm font-bold text-surface-700 transition-colors hover:bg-surface-50"
                    >
                        {isLast ? '知道了' : '下一条'}
                    </button>
                </div>

                {items.length > 1 && (
                    <div className="flex justify-center gap-1.5 pb-4">
                        {items.map((item, i) => (
                            <button
                                key={item.id}
                                type="button"
                                aria-label={`第 ${i + 1} 条`}
                                onClick={() => setIndex(i)}
                                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-primary-500' : 'w-1.5 bg-surface-300'}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
