export interface SendMessageDto {
    conversation_id: string;
    message_type: 'text' | 'image' | 'video' | 'voice' | 'file';
    content: string;
    media_url?: string;
    file_name?: string;
    file_size?: number;
    duration?: number;
}

export interface SendMessageResponseDto {
    message_id: string;
    created_at: string;
}


