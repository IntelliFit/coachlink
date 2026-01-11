export interface CheckContentInteractionDto {
    contentId: string;
    userId: string;
    interactionType: 'like' | 'comment' | 'share' | 'view';
}

export interface CheckContentInteractionResponseDto {
    hasInteracted: boolean;
    interactionId?: string;
}