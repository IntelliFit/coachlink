// 请求参数的接口类型
export interface GetRevenueDetailsDto {
    month?: string;  // 格式: "2026-01"，默认当月
}

// 收入明细项
export interface RevenueItem {
    id: string;
    type: 'subscription' | 'content_purchase';
    amount: number;            // 元为单位（与概览页一致）
    description: string;
    createdAt: string;
    studentName?: string;
    contentTitle?: string;
}

// 返回参数的接口类型
export interface GetRevenueDetailsResponseDto {
    subscriptionRevenue: number;      // 订阅收入（元）
    contentPurchaseRevenue: number;   // 内容购买收入（元）
    totalRevenue: number;             // 总收入（元）
    items: RevenueItem[];
}
