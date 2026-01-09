// Service for training execution APIs

import type {
    CompleteItemDto,
    CompleteSetDto,
    CompleteSetResponseDto,
    CreatePRDto,
    CreatePRResponseDto,
    FinishTrainingDto,
    FinishTrainingResponseDto,
    GetExecutionResponseDto,
    ShareInfoResponseDto,
    StartExecutionDto,
    StartExecutionResponseDto,
} from "../api/execution/entity";

class ExecutionService {
    /**
     * 开始或恢复训练
     */
    async startExecution(
        dto: StartExecutionDto,
    ): Promise<StartExecutionResponseDto> {
        const response = await fetch("/api/execution/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto),
        });
        return response.json();
    }

    /**
     * 完成一组
     */
    async completeSet(dto: CompleteSetDto): Promise<CompleteSetResponseDto> {
        const response = await fetch("/api/execution/complete-set", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto),
        });
        return response.json();
    }

    /**
     * 完成非力量项目（饮食/有氧/习惯）
     */
    async completeItem(dto: CompleteItemDto): Promise<CompleteSetResponseDto> {
        const response = await fetch("/api/execution/complete-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto),
        });
        return response.json();
    }

    /**
     * 完成训练
     */
    async finishTraining(
        dto: FinishTrainingDto,
    ): Promise<FinishTrainingResponseDto> {
        const response = await fetch("/api/execution/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto),
        });
        return response.json();
    }

    /**
     * 上传组视频
     */
    async uploadSetVideo(
        file: File,
        executionId: string,
        actionId: string,
        setNumber: number,
    ): Promise<any> {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("executionId", executionId);
        formData.append("actionId", actionId);
        formData.append("setNumber", setNumber.toString());

        const response = await fetch("/api/execution/upload-set-video", {
            method: "POST",
            body: formData,
        });

        // 避免服务端返回 HTML 时前端 JSON.parse 报错
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch {
            return {
                success: false,
                message: response.ok
                    ? "视频上传返回异常"
                    : `上传失败(${response.status})`,
                raw: text,
            };
        }
    }

    /**
     * 创建PR记录
     */
    async createPR(dto: CreatePRDto): Promise<CreatePRResponseDto> {
        const response = await fetch("/api/execution/create-pr", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dto),
        });
        return response.json();
    }

    /**
     * 获取执行记录
     */
    async getExecution(executionId: string): Promise<GetExecutionResponseDto> {
        const response = await fetch(`/api/execution/get?id=${executionId}`);
        return response.json();
    }

    /**
     * 获取分享卡片数据
     */
    async getShareInfo(
        executionId: string,
    ): Promise<ShareInfoResponseDto> {
        const response = await fetch(
            `/api/execution/share-info?id=${executionId}`,
        );
        return response.json();
    }
}

export const executionService = new ExecutionService();
