export interface SendMessageDto {
    roomId: string;
    messageType: 'text' | 'image' | 'video' | 'voice' | 'file';
    content: string;
    mediaUrl?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
}

export interface SendMessageResponseDto {
    messageId: string;
    createdAt: string;
}


