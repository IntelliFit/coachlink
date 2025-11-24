export interface GetOrCreateConversationDto {
    coach_id: string;  // coaches.id
}

export interface GetOrCreateConversationResponseDto {
    conversation_id: string;
    is_new: boolean;
}

