import { BaseService } from "@/lib/baseService";
import type {
    UpdateProfileResponseDto,
    UpdateProileDto,
} from "../api/user/update-profile/entity";
import type {
    GetUserProfileDto,
    GetUserProfileResponseDto,
} from "../api/user/get-profile/entity";
import type {
    GetTrainingPlansDto,
    GetTrainingPlansResponseDto,
} from "../api/user/get-training-plans/entity";
import type {
    GetTrainingPlansDetailDto,
    GetTrainingPlansDetailResponseDto,
} from "../api/user/get-training-detail/entity";
// 导入训练提醒相关的类型定义
import type {
    GetTrainingRemindersDto,
    GetTrainingRemindersResponseDto,
} from "../api/user/get-training-reminders/entity";
import type {
    CreateTrainingReminderDto,
    CreateTrainingReminderResponseDto,
} from "../api/user/create-training-reminder/entity";
import type {
    UpdateTrainingReminderDto,
    UpdateTrainingReminderResponseDto,
} from "../api/user/update-training-reminder/entity";
import type {
    DeleteTrainingReminderDto,
    DeleteTrainingReminderResponseDto,
} from "../api/user/delete-training-reminder/entity";
// 导入训练进度相关的类型定义
import type {
    GetTrainingProgressDto,
    GetTrainingProgressResponseDto,
} from "../api/user/get-training-progress/entity";
import type {
    GetPersonalRecordsDto,
    GetPersonalRecordsResponseDto,
} from "../api/user/get-personal-records/entity";
import type {
    GetWeeklyProgressDto,
    GetWeeklyProgressResponseDto,
} from "../api/user/get-weekly-progress/entity";
// 导入学生服务相关的类型定义
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
// 导入个人记录相关的类型定义
import type {
    UpdatePersonalRecordsDto,
    UpdatePersonalRecordsResponseDto,
} from "../api/user/update-personal-records/entity";
// 导入训练会话相关的类型定义
import type {
    CreateTrainingSessionDto,
    CreateTrainingSessionResponseDto,
} from "../api/user/create-training-session/entity";
// 导入训练动作相关的类型定义
import type {
    CreateTrainingExercisesDto,
    CreateTrainingExercisesResponseDto,
} from "../api/user/create-training-exercises/entity";
import type {
    UpdateTrainingExerciseDto,
    UpdateTrainingExerciseResponseDto,
} from "../api/user/update-training-exercise/entity";
import {
    UpdateTrainingSessionDto,
    UpdateTrainingSessionResponseDto,
} from "../api/user/update-training-session/entity";

// 导入今日会话相关的类型定义
import type {
    CreateTodaySessionDto,
    CreateTodaySessionResponseDto,
} from "../api/user/create-today-session/entity";

// 导入学生评论相关的类型定义
import type {
    GetStudentCommentDto,
    GetStudentCommentResponseDto,
} from "../api/user/get-student-comment/entity";
import type {
    CreateStudentCommentDto,
    CreateStudentCommentResponseDto,
} from "../api/user/create-student-comment/entity";
import type {
    UpdateStudentCommentDto,
    UpdateStudentCommentResponseDto,
} from "../api/user/update-student-comment/entity";
import type {
    DeleteStudentCommentDto,
    DeleteStudentCommentResponseDto,
} from "../api/user/delete-student-comment/entity";

// 导入获取所有用户相关的类型定义
import type {
    GetAllUsersDto,
    GetAllUsersResponseDto,
} from "../api/user/get-all-users/entity";

// 导入修改密码相关的类型定义
import type {
    ChangePasswordDto,
    ChangePasswordResponseDto,
} from "../api/user/change-password/entity";
import type {
    BindContactDto,
    BindContactResponseDto,
} from "../api/user/bind-contact/entity";
import type {
    UnbindContactDto,
    UnbindContactResponseDto,
} from "../api/user/unbind-contact/entity";

