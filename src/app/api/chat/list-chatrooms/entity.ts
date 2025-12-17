export interface GetChatroomsDto {
    page?: number;
    limit?: number;
}

export interface ChatroomItem {
    id: string;
    chatUserId: string;
    chatUserProfile: {
        name: string;
        avatar: string | null;
    };
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadMembers: string[];
    unreadCount: number;
    isArchived: boolean;
}

export interface GetChatroomsResponseDto {
    chatRooms: ChatroomItem[];
    total: number;
}

