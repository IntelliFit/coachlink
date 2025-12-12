import { BaseService } from "@/lib/baseService";
import { ApiData } from "@/types/api";
import { Coach, CoachStudentItem } from "@/types/coach";

// Coach 相关接口
import type {
    GetCoachDto,
    GetCoachResponseDto
} from '@/app/api/coach/get-coach/entity';
import type {
    GetStudentsResponseDto
} from '@/app/api/coach/get-students/entity';
import type {
    GetAllCoachesDto,
    GetAllCoachesResponseDto
} from '@/app/api/coach/get-all-coaches/entity';

// 内容管理相关接口
import type {
    GetContentsDto,
    GetContentsResponseDto
} from '@/app/api/coach/get-contents/entity';
import type {
    PublishContentDto,
    PublishContentResponseDto
} from '@/app/api/coach/publish-content/entity';

// 规则包与专长相关接口
import type {
    GetSpecialtiesResponseDto
} from '@/app/api/coach/get-specialties/entity';
import type {
    GetCoachRulepacksDto,
    GetCoachRulepacksResponseDto
} from '@/app/api/coach/get-coach-rulepacks/entity';

// 定价管理相关接口
import type {
    GetPricingDto,
    GetPricingResponseDto
} from '@/app/api/coach/get-pricing/entity';
import type {
    UpdatePricingDto,
    UpdatePricingResponseDto
} from '@/app/api/coach/update-pricing/entity';

// 问卷管理相关接口
import type {
    GetQuestionnairesDto,
    GetQuestionnairesResponseDto
} from '@/app/api/coach/get-questionnaires/entity';
import type {
    UpdateQuestionnairesDto,
    UpdateQuestionnairesResponseDto
} from '@/app/api/coach/update-questionnaires/entity';

// 聚合信息相关接口
import type {
    GetAggregatedInfoDto,
    GetAggregatedInfoResponseDto
} from '@/app/api/coach/get-aggregated-info/entity';

// 教练资料更新相关接口
import type {
    UpdateCoachProfileDto,
    UpdateCoachProfileResponseDto
} from '@/app/api/coach/update-coach-profile/entity';

// 添加UpdateContentDto和DeleteContentDto类型
interface DeleteContentDto {
    id: string;
}

interface UpdateContentDto extends Partial<PublishContentDto> {
    id: string;
}

class CoachService extends BaseService {
    async getAllCoaches(reqData: GetAllCoachesDto) {
        const res = await this.post<GetAllCoachesResponseDto>('get-all-coaches', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getStudents(pagination?: { page: number; limit: number }) {
        const res = await this.post<GetStudentsResponseDto>('get-students', {
            pagination: pagination || { page: 0, limit: 20 }
        });
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getContents(reqData: GetContentsDto) {
        const res = await this.post<GetContentsResponseDto>('get-contents', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async publishContent(reqData: PublishContentDto) {
        const res = await this.post<PublishContentResponseDto>('publish-content', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    // 添加更新内容的方法
    async updateContent(reqData: UpdateContentDto) {
        const res = await this.post<PublishContentResponseDto>('update-content', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    // 添加删除内容的方法
    async deleteContent(contentId: string) {
        const res = await this.post<DeleteContentDto>('delete-content', { id: contentId });
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getAllSpecialties() {
        // TODO: 使用 redis 优化
        const res = await this.post<GetSpecialtiesResponseDto>('get-specialties');
        if (res.data && res.data.success) {
            return res.data.data?.specialties;
        }
    }

    async getCoach(reqData: GetCoachDto) {
        const res = await this.post<GetCoachResponseDto>('get-coach', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateCoachProfile(reqData: UpdateCoachProfileDto) {
        const res = await this.post<UpdateCoachProfileResponseDto>('update-coach-profile', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getCoachRulepacks(reqData: GetCoachRulepacksDto) {
        const res = await this.post<GetCoachRulepacksResponseDto>('get-coach-rulepacks', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getPricing(reqData: GetPricingDto) {
        const res = await this.post<GetPricingResponseDto>('get-pricing', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async updatePricing(reqData: UpdatePricingDto) {
        const res = await this.post<UpdatePricingResponseDto>('update-pricing', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getQuestionnaires(reqData?: GetQuestionnairesDto) {
        const res = await this.post<GetQuestionnairesResponseDto>('get-questionnaires', reqData || {});
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async updateQuestionnaires(reqData: UpdateQuestionnairesDto) {
        const res = await this.post<UpdateQuestionnairesResponseDto>('update-questionnaires', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getAggregatedInfo(reqData: GetAggregatedInfoDto) {
        const res = await this.post<GetAggregatedInfoResponseDto>('get-aggregated-info', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }
}

export const coachService = new CoachService('/api/coach');