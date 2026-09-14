// 获取会话详情 DTO：按成员查找/创建，或按 roomId 拉取（需当前用户在 members 内）
export interface GetChatroomDto {
    members?: string[];
    roomId?: string;
}

export interface ChatroomDetail {
    id: string;
    members: string[];
    chatUserProfile?: {
        name: string;
        avatar: string | null;
    };
    lastMessage: string | null;
    lastMessageAt: string | null;
    unreadMembers: string[];
    isArchived: boolean;
    // 可根据实际表结构补充更多字段
}

export interface GetChatroomResponseDto {
    chatroom: ChatroomDetail | null;
}
