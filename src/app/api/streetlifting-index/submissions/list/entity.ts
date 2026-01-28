export interface StreetliftingListSubmissionsDto {
    limit?: number;
    order?: "asc" | "desc";
    sort_by?: "created_at" | "added_weight" | "bodyweight";
}

export interface StreetliftingSubmission {
    id: string;
    created_at: string;
    user_id: string | null;
    gender: "Male" | "Female";
    bodyweight: number;
    added_weight: number;
    reps: number;
    form_quality: "Competition" | "Minor_Cheat" | "Major_Cheat" | "Extreme_Cheat";
    penalty_weight: number;
    user_name: string | null;
    video_url: string | null;
    pullup_type: "Overhand" | "Underhand" | null;
    exercise_type: "weighted_pullup" | "weighted_dips";
}

export interface StreetliftingListSubmissionsResponseDto {
    submissions: StreetliftingSubmission[];
}
