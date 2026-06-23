export interface ListPublicActionsDto {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    /**
     * 视角：决定 isAdded 的判断目标（学员/教练自己的动作库）
     * - student: student_actions (user_id, name)
     * - coach: coach_actions (coach_id, name) 其中 coach_id 存的是 users.id
     */
    viewerActionType?: "student" | "coach";
}

export interface PublicActionContributorDto {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
}

export interface PublicActionItemDto {
    id: string;
    contributor_user_id: string;
    owner_user_id?: string | null;
    name: string;
    detail: string | null;
    positions: string[] | null;
    attrs: string[] | null;
    url: string | null;
    type: string | null;
    item_schema: any | null;
    suggested_time: string | null;
    enableAutoWeightCompute?: boolean | null;
    includesBodyWeight?: boolean | null;
    canonical_action_id?: string | null;
    reference_image_url?: string | null;
    reference_animation_url?: string | null;
    like_count: number;
    created_at: string | null;
    updated_at: string | null;

    // computed fields for client
    isLiked: boolean;
    isAdded: boolean;
    contributor: PublicActionContributorDto | null;
}

export interface ListPublicActionsResponseDto {
    actions: PublicActionItemDto[];
    totalCount: number;
    page: number;
    limit: number;
}
