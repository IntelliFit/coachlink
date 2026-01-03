import { ItemType } from "./student";

export type VideoType = "baseline" | "training" | "completion";
export type ReviewStatus = "pending" | "reviewed" | "not_required";
export type ProcessingStatus = "uploading" | "processing" | "ready" | "failed";

// 教练动作库类型
export interface CoachActionRow {
    id: string;
    coach_id: string;
    name: string;
    detail: string | null;
    positions: string[] | null;
    attrs: string[] | null;
    url: string | null;
    type?: ItemType; // 项目类型，可选（迁移前默认为 STRENGTH）
    enableAutoWeightCompute: boolean;
    includesBodyWeight: boolean;
    created_at: string;
    updated_at: string;
}

export interface CoachActionInsert {
    name: string;
    detail?: string | null;
    positions?: string[] | null;
    attrs?: string[] | null;
    url?: string | null;
    type?: ItemType;
    enableAutoWeightCompute?: boolean;
    includesBodyWeight?: boolean;
}

export interface CoachStudentItem {
    id: string; // subscription id
    student_id: string;
    tier: number;
    status: string;
    start_date: string | null;
    end_date: string | null;
    updated_at: string | null;
    student?: { id: string; phone?: string; last_login_at?: string | null };
    profile?: { nickname?: string | null; avatar_url?: string | null };
}

export interface Coach {
    id: string;
    name: string;
    title: string;
    rating: number;
}

export interface Student {
    id: string;
    name: string;
    email?: string;
    subscription_tier: number;
    subscription_start: string | null;
    subscription_end: string | null;
    total_videos: number;
    pending_videos: number;
    avatar_url?: string;
    last_active?: string;
    progress_score: number;
}

export interface PendingVideo {
    id: string;
    student_id: string;
    student_name: string;
    title: string;
    description: string;
    exercise_type: string;
    duration: number;
    upload_date: string;
    video_url: string;
    thumbnail_url: string;
    file_size: string;
}

export interface VideoReview {
    id: string;
    video_id: string;
    rating: number;
    technical_score: number;
    form_score: number;
    progress_score: number;
    written_feedback: string;
    audio_feedback?: string;
    reviewed_at: string;
}

export interface CoachDashboardProps {
    coach: Coach;
    onBack: () => void;
}

export interface VideoUploadContext {
    type: VideoType;
    training_plan_id?: string;
    training_session_id?: string;
    exercise_name?: string;
    week_number?: number;
    day_of_week?: string;
    requires_review?: boolean;
    user_notes?: string;
    coach_id?: string; // 新增：指定教练ID
}

export enum ContentTier {
    FREE = 0,
    BASIC = 1,
    PREMIUM = 2,
    VIP = 3,
}
