'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback } from 'react';
import ChatPanel from '@/components/chat/ChatPanel';
import { chatService } from '@/app/service/chatService';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import { useToastContext } from '@/context/ToastContext';
import { Loader2 } from 'lucide-react';

export default function MessageThreadPage() {
    const params = useParams();
    const roomId = typeof params.roomId === 'string' ? params.roomId : '';
    const router = useRouter();
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const [chatroom, setChatroom] = useState<ChatroomDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const handleMarkSuccess = useCallback(() => {
        window.dispatchEvent(new Event('chat-unread-update'));
    }, []);

    useEffect(() => {
        if (!session?.user?.id || !roomId) {
            if (!session?.user?.id) return;
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await chatService.getChatroom({ roomId });
                if (cancelled) return;
                if (res?.chatroom) {
                    setChatroom(res.chatroom);
                } else {
                    showToast({ severity: 'error', summary: '错误', detail: '无法打开会话' });
                    router.replace('/messages');
                }
            } catch {
                if (!cancelled) {
                    showToast({ severity: 'error', summary: '错误', detail: '加载失败' });
                    router.replace('/messages');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [session?.user?.id, roomId, router, showToast]);

    if (!roomId) {
        return null;
    }

    if (loading || !chatroom) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-surface-500">
                <Loader2 className="w-10 h-10 animate-spin text-primary-500" />
                <span className="text-sm font-medium">加载会话…</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-0 h-[calc(100dvh-5.5rem)] max-h-[calc(100dvh-5.5rem)] px-3 py-4 md:px-6 md:py-6 max-w-3xl mx-auto w-full">
            <ChatPanel
                variant="inline"
                active
                chatroom={chatroom}
                onMarkSuccess={handleMarkSuccess}
                onRequestClose={() => router.push('/messages')}
            />
        </div>
    );
}
