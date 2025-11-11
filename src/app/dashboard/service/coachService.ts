import { BaseService } from "@/lib/baseService";
import { ApiData } from "@/types/api";
import { Coach, CoachStudentItem } from "@/types/coach";
import type { GetContentsDto } from '../../api/coach/get-contents/entity';
import type { PublishContentDto, PublishContentResponseDto } from "@/app/api/coach/publish-content/entity";

class CoachService extends BaseService {
    async getAllCoaches() {
        const res = await this.post<Coach[]>('get-all-coaches');
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getStudents() {
        const res = await this.post<CoachStudentItem[]>('get-students');
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getContents(reqData: GetContentsDto) {
        const res = await this.post('get-contents', reqData);
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
}

export const coachService = new CoachService('/api/coach');