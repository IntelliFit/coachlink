export interface SearchUserRequestDto {
    query: string;
}

export interface SearchUserResponseDto {
    success: boolean;
    data?: {
        id: string;
        nickname: string;
        avatarUrl: string;
        searchId?: string;
    }[];
    message?: string;
}

export interface FriendRequestDto {
    targetUserId: string;
    message?: string;
}

export interface FriendRequestResponseDto {
    success: boolean;
    data?: {
        friendshipId: string;
        status:
            | "pending"
            | "already_friends"
            | "already_requested"
            | "accepted";
    };
    message?: string;
}

export interface FriendsListResponseDto {
    success: boolean;
    data?: {
        friends: {
            userId: string;
            nickname: string;
            avatarUrl: string;
            friendsSince: string;
        }[];
        total: number;
    };
    message?: string;
}

export interface PendingRequestsResponseDto {
    success: boolean;
    data?: {
        requests: {
            friendshipId: string;
            requester: {
                userId: string;
                nickname: string;
                avatarUrl: string;
            };
            createdAt: string;
            message?: string;
        }[];
        total: number;
    };
    message?: string;
}

export interface RespondRequestDto {
    friendshipId: string;
    action: "accept" | "reject" | "block";
}

export interface RespondRequestResponseDto {
    success: boolean;
    data?: {
        newStatus: string;
    };
    message?: string;
}

export interface ActivityResponseDto {
    success: boolean;
    data?: {
        activities: {
            id: string;
            user: {
                userId: string;
                nickname: string;
                avatarUrl: string;
            };
            execution: {
                executionId: string;
                planName: string;
                dayIndex: number;
                totalVolume: number;
                durationMinutes: number;
                completedAt: string;
            };
        }[];
        nextCursor?: string;
    };
    message?: string;
}
