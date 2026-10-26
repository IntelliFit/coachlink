'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import type { AnnouncementFeed, UserAnnouncement } from '@/lib/announcements';
import type { ApiData } from '@/types/api';
import AnnouncementPopup from './AnnouncementPopup';

type AnnouncementContextValue = {
    items: UserAnnouncement[];
    unreadCount: number;
    loaded: boolean;
    refresh: () => Promise<void>;
    markRead: (id: string) => void;
};

const EMPTY_FEED: AnnouncementFeed = { items: [], unreadCount: 0, popupIds: [] };
/** 后台标签页切回来时最多这么久重新拉一次，让新发布的公告尽快弹出。 */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** 这些页面不弹公告（后台、登录流程）。 */
const NO_POPUP_PREFIXES = ['/admin', '/auth', '/wechat-auth', '/login'];

const AnnouncementContext = createContext<AnnouncementContextValue | null>(null);

async function postMark(ids: string[], kind: 'popped' | 'read') {
    try {
        await fetch('/api/announcements/mark', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids, kind }),
        });
    } catch (error) {
        console.error('[announcements] mark failed:', error);
    }
}

export function AnnouncementProvider({ children }: { children: ReactNode }) {
    const { status } = useSession();
    const pathname = usePathname() || '';
    const [feed, setFeed] = useState<AnnouncementFeed>(EMPTY_FEED);
    const [loaded, setLoaded] = useState(false);
    const [popupItems, setPopupItems] = useState<UserAnnouncement[]>([]);
    const lastLoadAtRef = useRef(0);
    const allowPopup = !NO_POPUP_PREFIXES.some((prefix) => pathname.startsWith(prefix));

    const refresh = useCallback(async () => {
        lastLoadAtRef.current = Date.now();
        try {
            const res = await fetch('/api/announcements', { cache: 'no-store' });
            const json = await res.json() as ApiData<AnnouncementFeed>;
            if (!json.success || !json.data) return;
            setFeed(json.data);
        } catch (error) {
            console.error('[announcements] load failed:', error);
        } finally {
            setLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (status === 'authenticated') {
            void refresh();
        } else if (status === 'unauthenticated') {
            setFeed(EMPTY_FEED);
            setPopupItems([]);
        }
    }, [status, refresh]);

    useEffect(() => {
        if (status !== 'authenticated') return;
        const onVisible = () => {
            if (document.visibilityState === 'visible' && Date.now() - lastLoadAtRef.current > REFRESH_INTERVAL_MS) {
                void refresh();
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [status, refresh]);

    // 有新的待弹公告时弹出，并立刻记为「已弹出」（每人只弹一次，关闭也算）。
    useEffect(() => {
        if (!allowPopup || popupItems.length > 0 || feed.popupIds.length === 0) return;
        const byId = new Map(feed.items.map((item) => [item.id, item]));
        const toShow = feed.popupIds.map((id) => byId.get(id)).filter((item): item is UserAnnouncement => !!item);
        if (toShow.length === 0) return;
        setPopupItems(toShow);
        setFeed((prev) => ({ ...prev, popupIds: [] }));
        void postMark(toShow.map((item) => item.id), 'popped');
    }, [allowPopup, feed.items, feed.popupIds, popupItems.length]);

    const markRead = useCallback((id: string) => {
        setFeed((prev) => {
            const target = prev.items.find((item) => item.id === id);
            if (!target || target.isRead) return prev;
            return {
                ...prev,
                items: prev.items.map((item) => (item.id === id ? { ...item, isRead: true } : item)),
                unreadCount: Math.max(0, prev.unreadCount - 1),
            };
        });
        void postMark([id], 'read');
    }, []);

    const value = useMemo<AnnouncementContextValue>(() => ({
        items: feed.items,
        unreadCount: feed.unreadCount,
        loaded,
        refresh,
        markRead,
    }), [feed.items, feed.unreadCount, loaded, refresh, markRead]);

    return (
        <AnnouncementContext.Provider value={value}>
            {children}
            {popupItems.length > 0 && <AnnouncementPopup items={popupItems} onClose={() => setPopupItems([])} />}
        </AnnouncementContext.Provider>
    );
}

export function useAnnouncements(): AnnouncementContextValue {
    const ctx = useContext(AnnouncementContext);
    if (!ctx) throw new Error('useAnnouncements must be used inside AnnouncementProvider');
    return ctx;
}
