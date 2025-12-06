// Service for training execution APIs

import type {
    CompleteSetDto,
    CompleteSetResponseDto,
    CreatePRDto,
    CreatePRResponseDto,
    FinishTrainingDto,
    FinishTrainingResponseDto,
    GetExecutionResponseDto,
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
        return response.json();
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
}

export const executionService = new ExecutionService();
