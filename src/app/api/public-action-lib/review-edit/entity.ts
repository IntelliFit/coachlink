export interface ReviewPublicActionEditDto {
    actionId: string;
    editId: string;
    decision: "approve" | "reject";
    reviewNote?: string | null;
}

export interface ReviewPublicActionEditResponseDto {
    action: any;
    edit: any;
}

