import { BaseService } from "@/lib/baseService";
import type { SubmitFeedbackDto, SubmitFeedbackResponseDto } from "../api/feedback/submit/entity";

class FeedbackService extends BaseService {
    /**
     * 提交反馈
     */
    async submitFeedback(reqData: SubmitFeedbackDto): Promise<SubmitFeedbackResponseDto | null> {
        try {
            const res = await this.post<SubmitFeedbackResponseDto>('feedback/submit', reqData);
            if (res.data && res.data.success) {
                return res.data.data || null;
            }
            return {
                success: false,
                message: res.data?.message || '提交失败'
            };
        } catch (error: any) {
            console.error('提交反馈失败:', error);
            return {
                success: false,
                message: error.response?.data?.message || error.message || '网络错误'
            };
        }
    }
}

export const feedbackService = new FeedbackService('/api');
