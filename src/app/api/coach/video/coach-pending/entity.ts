import { TrainingVideoRow } from '@/types';
import type { ReviewStatus } from '@/types/coach';

export type GetPendingReviewVideosDto = {
    pagination?: {
        page: number;
        limit: number;
    };
    reviewStatus?: ReviewStatus;
};

export type GetPendingReviewVideosResponseDto = {
    videos: TrainingVideoRow[];
    total: number;
};
