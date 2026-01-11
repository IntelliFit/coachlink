export interface ContentInteractionDto {
    contentId: string;
    interactionType: 'like' | 'comment' | 'share' | 'view'; // Add more as needed
    commentContent?: string;
}

export interface ContentInteractionResponseDto {
    success: boolean;
    message: string;
    data?: {
        interactionId?: string;
        updatedLikesCount?: number;
        action?: 'added' | 'removed';
    };
}