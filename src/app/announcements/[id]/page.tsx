'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Megaphone } from 'lucide-react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useAnnouncements } from '@/components/announcement/AnnouncementContext';
import { formatBeijingDate } from '@/lib/beijingTime';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
};

export default function AnnouncementDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { status } = useSession();
    const { items, loaded, markRead } = useAnnouncements();
    const item = items.find((entry) => entry.id === params?.id);

    useEffect(() => {
        if (item && !item.isRead) markRead(item.id);
    }, [item, markRead]);

    if (status === 'loading' || (status === 'authenticated' && !loaded)) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-4 pb-16 pt-4">
            <Link href="/announcements" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-surface-500 hover:text-primary-500">
                <ArrowLeft className="h-4 w-4" />
                全部通知
            </Link>

            {!item ? (
                <div className="rounded-2xl border border-surface-200 bg-surface p-8 text-center text-sm text-surface-500">
                    {status === 'authenticated' ? '这条通知不存在或已下线' : '登录后查看平台通知'}
                </div>
            ) : (
                <article className="overflow-hidden rounded-3xl border border-surface-200 bg-surface">
                    {item.coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.coverImageUrl} alt="" className="block w-full bg-surface-100 object-cover" />
                    )}
                    <div className="p-6">
                        <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-bold text-primary-600">
                            <Megaphone className="h-3.5 w-3.5" />
                            平台通知
                        </div>
                        <h1 className="text-2xl font-black leading-snug text-surface-950">{item.title}</h1>
                        {item.publishedAt && (
                            <p className="mt-2 text-xs text-surface-400">{formatBeijingDate(item.publishedAt, 'zh-CN', DATE_OPTIONS)}</p>
                        )}
                        {item.summary && (
                            <p className="mt-4 whitespace-pre-line text-base font-semibold leading-7 text-surface-700">{item.summary}</p>
                        )}
                        {item.content && (
                            <div className="mt-4 whitespace-pre-line break-words text-[15px] leading-7 text-surface-700">{item.content}</div>
                        )}
                        {item.imageUrls.length > 0 && (
                            <div className="mt-5 space-y-3">
                                {item.imageUrls.map((url) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={url} src={url} alt="" className="block w-full rounded-2xl bg-surface-100" />
                                ))}
                            </div>
                        )}
                        {item.actionLabel && item.webPath && (
                            <button
                                type="button"
                                onClick={() => router.push(item.webPath)}
                                className="mt-6 w-full rounded-2xl bg-primary-500 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:opacity-80"
                            >
                                {item.actionLabel}
                            </button>
                        )}
                    </div>
                </article>
            )}
        </div>
    );
}
