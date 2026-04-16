'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Avatar } from 'primereact/avatar';
import { Loader2, Search } from 'lucide-react';
import { chatService } from '@/app/service/chatService';
import type { MessageItem } from '@/app/api/chat/list-messages/entity';
import { formatChatBubbleTime } from '@/lib/chatMessageTime';

export interface ChatHistorySearchDialogProps {
    visible: boolean;
    onHide: () => void;
    roomId: string;
    /** 点击某条搜索结果后跳转并关闭 */
    onPickMessage: (messageId: string) => void;
}

function previewText(m: MessageItem): string {
    if (m.messageType === 'image') return m.content?.trim() ? m.content : '[图片]';
    if (m.messageType === 'video_reference') return m.content || '[视频]';
    if (m.messageType === 'file') return m.fileName || m.content || '[文件]';
    return (m.content || '').trim() || '[消息]';
}

export function ChatHistorySearchDialog({
    visible,
    onHide,
    roomId,
    onPickMessage,
}: ChatHistorySearchDialogProps) {
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<MessageItem[]>([]);

    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(query.trim()), 300);
        return () => window.clearTimeout(t);
    }, [query]);

    useEffect(() => {
        if (!visible || !roomId) return;
        if (debounced.length < 1) {
            setResults([]);
            setLoading(false);
            return;
        }

        let cancelled = false;
        setLoading(true);
        (async () => {
            const data = await chatService.searchMessages({
                roomId,
                query: debounced,
                limit: 30,
            });
            if (cancelled) return;
            setResults(data?.messages ?? []);
            setLoading(false);
        })();

        return () => {
            cancelled = true;
        };
    }, [visible, roomId, debounced]);

    useEffect(() => {
        if (!visible) {
            setQuery('');
            setDebounced('');
            setResults([]);
        }
    }, [visible]);

    const handleSelect = useCallback(
        (id: string) => {
            onPickMessage(id);
            onHide();
        },
        [onPickMessage, onHide],
    );

    return (
        <Dialog
            header="搜索聊天记录"
            visible={visible}
            onHide={onHide}
            modal
            draggable={false}
            resizable={false}
            style={{ width: 'min(520px, 95vw)' }}
            className="border-none shadow-2xl rounded-2xl overflow-hidden"
            contentClassName="p-0"
        >
            <div className="p-4 border-b border-surface-100 bg-surface-50">
                <div className="relative w-full">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                        size={18}
                    />
                    <InputText
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="搜索关键词"
                        className="w-full pl-10 py-3 rounded-xl border-surface-200"
                        autoFocus
                    />
                </div>
                <p className="mt-2 text-[11px] text-surface-500">
                    匹配文字或文件名；点击结果可定位到对话中的位置
                </p>
            </div>

            <div className="max-h-[min(420px,50vh)] overflow-y-auto p-2">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-surface-500">
                        <Loader2 className="animate-spin" size={22} />
                        <span className="text-sm">搜索中…</span>
                    </div>
                ) : debounced.length < 1 ? (
                    <div className="py-12 text-center text-sm text-surface-400">输入关键词开始搜索</div>
                ) : results.length === 0 ? (
                    <div className="py-12 text-center text-sm text-surface-400">未找到相关消息</div>
                ) : (
                    <ul className="flex flex-col gap-1">
                        {results.map((m) => (
                            <li key={m.id}>
                                <button
                                    type="button"
                                    className="w-full text-left flex gap-3 p-3 rounded-xl hover:bg-surface-100 transition-colors"
                                    onClick={() => handleSelect(m.id)}
                                >
                                    <Avatar
                                        image={m.chatUserProfile?.avatar || undefined}
                                        label={
                                            !m.chatUserProfile?.avatar && m.chatUserProfile?.name
                                                ? m.chatUserProfile.name.charAt(0)
                                                : undefined
                                        }
                                        shape="circle"
                                        className="bg-primary-500 text-surface shrink-0"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-xs text-surface-500 truncate">
                                                {m.chatUserProfile?.name || '用户'}
                                            </span>
                                            <span className="text-[10px] text-surface-400 shrink-0 tabular-nums">
                                                {formatChatBubbleTime(m.createdAt)}
                                            </span>
                                        </div>
                                        <p className="text-sm text-surface-800 line-clamp-2 mt-0.5 break-words">
                                            {previewText(m)}
                                        </p>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Dialog>
    );
}
