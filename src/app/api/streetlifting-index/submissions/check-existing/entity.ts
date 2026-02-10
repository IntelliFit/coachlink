export interface StreetliftingCheckExistingResponseDto {
    hasExisting: boolean;
    existingSubmission?: {
        id: string;
        created_at: string;
        exercise_type: string;
        bodyweight: number;
        added_weight: number;
        reps: number;
    } | null;
}
