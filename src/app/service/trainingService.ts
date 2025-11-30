import { BaseService } from "@/lib/baseService";
import type { GetTrainingRecordDto, GetTrainingRecordResponseDto } from "@/app/api/training/get-record/entity";
import type { SaveTrainingRecordDto, SaveTrainingRecordResponseDto } from "@/app/api/training/save-record/entity";
import type { FinishTrainingDto, FinishTrainingResponseDto } from "@/app/api/training/finish-training/entity";
import type { AbandonTrainingDto, AbandonTrainingResponseDto } from "@/app/api/training/abandon-training/entity";
import type { GetHubDataDto, GetHubDataResponseDto } from "@/app/api/training/get-hub-data/entity";
import type { GetWeekDaysDto, GetWeekDaysResponseDto } from "@/app/api/training/get-week-days/entity";
import type { GetPlanPreviewDto, GetPlanPreviewResponseDto } from "@/app/api/training/get-plan-preview/entity";
import type { GetBreakthroughsDto, GetBreakthroughsResponseDto } from "@/app/api/training/get-breakthroughs/entity";
import type { GetTrainingDayDateDto, GetTrainingDayDateResponseDto } from "@/app/api/training/get-training-day-date/entity";
import type { GetProgressStatsDto, GetProgressStatsResponseDto } from "@/app/api/training/get-progress-stats/entity";
import type { GetWeeklyProgressDto, GetWeeklyProgressResponseDto } from "@/app/api/training/get-weekly-progress/entity";
import type { UploadSetVideoDto, UploadSetVideoResponseDto } from "@/app/api/training/upload-set-video/entity";
import type { GetSetVideosDto, GetSetVideosResponseDto } from "@/app/api/training/get-set-videos/entity";
import type { DeleteSetVideoDto, DeleteSetVideoResponseDto } from "@/app/api/training/delete-set-video/entity";
import type { GetWeekRecordsDto, GetWeekRecordsResponseDto } from "@/app/api/training/get-week-records/entity";

class TrainingService extends BaseService {
    async getTrainingRecord(reqData: GetTrainingRecordDto) {
        const res = await this.post<GetTrainingRecordResponseDto>('get-record', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async saveTrainingRecord(reqData: SaveTrainingRecordDto) {
        const res = await this.post<SaveTrainingRecordResponseDto>('save-record', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async finishTraining(reqData: FinishTrainingDto) {
        const res = await this.post<FinishTrainingResponseDto>('finish-training', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async abandonTraining(reqData: AbandonTrainingDto) {
        const res = await this.post<AbandonTrainingResponseDto>('abandon-training', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getHubData(reqData: GetHubDataDto) {
        const res = await this.post<GetHubDataResponseDto>('get-hub-data', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getWeekDays(reqData: GetWeekDaysDto) {
        const res = await this.post<GetWeekDaysResponseDto>('get-week-days', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getPlanPreview(reqData: GetPlanPreviewDto) {
        const res = await this.post<GetPlanPreviewResponseDto>('get-plan-preview', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getBreakthroughs(reqData: GetBreakthroughsDto) {
        const res = await this.post<GetBreakthroughsResponseDto>('get-breakthroughs', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getTrainingDayDate(reqData: GetTrainingDayDateDto) {
        const res = await this.post<GetTrainingDayDateResponseDto>('get-training-day-date', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }

    async getProgressStats(reqData: GetProgressStatsDto) {
        const res = await this.post<GetProgressStatsResponseDto>('get-progress-stats', reqData);
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

    /**
     * 上传组视频
     */
    async uploadSetVideo(reqData: UploadSetVideoDto) {
        const res = await this.post<UploadSetVideoResponseDto>('upload-set-video', reqData);
        if (res.data && 'success' in res.data && res.data.success && res.data.data) {
            return res.data.data;
        }
        return null;
    }

    /**
     * 获取训练记录的所有组视频
     */
    async getSetVideos(reqData: GetSetVideosDto) {
        const res = await this.post<GetSetVideosResponseDto>('get-set-videos', reqData);
        if (res.data && 'success' in res.data && res.data.success && res.data.data) {
            return res.data.data;
        }
        return null;
    }

    /**
     * 删除组视频
     */
    async deleteSetVideo(reqData: DeleteSetVideoDto) {
        const res = await this.post<DeleteSetVideoResponseDto>('delete-set-video', reqData);
        if (res.data && res.data.success) {
            return true;
        }
        return false;
    }

    /**
     * 获取某周的训练记录
     */
    async getWeekRecords(reqData: GetWeekRecordsDto) {
        const res = await this.post<GetWeekRecordsResponseDto>('get-week-records', reqData);
        if (res.data && res.data.success) {
            return res.data.data;
        }
        return null;
    }
}

export const trainingService = new TrainingService('/api/training');

