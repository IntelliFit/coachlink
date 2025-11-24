export interface GetConversationsDto {
    page?: number;
    limit?: number;
}

export interface ConversationItem {
    id: string;
    coach_id: string;
    student_id: string;
    coach_name: string;
    student_name: string;
    coach_avatar: string | null;
    student_avatar: string | null;
    last_message: string | null;
    last_message_at: string | null;
    unread_count: number;
    is_archived: boolean;
}

export interface GetConversationsResponseDto {
    conversations: ConversationItem[];
    total: number;
}

