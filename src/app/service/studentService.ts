import { userService, type PlanDetailItem, type WorkoutLogPayload, type LifestyleLogPayload } from './userService';

export type { PlanDetailItem, WorkoutLogPayload, LifestyleLogPayload };

export interface OnboardingPayload {
    coachId?: string;
    answers: Record<string, any>;
    baseline_video_urls?: string[];
}

class StudentService {
    private getCurrentUserId(): string {
        const userId = localStorage.getItem('current_user_id');
        if (!userId) throw new Error('未登录，无法执行该操作');
        return userId;
    }

    async submitOnboarding(payload: OnboardingPayload) {
        const userId = this.getCurrentUserId();
        return await userService.submitOnboarding({
            userId,
            coachId: payload.coachId,
            answers: payload.answers,
            baseline_video_urls: payload.baseline_video_urls
        });
    }

    async getStudentProfile(userId?: string) {
        const effectiveUserId = userId || this.getCurrentUserId();
        return await userService.getStudentProfile({ userId: effectiveUserId });
    }

    async upsertTrainingPlanDetails(training_plan_id: string, details: PlanDetailItem[]) {
        return await userService.upsertTrainingPlanDetails({ training_plan_id, details });
    }

    async submitWorkoutLog(payload: WorkoutLogPayload) {
        const userId = this.getCurrentUserId();
        return await userService.submitWorkoutLog({
            userId,
            payload
        });
    }

    async submitLifestyleLog(payload: LifestyleLogPayload) {
        const userId = this.getCurrentUserId();
        return await userService.submitLifestyleLog({
            userId,
            payload
        });
    }
}

export const studentService = new StudentService();
export default studentService;


