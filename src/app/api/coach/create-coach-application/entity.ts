import { CoachApplicationRow } from "@/types";

export interface CredentialItem {
    name: string;
    url?: string;
}

export interface SocialLink {
    name: string;
    url?: string;
}

// 请求参数的接口类型
export interface CreateCoachApplicationDto {
    name: string;
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
}

// 返回参数的接口类型
export interface CreateCoachApplicationResponseDto {
    application: CoachApplicationRow;
}