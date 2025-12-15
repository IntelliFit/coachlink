export interface MarkAsReadDto {
    roomId: string;
    messageIds?: string[];  // 可选，不传则标记全部
}

export interface MarkAsReadResponseDto {
    markedCount: number;
}


