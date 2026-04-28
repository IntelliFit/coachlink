import type { VideoReferenceItem } from "../send-message/entity";

export interface GetMessagesDto {
    roomId: string;
    page?: number;
    limit?: number;
    beforeId?: string; // 用于分页加载更多历史消息
    /** 跳转到某条消息附近（加载其前后各一段，用于搜索定位） */
    anchorMessageId?: string;
}

export interface MessageItem {
    id: string;
    chatUserId: string;
    chatUserProfile: {
        name: string;
        avatar: string | null;
    };
    messageType: string;
    content: string;
    mediaUrl: string | null;
    fileName: string | null;
    fileSize: number | null;
    duration: number | null;
    isRead: boolean;
    createdAt: string;
    isMine: boolean;
    contentMetadata?: {
        reply_to_message?: {
            id: string;
            senderId: string;
            senderName: string;
            messageType: string;
            contentPreview: string;
            mediaUrl?: string | null;
        };
        video_references?: VideoReferenceItem[];
        broadcast?: boolean;
        contentId?: string;
        contentTitle?: string;
        contentLink?: string;
        coach_ai_auto_reply?: boolean;
        virtual_avatar_label?: string;
        provider?: string;
        model?: string;
    } | null;
}

export interface GetMessagesResponseDto {
    messages: MessageItem[];
    has_more: boolean;
    total: number;
}
