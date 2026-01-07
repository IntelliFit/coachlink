export interface ListKnowledgeSubscriptionsDto {
  user_id?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface ListKnowledgeSubscriptionsResponseDto {
  subscriptions: any[]; // KnowledgeSubscriptionRow[] after importing type
  total: number;
  page: number;
  limit: number;
}
