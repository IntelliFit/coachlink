import { UserProfilesRow, UsersRow } from "@/types";

export interface PRRecord {
    id: string;
    exercise_name: string;
    // 与 /api/execution/get-pr-records 返回保持一致
    weight: number;
    reps: number;
    e1rm?: number;
    load_formula: string;
    date_achieved: string;
    notes?: string;
    video_url?: string;
    action_id?: string;
    execution_id?: string;
    created_at: string;
}

export interface TimelineItem {
    id: string;
    date: string;
    title: string;
    description: string;
    type: "pr" | "milestone" | "video";
    videoUrl?: string;
    load_formula?: string;
    stats?: {
        weight: number;
        reps: number;
        rpe?: number;
    };
}

export interface ProfileData {
    user: UsersRow;
    profile: UserProfilesRow | null;
    stats: {
        subscriptionCount: number;
        activePlanCount: number;
        completedWorkouts: number;
        totalTrainingTime: number; // in minutes
    };
    subscriptionLevel: "basic" | "advanced" | "premium";
    coachApplicationStatus:
        | "none"
        | "draft"
        | "pending"
        | "reviewing"
        | "needs_info"
        | "rejected"
        | "approved"
        | "coach";
    coachRejectionReason?: string;
    progressData: {
        dates: string[];
        weight: number[];
        benchPress: number[];
        squat: number[];
        deadlift: number[];
    };
    timelineData: TimelineItem[];
    coachesData: {
        id: string;
        name: string;
        avatarUrl: string | null;
        title: string | null;
        subscriptionStatus: string;
        subscriptionTier: number;
        subscriptionEndDate: string;
    }[];
    notesData: {
        id: string;
        coachId: string;
        coachName: string;
        coachAvatar: string | null;
        date: string;
        content: string;
        tags: string[];
    }[];
}

export interface ProfileHeaderProps {
    data: ProfileData;
}
