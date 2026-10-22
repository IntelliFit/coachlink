import type { CoachOnboardingProgress } from "@/lib/coachOnboardingProgress";

export interface ListCoachOnboardingDto {
}

export interface CoachOnboardingRow {
    coachId: string;
    userId: string | null;
    name: string;
    nickname: string | null;
    coachTrack: string | null;
    status: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    approvedAt: string | null;
    activeStudentCount: number;
    progress: CoachOnboardingProgress;
}

export interface ListCoachOnboardingResponseDto {
    coaches: CoachOnboardingRow[];
}
