import { ExecutionSetVideoRow, PlanInstanceExecutionRow } from '@/types';
import type { ReviewStatus } from '@/types/coach';

export type GetExecutionSetVideosDto = {
    pagination?: {
        page: number;
        limit: number;
    };
    reviewStatus?: ReviewStatus;
};

// 扩展的视频行类型，包含关联数据
export type ExecutionSetVideoWithDetails = ExecutionSetVideoRow & {
    // 学员信息
    student_name?: string;
    student_id?: string;
    // 从数据库迁移的字段
    exercise_name?: string | null;
    user_notes?: string | null;
    review_status?: 'pending' | 'reviewed' | 'not_required';
    requires_review?: boolean;
    // 执行详情（从 plan_instance_executions.action_executions 中提取）
    execution_details?: {
        completed_at?: string | null;
        planned_reps?: number;
        planned_weight?: number;
        actual_reps?: number;
        actual_weight?: number;
        rpe?: number;
        rest_seconds?: number;
    };
    // 元数据
    metadata?: {
        student_name?: string;
        day_index?: number;
        instance_id?: string;
    };
};

export type GetExecutionSetVideosResponseDto = {
    videos: ExecutionSetVideoWithDetails[];
    total: number;
};

