import type { StudentVideoCollection } from '@/types/videoCollection';

export interface AddVideoToCollectionDto {
    trainingVideoId?: string;
    executionSetVideoId?: string;
    title?: string;
    description: string;
    tags?: string[];
    isFeatured?: boolean;
}

export interface AddVideoToCollectionResponseDto {
    collection: StudentVideoCollection;
}

