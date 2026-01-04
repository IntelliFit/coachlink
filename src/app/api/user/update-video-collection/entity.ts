import type { StudentVideoCollection } from '@/types/videoCollection';

export interface UpdateVideoCollectionDto {
    id: string;
    title?: string | null;
    description?: string;
    tags?: string[];
    isFeatured?: boolean;
}

export interface UpdateVideoCollectionResponseDto {
    collection: StudentVideoCollection;
}

