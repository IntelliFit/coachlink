export interface CreateKnowledgeSubscriptionDto {
  plan: string;
  order_id?: string;
}

export interface CreateKnowledgeSubscriptionResponseDto {
  subscription: any | null; // KnowledgeSubscriptionRow | null after importing type
}
