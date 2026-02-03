export interface ListPublicActionEditsDto {
    actionId: string;
    includePending?: boolean;
}

export interface PublicActionEditUserDto {
    userId: string;
    nickname: string | null;
    avatarUrl: string | null;
}

export interface PublicActionEditItemDto {
    id: string;
    action_id: string;
    proposer_user_id: string;
    reviewer_user_id: string | null;
    status: "pending" | "approved" | "rejected";
    proposed_name: string | null;
    proposed_detail: string | null;
    proposed_positions: string[] | null;
    proposed_attrs: string[] | null;
    proposed_url: string | null;
    proposed_type: string | null;
    proposed_item_schema: any | null;
    proposed_suggested_time: string | null;
    proposed_enableAutoWeightCompute: boolean | null;
    proposed_includesBodyWeight: boolean | null;
    proposed_canonical_action_id: string | null;
    created_at: string | null;
    reviewed_at: string | null;
    review_note: string | null;
    proposer: PublicActionEditUserDto | null;
    reviewer: PublicActionEditUserDto | null;
}

export interface ListPublicActionEditsResponseDto {
    isOwner: boolean;
    edits: PublicActionEditItemDto[];
}

