export interface UpdateKnowledgeSubscriptionDto {
  plan: string;
  status: string;
}

export interface UpdateKnowledgeSubscriptionResponseDto {
  subscription: any | null; // KnowledgeSubscriptionRow | null after importing type
}
