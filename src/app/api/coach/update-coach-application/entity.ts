import { CoachApplicationRow } from "@/types";

// 请求参数的接口类型
export interface UpdateCoachApplicationDto {
    id: string;
    // 用户可以更新的字段（除了状态和审核相关信息）
    name?: string;
    title?: string | null;
    avatarUrl?: string | null;
    specialties?: string[] | null;
    bio?: string | null;
    yearsExperience?: number | null;
    achievements?: string[] | null;
    teachingPhilosophy?: string | null;
    credentials?: object[] | null;
    caseStudies?: string[] | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    resumeUrl?: string | null;
    portfolioUrl?: string | null;
    socialLinks?: object | null;

    // 管理员可以更新的字段
    status?: string;
    reviewNotes?: string | null;
    reviewedAt?: string | null;
    reviewedBy?: string | null;
}

// 返回参数的接口类型
export interface UpdateCoachApplicationResponseDto {
    application: CoachApplicationRow;
}