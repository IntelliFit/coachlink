import { BaseService } from "@/lib/baseService";
import { ApiData } from "@/types/api";
import { Coach, CoachStudentItem } from "@/types/coach";
import { AdminNavDataDto, AdminNavDataResponseDto } from "../api/admin/admin-nav-data/entity";


class AdminService extends BaseService {
    async adminNavData(reqData: AdminNavDataDto) {
        const res = await this.post<AdminNavDataResponseDto>('admin-nav-data', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const adminService = new AdminService('/api/admin');