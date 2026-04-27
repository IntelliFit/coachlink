'use client';

import React from 'react';
import { MessageItem } from '@/components/chat/MessageItem';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';
import { formatChatDateSeparator, shouldShowDateSeparator } from '@/lib/chatMessageTime';

export function ChatMessageList({
    messages,
    highlightMessageId,
    onReply,
    onJumpToMessage,
}: {
    messages: MessageItemType[];
    highlightMessageId?: string | null;
    onReply?: (message: MessageItemType) => void;
    onJumpToMessage?: (messageId: string) => void;
}) {
    return (
        <>
            {messages.map((message, i) => {
                const prev = i > 0 ? messages[i - 1] : null;
                const showSep = shouldShowDateSeparator(prev?.createdAt, message.createdAt);
                return (
                    <React.Fragment key={message.id}>
                        {showSep && (
                            <div className="flex justify-center my-1">
                                <span className="text-[11px] font-medium text-surface-500 bg-surface-100/95 dark:bg-surface-800/80 px-3 py-1 rounded-full shadow-sm">
                                    {formatChatDateSeparator(message.createdAt)}
                                </span>
                            </div>
                        )}
                        <MessageItem
                            message={message}
                            highlighted={highlightMessageId === message.id}
                            onReply={onReply}
                            onJumpToMessage={onJumpToMessage}
                        />
                    </React.Fragment>
                );
            })}
        </>
    );
}
