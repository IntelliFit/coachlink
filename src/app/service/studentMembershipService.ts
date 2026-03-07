import { BaseService } from "@/lib/baseService";

// Entity Definitions
export interface StudentMembership {
    user_id: string;
    tier: "free" | "basic" | "premium" | "trial";
    start_date: string;
    end_date: string | null;
    status: "active" | "expired";
}

export interface StudentQuota {
    user_id: string;
    ai_import_balance: number;
    storage_total_mb: number;
    storage_used_mb: number;
}

export interface MembershipOrder {
    id: string;
    user_id: string;
    product_key: string;
    amount: number;
    status: "pending" | "paid" | "cancelled";
    created_at: string;
}

// DTOs
export interface CreateOrderDto {
    productKey: string;
    paymentMethod: "alipay" | "wechat";
    couponId?: string;
}

export interface CreateOrderResponse {
    orderId: string;
    paymentUrl?: string;
    paymentHtml?: string;
}

export const MEMBER_BENEFITS = {
    free: {
        ai_limit_monthly: 2,
        storage_mb: 200,
        can_access_advanced_report: false,
    },
    basic: {
        ai_limit_monthly: 10,
        storage_mb: 1024,
        can_access_advanced_report: false,
    },
    premium: {
        ai_limit_monthly: 999999, // Infinite
        storage_mb: 5120,
        can_access_advanced_report: true,
    },
    // Trial behaves like Premium
    trial: {
        ai_limit_monthly: 999999,
        storage_mb: 5120,
        can_access_advanced_report: true,
    },
};

export class StudentMembershipService extends BaseService {
    /**
     * Get current membership status
     */
    async getMembership(userId?: string) {
        const res = await this.post<StudentMembership>("get-status", {
            userId,
        });
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    /**
     * Get current usage quotas
     */
    async getQuota(userId?: string) {
        const res = await this.post<StudentQuota>("get-quota", {
            userId,
        });
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    /**
     * Create a new subscription order
     */
    async createOrder(data: CreateOrderDto) {
        const res = await this.post<CreateOrderResponse>(
            "create-order",
            data,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    /**
     * Check if user has enough smart generation quota and optionally deduct
     * This calls the backend which implements "Lazy Reset" logic
     */
    async consumeAiQuota(count: number = 1) {
        const res = await this.post<
            { success: boolean; remaining: number; message?: string }
        >("consume-ai-quota", { count });
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null; // Return null on failure (e.g. insufficient quota)
    }
}

export const studentMembershipService = new StudentMembershipService(
    "/api/membership",
);
