import { BaseService } from "@/lib/baseService";
import type { UpdateProfileResponseDto, UpdateProileDto } from "../api/user/update-profile/entity";
import type { GetTrainingPlansDto, GetTrainingPlansResponseDto } from "../api/user/get-training-plans/entity";
import type { GetTrainingPlansDetailDto, GetTrainingPlansDetailResponseDto } from "../api/user/get-training-detail/entity";

interface PlanItem {
  id: string
  title: string
  description: string
  duration_weeks: number
  difficulty_level: string
  ai_generated: boolean
  created_at: string
}

interface GetTrainingPlansResponse {
  plans: PlanItem[]
}

class UserPlanService extends BaseService {
    async getTrainingPlans(reqData: GetTrainingPlansDto) {
        const res = await this.post<GetTrainingPlansResponseDto>('get-training-plans', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getTrainingPlanDetail(reqData: GetTrainingPlansDetailDto) {
        const res = await this.post<GetTrainingPlansDetailResponseDto>('get-training-detail', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async deleteTrainingPlan(planId: string) {
        const res = await this.post('delete-training-plan', { training_plan_id: planId });
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateProfile(reqData: UpdateProileDto) {
        const res = await this.post<UpdateProfileResponseDto>('update-profile', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
}

export const userService = new UserPlanService('/api/user');