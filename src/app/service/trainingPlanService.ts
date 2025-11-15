import { BaseService } from "@/lib/baseService";

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

class TrainingPlanService extends BaseService {
    async getTrainingPlans() {
        const res = await this.post<GetTrainingPlansResponse>('get-training-plans');
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
}

export const trainingPlanService = new TrainingPlanService('/api/training');