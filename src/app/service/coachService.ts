import { BaseService } from "@/lib/baseService";
import { ApiData } from "@/types/api";
import { Coach, CoachStudentItem } from "@/types/coach";
import type { GetContentsDto, GetContentsResponseDto } from '../api/coach/get-contents/entity';
import type { PublishContentDto, PublishContentResponseDto } from "@/app/api/coach/publish-content/entity";
import type { GetAllCoachesDto, GetAllCoachesResponseDto } from "@/app/api/coach/get-all-coaches/entity";
import type { GetSpecialtiesResponseDto } from "../api/coach/get-specialties/entity";
import type { GetCoachRulepacksDto, GetCoachRulepacksResponseDto } from "../api/coach/get-coach-rulepacks/entity";
import { GetCoachDto, GetCoachResponseDto } from "../api/coach/get-coach/entity";
import { GetStudentsResponseDto } from "../api/coach/get-students/entity";

class CoachService extends BaseService {
    async getAllCoaches(reqData: GetAllCoachesDto) {
        const res = await this.post<GetAllCoachesResponseDto>('get-all-coaches', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getStudents() {
        const res = await this.post<GetStudentsResponseDto>('get-students');
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

    async getAllSpecialties() {
        // TODO: 使用 redis 优化
        const res = await this.post<GetSpecialtiesResponseDto>('get-specialties');
        if (res.data && res.data.success) {
            return res.data.data?.specialties;
        }
    }

    async getCoachRulepacks(reqData: GetCoachRulepacksDto) {
        const res = await this.post<GetCoachRulepacksResponseDto>('get-coach-rulepacks', reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
    }

    async getCoach(reqData: GetCoachDto) {
        const res = await this.post<GetCoachResponseDto>('get-coach', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }
}

export const coachService = new CoachService('/api/coach');