export interface CoachMessagesDto {
    limit?: number;
}

export interface MessageItem {
    id: string;
    created_at: string | null;
}

export interface CoachMessagesResponseDto {
    messages: MessageItem[];
    total: number;
    limit: number;
}
