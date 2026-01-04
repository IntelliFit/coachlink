import type { VideoReferenceItem } from "../send-message/entity";

export interface GetMessagesDto {
    roomId: string;
    page?: number;
    limit?: number;
    beforeId?: string; // 用于分页加载更多历史消息
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
        video_references?: VideoReferenceItem[];
    } | null;
}

export interface GetMessagesResponseDto {
    messages: MessageItem[];
    has_more: boolean;
    total: number;
}
