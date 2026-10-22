import { BaseService } from "@/lib/baseService";
import { AdminNavDataDto, AdminNavDataResponseDto } from "../api/admin/admin-nav-data/entity";
import type {
    ListCoachOnboardingDto,
    ListCoachOnboardingResponseDto,
} from "../api/admin/coach-onboarding/entity";
import {
    ListPaymentOrdersDto,
    ListPaymentOrdersResponseDto,
} from "../api/admin/payment-orders/entity";

class AdminService extends BaseService {
    async adminNavData(reqData: AdminNavDataDto) {
        const res = await this.post<AdminNavDataResponseDto>('admin-nav-data', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listCoachOnboarding(reqData: ListCoachOnboardingDto = {}) {
        const res = await this.post<ListCoachOnboardingResponseDto>('coach-onboarding', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    async listPaymentOrders(reqData: ListPaymentOrdersDto) {
        const res = await this.post<ListPaymentOrdersResponseDto>('payment-orders', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const adminService = new AdminService('/api/admin');