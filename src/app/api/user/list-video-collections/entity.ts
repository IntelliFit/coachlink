import type { StudentVideoCollection } from '@/types/videoCollection';

export interface ListVideoCollectionsDto {
    filters?: {
        source?: string;
        isFeatured?: boolean;
        search?: string;
        tags?: string[];
    };
    pagination?: { page: number; limit: number };
}

export interface ListVideoCollectionsResponseDto {
    collections: StudentVideoCollection[];
    total: number;
}

