// 提交入职问卷请求和响应的类型定义

export interface SubmitOnboardingDto {
    userId: string;
    coachId?: string;
    answers: Record<string, any>;
    baseline_video_urls?: string[];
}

export type SubmitOnboardingResponseDto = any;