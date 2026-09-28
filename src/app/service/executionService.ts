// Service for training execution APIs

import { BaseService } from "@/lib/baseService";
import type {
    AddSetVideoLinkDto,
    AddSetVideoLinkResponseDto,
} from "../api/execution/add-set-video-link/entity";
import type {
    CalculateE1RMDto,
    CalculateE1RMResponseDto,
} from "../api/execution/calculate-e1rm/entity";
import type {
    CheckTodayDto,
    CheckTodayResponseDto,
} from "../api/execution/check-today/entity";
import type {
    CompleteItemDto,
    CompleteItemResponseDto,
} from "../api/execution/complete-item/entity";
import type {
    CompleteSetDto,
    CompleteSetResponseDto,
} from "../api/execution/complete-set/entity";
import type {
    CreatePRDto,
    CreatePRResponseDto,
} from "../api/execution/create-pr/entity";
import type {
    DeletePRRecordDto,
    DeletePRRecordResponseDto,
} from "../api/execution/delete-pr-record/entity";
import type {
    FinishTrainingDto,
    FinishTrainingResponseDto,
} from "../api/execution/finish/entity";
import type {
    GetExecutionDto,
    GetExecutionResponseDto,
} from "../api/execution/get/entity";
import type {
    GetNextTrainingDayDto,
    GetNextTrainingDayResponseDto,
} from "../api/execution/get-next-training-day/entity";
import type {
    GetPRRecordsDto,
    GetPRRecordsResponseDto,
} from "../api/execution/get-pr-records/entity";
import type {
    ShareCardInfoDto,
    ShareCardInfoResponseDto,
} from "../api/execution/share-card-info/entity";
import type {
    ShareInfoDto,
    ShareInfoResponseDto,
} from "../api/execution/share-info/entity";
import type {
    StartExecutionDto,
    StartExecutionResponseDto,
} from "../api/execution/start/entity";
import type {
    SubmitFeedbackDto,
    SubmitFeedbackResponseDto,
} from "../api/execution/submit-feedback/entity";
import type { UploadSetVideoResponseDto } from "../api/execution/upload-set-video/entity";
import type {
    AddExtraExerciseDto,
    AddExtraExerciseResponseDto,
    DeleteExtraExerciseDto,
    DeleteExtraExerciseResponseDto,
} from "../api/execution/extra-content/entity";

class ExecutionService extends BaseService {
    async recordCompletion(input: import('@coachlink/core/src/completionDate').RecordPlanCompletionInput) {
        const res = await this.post<any>('record-completion', input);
        if (!res.data?.success || !res.data.data) throw new Error(res.data?.message || '补记失败');
        return res.data.data;
    }

    /**
     * 开始或恢复训练
     */
    async startExecution(reqData: StartExecutionDto) {
        const res = await this.post<StartExecutionResponseDto>(
            "start",
            reqData,
        );
        if (res.data) {
            return res.data;
        }
        return { success: false, data: null, message: "请求失败" };
    }

    /**
     * 完成一组
     */
    async completeSet(reqData: CompleteSetDto) {
        const res = await this.post<CompleteSetResponseDto>(
            "complete-set",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 完成非力量项目（饮食/有氧/习惯）
     */
    async completeItem(reqData: CompleteItemDto) {
        const res = await this.post<CompleteItemResponseDto>(
            "complete-item",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 完成训练
     */
    async finishTraining(reqData: FinishTrainingDto) {
        const res = await this.post<FinishTrainingResponseDto>(
            "finish",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 添加额外动作/轻任务
     */
    async addExtraExercise(reqData: AddExtraExerciseDto) {
        const res = await this.post<AddExtraExerciseResponseDto>(
            "extra-content/add-extra-exercise",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 删除学员追加的动作/轻任务
     */
    async deleteExtraExercise(reqData: DeleteExtraExerciseDto) {
        const res = await this.post<DeleteExtraExerciseResponseDto>(
            "extra-content/delete-extra-exercise",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 上传组视频
     */
    async uploadSetVideo(
        file: File,
        executionId: string,
        actionId: string,
        setNumber: number,
    ) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("executionId", executionId);
        formData.append("actionId", actionId);
        formData.append("setNumber", setNumber.toString());

        const res = await this.post<UploadSetVideoResponseDto>(
            "upload-set-video",
            formData,
        );

        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 直接粘贴视频链接（不占用平台存储）
     */
    async addSetVideoLink(reqData: AddSetVideoLinkDto) {
        const res = await this.post<AddSetVideoLinkResponseDto>(
            "add-set-video-link",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 创建PR记录
     */
    async createPR(reqData: CreatePRDto) {
        const res = await this.post<CreatePRResponseDto>("create-pr", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 删除PR记录
     */
    async deletePRRecord(reqData: DeletePRRecordDto) {
        const res = await this.post<DeletePRRecordResponseDto>(
            "delete-pr-record",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 获取执行记录
     */
    async getExecution(reqData: GetExecutionDto) {
        const res = await this.post<GetExecutionResponseDto>("get", reqData);
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 获取分享卡片数据
     */
    async getShareInfo(reqData: ShareInfoDto) {
        const res = await this.post<ShareInfoResponseDto>(
            "share-info",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 获取分享卡片信息（share-card-info）
     */
    async getShareCardInfo(reqData: ShareCardInfoDto) {
        const res = await this.post<ShareCardInfoResponseDto>(
            "share-card-info",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 检查今天是否有执行记录
     */
    async checkToday(reqData: CheckTodayDto) {
        const res = await this.post<CheckTodayResponseDto>(
            "check-today",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 获取下一个训练日
     */
    async getNextTrainingDay(reqData: GetNextTrainingDayDto) {
        const res = await this.post<GetNextTrainingDayResponseDto>(
            "get-next-training-day",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 获取PR记录
     */
    async getPRRecords(reqData: GetPRRecordsDto) {
        const res = await this.post<GetPRRecordsResponseDto>(
            "get-pr-records",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 提交训练反馈（给教练）
     */
    async submitFeedback(reqData: SubmitFeedbackDto) {
        const res = await this.post<SubmitFeedbackResponseDto>(
            "submit-feedback",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }

    /**
     * 计算e1RM
     */
    async calculateE1RM(reqData: CalculateE1RMDto) {
        const res = await this.post<CalculateE1RMResponseDto>(
            "calculate-e1rm",
            reqData,
        );
        if (res.data && res.data.success) {
            return res.data.data || null;
        }
        return null;
    }
}

export const executionService = new ExecutionService("/api/execution");
