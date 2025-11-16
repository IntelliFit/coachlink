import { BaseService } from "@/lib/baseService";
import type { UpdateProfileResponseDto, UpdateProileDto } from "../api/user/update-profile/entity";
import type { GetTrainingPlansDto, GetTrainingPlansResponseDto } from "../api/user/get-training-plans/entity";
import type { GetTrainingPlansDetailDto, GetTrainingPlansDetailResponseDto } from "../api/user/get-training-detail/entity";
// 导入训练提醒相关的类型定义
import type { GetTrainingRemindersDto, GetTrainingRemindersResponseDto } from "../api/user/get-training-reminders/entity";
import type { CreateTrainingReminderDto, CreateTrainingReminderResponseDto } from "../api/user/create-training-reminder/entity";
import type { UpdateTrainingReminderDto, UpdateTrainingReminderResponseDto } from "../api/user/update-training-reminder/entity";
import type { DeleteTrainingReminderDto, DeleteTrainingReminderResponseDto } from "../api/user/delete-training-reminder/entity";
// 导入训练进度相关的类型定义
import type { GetTrainingProgressDto, GetTrainingProgressResponseDto } from "../api/user/get-training-progress/entity";
import type { GetPersonalRecordsDto, GetPersonalRecordsResponseDto } from "../api/user/get-personal-records/entity";
import type { GetWeeklyProgressDto, GetWeeklyProgressResponseDto } from "../api/user/get-weekly-progress/entity";
// 导入学生服务相关的类型定义
import type { SubmitOnboardingDto, SubmitOnboardingResponseDto } from "../api/user/submit-onboarding/entity";
import type { GetStudentProfileDto, GetStudentProfileResponseDto } from "../api/user/get-student-profile/entity";
import type { UpsertTrainingPlanDetailsDto, UpsertTrainingPlanDetailsResponseDto, PlanDetailItem } from "../api/user/upsert-training-plan-details/entity";
import type { SubmitWorkoutLogDto, SubmitWorkoutLogResponseDto, WorkoutLogPayload } from "../api/user/submit-workout-log/entity";
import type { SubmitLifestyleLogDto, SubmitLifestyleLogResponseDto, LifestyleLogPayload } from "../api/user/submit-lifestyle-log/entity";
// 导入个人记录相关的类型定义
import type { UpdatePersonalRecordsDto, UpdatePersonalRecordsResponseDto } from "../api/user/update-personal-records/entity";


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
    }
    
    // 训练提醒相关方法
    async getTrainingReminders(reqData: GetTrainingRemindersDto) {
        const res = await this.post<GetTrainingRemindersResponseDto>('get-training-reminders', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async createTrainingReminder(reqData: CreateTrainingReminderDto) {
        const res = await this.post<CreateTrainingReminderResponseDto>('create-training-reminder', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async updateTrainingReminder(reqData: UpdateTrainingReminderDto) {
        const res = await this.post<UpdateTrainingReminderResponseDto>('update-training-reminder', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async deleteTrainingReminder(reqData: DeleteTrainingReminderDto) {
        const res = await this.post<DeleteTrainingReminderResponseDto>('delete-training-reminder', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 训练进度相关方法
    async getTrainingProgress(reqData: GetTrainingProgressDto) {
        const res = await this.post<GetTrainingProgressResponseDto>('get-training-progress', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async getPersonalRecords(reqData: GetPersonalRecordsDto) {
        const res = await this.post<GetPersonalRecordsResponseDto>('get-personal-records', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async getWeeklyProgress(reqData: GetWeeklyProgressDto) {
        const res = await this.post<GetWeeklyProgressResponseDto>('get-weekly-progress', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 学生服务相关方法
    async submitOnboarding(reqData: SubmitOnboardingDto) {
        const res = await this.post<SubmitOnboardingResponseDto>('submit-onboarding', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async getStudentProfile(reqData: GetStudentProfileDto) {
        const res = await this.post<GetStudentProfileResponseDto>('get-student-profile', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async upsertTrainingPlanDetails(reqData: UpsertTrainingPlanDetailsDto) {
        const res = await this.post<UpsertTrainingPlanDetailsResponseDto>('upsert-training-plan-details', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async submitWorkoutLog(reqData: SubmitWorkoutLogDto) {
        const res = await this.post<SubmitWorkoutLogResponseDto>('submit-workout-log', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    async submitLifestyleLog(reqData: SubmitLifestyleLogDto) {
        const res = await this.post<SubmitLifestyleLogResponseDto>('submit-lifestyle-log', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
    
    // 个人记录相关方法
    async updatePersonalRecords(reqData: UpdatePersonalRecordsDto) {
        const res = await this.post<UpdatePersonalRecordsResponseDto>('update-personal-records', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        
        return null;
    }
}

export const userService = new UserPlanService('/api/user');
export type { 
    PlanDetailItem,
    WorkoutLogPayload,
    LifestyleLogPayload
};