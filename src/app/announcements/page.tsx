'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronRight, Megaphone, Pin } from 'lucide-react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useAnnouncements } from '@/components/announcement/AnnouncementContext';
import { formatBeijingDate } from '@/lib/beijingTime';

const DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };

export default function AnnouncementsPage() {
    const { status } = useSession();
    const { items, loaded, unreadCount } = useAnnouncements();

    if (status === 'loading' || (status === 'authenticated' && !loaded)) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl px-4 pb-12 pt-6">
            <div className="mb-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 text-white">
                    <Megaphone className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-black text-surface-950">平台通知</h1>
                    <p className="text-sm text-surface-500">
                        {unreadCount > 0 ? `${unreadCount} 条未读` : '版本更新与活动公告'}
                    </p>
                </div>
            </div>

            {status !== 'authenticated' ? (
                <div className="rounded-2xl border border-surface-200 bg-surface p-8 text-center text-sm text-surface-500">
                    登录后查看平台通知
                </div>
            ) : items.length === 0 ? (
                <div className="rounded-2xl border border-surface-200 bg-surface p-8 text-center text-sm text-surface-500">
                    暂时没有通知
                </div>
            ) : (
                <ul className="space-y-3">
                    {items.map((item) => (
                        <li key={item.id}>
                            <Link
                                href={`/announcements/${item.id}`}
                                className="flex items-center gap-4 overflow-hidden rounded-2xl border border-surface-200 bg-surface p-3 transition-colors hover:border-primary-200"
                            >
                                {item.coverImageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={item.coverImageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                                ) : (
                                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-500">
                                        <Megaphone className="h-7 w-7" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-red-500" aria-label="未读" />}
                                        {item.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary-500" />}
                                        <span className={`truncate text-base ${item.isRead ? 'font-semibold text-surface-700' : 'font-black text-surface-950'}`}>
                                            {item.title}
                                        </span>
                                    </div>
                                    {(item.summary || item.content) && (
                                        <p className="mt-1 line-clamp-2 text-sm text-surface-500">{item.summary || item.content}</p>
                                    )}
                                    {item.publishedAt && (
                                        <p className="mt-1 text-xs text-surface-400">{formatBeijingDate(item.publishedAt, 'zh-CN', DATE_OPTIONS)}</p>
                                    )}
                                </div>
                                <ChevronRight className="h-5 w-5 shrink-0 text-surface-300" />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
