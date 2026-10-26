'use client';

import { useRouter } from 'next/navigation';
import { Megaphone } from 'lucide-react';
import { useAnnouncements } from './AnnouncementContext';

/** 导航栏的「通知」入口：喇叭图标 + 未读数红点。 */
export default function AnnouncementBellButton({ className = '' }: { className?: string }) {
    const router = useRouter();
    const { unreadCount } = useAnnouncements();
    return (
        <button
            type="button"
            aria-label={unreadCount > 0 ? `平台通知，${unreadCount} 条未读` : '平台通知'}
            title="平台通知"
            onClick={() => router.push('/announcements')}
            className={`relative p-2 rounded-xl text-surface-500 hover:bg-surface hover:text-primary-500 transition-all ${className}`}
        >
            <Megaphone size={18} strokeWidth={2.25} />
            {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface">
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            )}
        </button>
    );
}
