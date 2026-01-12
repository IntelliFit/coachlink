import { BaseService } from "@/lib/baseService";

import type {
    CreateGrowthShareDto,
    CreateGrowthShareResponseDto,
} from "@/app/api/growth/share/create/entity";

export class GrowthService extends BaseService {
    async createShareLink(dto: CreateGrowthShareDto) {
        const res = await this.post<CreateGrowthShareResponseDto>("share/create", dto);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data.message || "创建分享链接失败");
    }
}

export const growthService = new GrowthService("/api/growth");

