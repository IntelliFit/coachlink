'use client';

import React from 'react';
import ChatPanel from '@/components/chat/ChatPanel';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';

interface ChatDialogProps {
    visible: boolean;
    onHide: () => void;
    chatroom: ChatroomDetail | null;
    onMarkSuccess?: (roomId: string) => void;
}

/** 弹窗模式私信（移动端 / 会话列表内嵌打开） */
const ChatDialog: React.FC<ChatDialogProps> = ({ visible, onHide, chatroom, onMarkSuccess }) => (
    <ChatPanel
        variant="modal"
        chatroom={chatroom}
        onMarkSuccess={onMarkSuccess}
        active={visible && !!chatroom}
        dialogVisible={visible}
        onHide={onHide}
    />
);

export default ChatDialog;
