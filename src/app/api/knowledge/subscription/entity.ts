// 请求参数的接口类型
export interface GetKnowledgeSubscriptionDto {}

export interface CreateKnowledgeSubscriptionDto {
  plan: string;
  order_id?: string;
}

export interface UpdateKnowledgeSubscriptionDto {
  plan: string;
  status: string;
}

// 返回参数的接口类型
export interface GetKnowledgeSubscriptionResponseDto {
  subscription: any | null; // KnowledgeSubscriptionRow | null after importing type
}

export interface CreateKnowledgeSubscriptionResponseDto {
  subscription: any | null; // KnowledgeSubscriptionRow | null after importing type
}
