export interface ListPublicActionContributorsDto {
    actionId: string;
}

export interface PublicActionContributorItemDto {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
    role: string | null;
    contribution_count: number;
    last_contributed_at: string | null;
}

export interface ListPublicActionContributorsResponseDto {
    contributors: PublicActionContributorItemDto[];
}

