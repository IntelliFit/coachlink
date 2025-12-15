export interface GetChatroomsDto {
    page?: number;
    limit?: number;
}

export interface ConversationItem {
    id: string;
    chatUserId: string;
    chatUserProfile: {
        name: string;
        avatar: string | null;
    };
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadMembers: string[];
    isArchived: boolean;
}

export interface GetChatroomsResponseDto {
    chatRooms: ConversationItem[];
    total: number;
}

