import type { StreetliftingSubmission } from "../list/entity";

export interface StreetliftingCreateSubmissionDto {
    gender: "Male" | "Female";
    bodyweight: number;
    added_weight: number;
    reps: number;
    form_quality: "Competition" | "Minor_Cheat" | "Major_Cheat" | "Extreme_Cheat";
    penalty_weight?: number;
    user_name?: string | null;
    video_url?: string | null;
    pullup_type?: "Overhand" | "Underhand" | null;
    exercise_type?: "weighted_pullup" | "weighted_dips";
}

export interface StreetliftingCreateSubmissionResponseDto {
    submission: StreetliftingSubmission;
}
