import { UserProfilesRow, UsersRow } from "@/types";

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
    timelineData: {
        id: string;
        date: string;
        title: string;
        description: string;
        type: "pr" | "milestone" | "video";
        videoUrl?: string;
        stats?: {
            weight: number;
            reps: number;
            rpe: number;
        };
    }[];
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