class UserPlanService extends BaseService {
    /**
     * @description 修改密码
     * @param reqData
     * @returns
     */
    async changePassword(reqData: ChangePasswordDto) {
        const res = await this.post<ChangePasswordResponseDto>(
            "change-password",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        throw new Error(res.data.message || "修改密码失败");
    }

    /**
     * @description 绑定手机号/邮箱（需要验证码）
     */
    async bindContact(reqData: BindContactDto) {
        const res = await this.post<BindContactResponseDto>("bind-contact", reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data.message || "绑定失败");
    }

    /**
     * @description 解绑手机号/邮箱/微信
     */
    async unbindContact(reqData: UnbindContactDto) {
        const res = await this.post<UnbindContactResponseDto>("unbind-contact", reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        throw new Error(res.data.message || "解绑失败");
    }

    /**
     * @description 获取训练计划
     * @param reqData 如果查找当前登录用户的全部计划，不需要输入任何参数。如果查找计划明或者某个教练的计划，输入对应的 id
     * @returns
     */
    async getTrainingPlans(reqData?: GetTrainingPlansDto) {
        const res = await this.post<GetTrainingPlansResponseDto>(
            "get-training-plans",
            reqData || {},
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async cleanupOrphanPlans() {
        const res = await this.post("cleanup-orphan-plans", {});
        if (res.data && res.data.success) {
            return res.data.data as { deleted: number };
        }
        return null;
    }

    /**
     * @description 根据 ID 获取训练计划详情，通过 getTrainingPlans 获取对应的 ID 数组
     * @param reqData
     * @returns
     */
    async getTrainingPlanDetail(reqData: GetTrainingPlansDetailDto) {
        const res = await this.post<GetTrainingPlansDetailResponseDto>(
            "get-training-detail",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async deleteTrainingPlan(planId: string) {
        const res = await this.post("delete-training-plan", {
            training_plan_id: planId,
        });
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateProfile(reqData: UpdateProileDto) {
        const res = await this.post<UpdateProfileResponseDto>(
            "update-profile",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
    }

    async getProfile(reqData: GetUserProfileDto) {
        const res = await this.post<GetUserProfileResponseDto>(
            "get-profile",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    // 训练提醒相关方法
    async getTrainingReminders(reqData: GetTrainingRemindersDto) {
        const res = await this.post<GetTrainingRemindersResponseDto>(
            "get-training-reminders",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async createTrainingReminder(reqData: CreateTrainingReminderDto) {
        const res = await this.post<CreateTrainingReminderResponseDto>(
            "create-training-reminder",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateTrainingReminder(reqData: UpdateTrainingReminderDto) {
        const res = await this.post<UpdateTrainingReminderResponseDto>(
            "update-training-reminder",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async deleteTrainingReminder(reqData: DeleteTrainingReminderDto) {
        const res = await this.post<DeleteTrainingReminderResponseDto>(
            "delete-training-reminder",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 训练进度相关方法
    async getTrainingProgress(reqData: GetTrainingProgressDto) {
        const res = await this.post<GetTrainingProgressResponseDto>(
            "get-training-progress",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getPersonalRecords(reqData: GetPersonalRecordsDto) {
        const res = await this.post<GetPersonalRecordsResponseDto>(
            "get-personal-records",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async getWeeklyProgress(reqData: GetWeeklyProgressDto) {
        const res = await this.post<GetWeeklyProgressResponseDto>(
            "get-weekly-progress",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 学生服务相关方法
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

    async getStudentProfile(reqData: GetStudentProfileDto) {
        const res = await this.post<GetStudentProfileResponseDto>(
            "get-student-profile",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async upsertTrainingPlanDetails(reqData: UpsertTrainingPlanDetailsDto) {
        const res = await this.post<UpsertTrainingPlanDetailsResponseDto>(
            "upsert-training-plan-details",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async submitWorkoutLog(reqData: SubmitWorkoutLogDto) {
        const res = await this.post<SubmitWorkoutLogResponseDto>(
            "submit-workout-log",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async submitLifestyleLog(reqData: SubmitLifestyleLogDto) {
        const res = await this.post<SubmitLifestyleLogResponseDto>(
            "submit-lifestyle-log",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 个人记录相关方法
    async updatePersonalRecords(reqData: UpdatePersonalRecordsDto) {
        const res = await this.post<UpdatePersonalRecordsResponseDto>(
            "update-personal-records",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 训练会话相关方法
    async createTrainingSession(reqData: CreateTrainingSessionDto) {
        const res = await this.post<CreateTrainingSessionResponseDto>(
            "create-training-session",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateTrainingSession(reqData: UpdateTrainingSessionDto) {
        const res = await this.post<UpdateTrainingSessionResponseDto>(
            "update-training-session",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 训练动作相关方法
    async createTrainingExercises(reqData: CreateTrainingExercisesDto) {
        const res = await this.post<CreateTrainingExercisesResponseDto>(
            "create-training-exercises",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateTrainingExercise(reqData: UpdateTrainingExerciseDto) {
        const res = await this.post<UpdateTrainingExerciseResponseDto>(
            "update-training-exercise",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 今日会话相关方法
    async createTodaySession(reqData: CreateTodaySessionDto) {
        const res = await this.post<CreateTodaySessionResponseDto>(
            "create-today-session",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    // 学生评论相关方法
    async getStudentComments(reqData: GetStudentCommentDto) {
        const res = await this.post<GetStudentCommentResponseDto>(
            "get-student-comment",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async createStudentComment(reqData: CreateStudentCommentDto) {
        const res = await this.post<CreateStudentCommentResponseDto>(
            "create-student-comment",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async updateStudentComment(reqData: UpdateStudentCommentDto) {
        const res = await this.post<UpdateStudentCommentResponseDto>(
            "update-student-comment",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    async deleteStudentComment(reqData: DeleteStudentCommentDto) {
        const res = await this.post<DeleteStudentCommentResponseDto>(
            "delete-student-comment",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }

    /**
     * @description 获取所有用户，支持分页和昵称模糊搜索
     * @param reqData
     * @returns
     */
    async getAllUsers(reqData: GetAllUsersDto) {
        const res = await this.post<GetAllUsersResponseDto>(
            "get-all-users",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data;
        }

        return null;
    }
}

export const userService = new UserPlanService("/api/user");
export type { LifestyleLogPayload, PlanDetailItem, WorkoutLogPayload };
