import {
    ActivityResponseDto,
    FriendRequestDto,
    FriendRequestResponseDto,
    FriendsListResponseDto,
    PendingRequestsResponseDto,
    RespondRequestDto,
    RespondRequestResponseDto,
    SearchUserRequestDto,
    SearchUserResponseDto,
} from "../api/friends/entity";

export const friendService = {
    /**
     * Search for users by nickname or search ID
     */
    async searchUsers(query: string): Promise<SearchUserResponseDto> {
        try {
            const res = await fetch(
                `/api/user/search?query=${encodeURIComponent(query)}`,
            );
            return await res.json();
        } catch (error) {
            console.error("Search users failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Send a friend request
     */
    async sendRequest(
        targetUserId: string,
        message?: string,
    ): Promise<FriendRequestResponseDto> {
        try {
            const res = await fetch("/api/user/friends/request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    { targetUserId, message } as FriendRequestDto,
                ),
            });
            return await res.json();
        } catch (error) {
            console.error("Send friend request failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Get list of friends (accepted)
     */
    async getFriends(): Promise<FriendsListResponseDto> {
        try {
            const res = await fetch("/api/user/friends");
            return await res.json();
        } catch (error) {
            console.error("Get friends failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Get pending friend requests containing me
     */
    async getPendingRequests(): Promise<PendingRequestsResponseDto> {
        try {
            const res = await fetch("/api/user/friends/pending");
            return await res.json();
        } catch (error) {
            console.error("Get pending requests failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Respond to a friend request (accept/reject/block)
     */
    async respondToRequest(
        friendshipId: string,
        action: "accept" | "reject" | "block",
    ): Promise<RespondRequestResponseDto> {
        try {
            const res = await fetch("/api/user/friends/respond", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    { friendshipId, action } as RespondRequestDto,
                ),
            });
            return await res.json();
        } catch (error) {
            console.error("Respond to request failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Get friend activity feed
     */
    async getActivity(
        limit: number = 20,
        cursor?: string,
    ): Promise<ActivityResponseDto> {
        try {
            let url = `/api/user/friends/activity?limit=${limit}`;
            if (cursor) url += `&cursor=${cursor}`;

            const res = await fetch(url);
            return await res.json();
        } catch (error) {
            console.error("Get activity failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Remove a friend
     */
    async removeFriend(
        friendId: string,
    ): Promise<{ success: boolean; message?: string }> {
        try {
            const res = await fetch(`/api/user/friends/${friendId}`, {
                method: "DELETE",
            });
            return await res.json();
        } catch (error) {
            console.error("Remove friend failed:", error);
            return { success: false, message: "网络错误" };
        }
    },

    /**
     * Get friend records (for profile page)
     */
    async getFriendRecords(
        friendId: string,
        limit: number = 20,
        offset: number = 0,
    ): Promise<any> {
        try {
            const res = await fetch(
                `/api/user/friends/${friendId}/records?limit=${limit}&offset=${offset}`,
            );
            return await res.json();
        } catch (error) {
            console.error("Get friend records failed:", error);
            return { success: false, message: "网络错误" };
        }
    },
};
