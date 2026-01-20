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
import type {
    GetE1RMHistoryDto,
    GetE1RMHistoryResponseDto,
} from "../api/student/get-e1rm-history/entity";
import type {
    GetCurrent1RMDto,
    GetCurrent1RMResponseDto,
} from "../api/student/get-current-1rm/entity";
import type {
    GetStudentStatsDto,
    GetStudentStatsResponseDto,
} from "../api/student/get-stats/entity";

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
    async updateProfile(reqData: UpdateProileDto) {
        const res = await this.post<UpdateProfileResponseDto>(
            "update-profile",
            reqData,
        );
        console.log("updateProfile API response:", res.data);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        console.error("updateProfile failed:", res.data);
        return null;
    }

    /**
     * @description 获取 e1RM 历史数据
     * @param reqData
     * @returns
     */
    async getE1RMHistory(reqData: GetE1RMHistoryDto) {
        try {
            const response = await fetch("/api/student/get-e1rm-history", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqData),
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch e1RM history:", error);
            return null;
        }
    }

    /**
     * @description 获取当前 1RM 数据
     * @param reqData
     * @returns
     */
    async getCurrent1RM(reqData: GetCurrent1RMDto) {
        try {
            const response = await fetch("/api/student/get-current-1rm", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqData),
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch current 1RM:", error);
            return null;
        }
    }

    /**
     * @description 获取学生统计数据（订阅数量、进行中计划数量、已完成训练数量）
     * @param reqData
     * @returns
     */
    async getStudentStats(reqData?: GetStudentStatsDto) {
        try {
            const response = await fetch("/api/student/get-stats", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqData || {}),
            });

            const result = await response.json();
            if (result.success) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error("Failed to fetch student stats:", error);
            return null;
        }
    }
}

export const studentService = new StudentService("/api/user");
export type { LifestyleLogPayload, PlanDetailItem, WorkoutLogPayload };
