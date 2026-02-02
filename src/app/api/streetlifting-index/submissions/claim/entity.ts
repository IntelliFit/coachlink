import type { StreetliftingSubmission } from "../list/entity";

export interface StreetliftingClaimSubmissionDto {
    submission_id: string;
}

export interface StreetliftingClaimSubmissionResponseDto {
    submission: StreetliftingSubmission;
}
