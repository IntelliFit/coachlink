export interface ListPublicActionsDto {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
}

export interface PublicActionContributorDto {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
}

export interface PublicActionItemDto {
    id: string;
    contributor_user_id: string;
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

