import { BaseService } from "@/lib/baseService";

// 导入所有需要的类型定义
import type {
    GetFormSchemaDto,
    GetFormSchemaResponseDto,
} from "../api/user/get-form-schema/entity";
import type {
    SubmitOnboardingDto,
    SubmitOnboardingResponseDto,
} from "../api/user/submit-onboarding/entity";
import type {
    GetStudentProfileDto,
    GetStudentProfileResponseDto,
} from "../api/user/get-student-profile/entity";
import type {
    PlanDetailItem,
    UpsertTrainingPlanDetailsDto,
    UpsertTrainingPlanDetailsResponseDto,
} from "../api/user/upsert-training-plan-details/entity";
import type {
    SubmitWorkoutLogDto,
    SubmitWorkoutLogResponseDto,
    WorkoutLogPayload,
} from "../api/user/submit-workout-log/entity";
import type {
    LifestyleLogPayload,
    SubmitLifestyleLogDto,
    SubmitLifestyleLogResponseDto,
} from "../api/user/submit-lifestyle-log/entity";
import type {
    UpdateProfileResponseDto,
    UpdateProileDto,
} from "../api/user/update-profile/entity";

class StudentService extends BaseService {
    /**
     * @description 提交新手入门信息
     * @param payload
     * @returns
     */
    async submitOnboarding(reqData: SubmitOnboardingDto) {
        const res = await this.post<SubmitOnboardingResponseDto>(
            "submit-onboarding",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    /**
     * @description 获取学生档案
     * @param userId
     * @returns
     */
    async getStudentProfile(userId?: string) {
        const res = await this.post<GetStudentProfileResponseDto>(
            "get-student-profile",
            userId ? { userId } : {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    /**
     * @description 更新训练计划详情
     * @param training_plan_id
     * @param details
     * @returns
     */
    async upsertTrainingPlanDetails(
        training_plan_id: string,
        details: PlanDetailItem[],
    ) {
        const reqData: UpsertTrainingPlanDetailsDto = {
            training_plan_id,
            details,
        };

        const res = await this.post<UpsertTrainingPlanDetailsResponseDto>(
            "upsert-training-plan-details",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    /**
     * @description 提交训练日志
     * @param payload
     * @returns
     */
    async submitWorkoutLog(payload: WorkoutLogPayload) {
        const res = await this.post<SubmitWorkoutLogResponseDto>(
            "submit-workout-log",
            payload,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    /**
     * @description 提交生活方式日志
     * @param payload
     * @returns
     */
    async submitLifestyleLog(payload: LifestyleLogPayload) {
        const res = await this.post<SubmitLifestyleLogResponseDto>(
            "submit-lifestyle-log",
            payload,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    /**
     * @description 获取表单配置
     * @param reqData
     * @returns
     */
    // async getFormSchema(reqData: GetFormSchemaDto) {
    //     const res = await this.post<GetFormSchemaResponseDto>('get-form-schema', reqData);
    //     if (res.data && res.data.success) {
    //         return res.data.data;
    //     }

    //     return null;
    //     return null;
    // }

    /**
     * @description 更新个人档案
     * @param userId
     * @param data
     * @returns
     */
    async updateProfile(userId: string, data: Partial<UpdateProileDto>) {
        const res = await this.post<UpdateProfileResponseDto>(
            "update-profile",
            { ...data, userId },
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
}

export const studentService = new StudentService("/api/user");
export type { LifestyleLogPayload, PlanDetailItem, WorkoutLogPayload };
