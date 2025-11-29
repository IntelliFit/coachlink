export interface MarkAsReadDto {
    conversation_id: string;
    message_ids?: string[];  // 可选，不传则标记全部
}

export interface MarkAsReadResponseDto {
    marked_count: number;
}


