export interface GetMessagesDto {
    conversation_id: string;
    page?: number;
    limit?: number;
    before_id?: string;  // 用于分页加载更多历史消息
}

export interface MessageItem {
    id: string;
    sender_id: string;
    receiver_id: string;
    message_type: string;
    content: string;
    media_url: string | null;
    file_name: string | null;
    file_size: number | null;
    duration: number | null;
    is_read: boolean;
    created_at: string;
    sender_name: string;
    sender_avatar: string | null;
    is_mine: boolean;
}

export interface GetMessagesResponseDto {
    messages: MessageItem[];
    has_more: boolean;
    total: number;
}

