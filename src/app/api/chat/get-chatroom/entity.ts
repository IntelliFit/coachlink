// 获取会话详情 DTO
export interface GetChatroomDto {
    members: string[];
}

export interface ChatroomDetail {
    id: string;
    members: string[];
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadMembers: string[];
    isArchived: boolean;
    // 可根据实际表结构补充更多字段
}

export interface GetChatroomResponseDto {
    chatroom: ChatroomDetail | null;
}
