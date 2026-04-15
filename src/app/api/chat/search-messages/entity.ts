import type { MessageItem } from "../list-messages/entity";

export interface SearchMessagesDto {
    roomId: string;
    query: string;
    limit?: number;
}

export interface SearchMessagesResponseDto {
    messages: MessageItem[];
}
