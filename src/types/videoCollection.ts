export type VideoCollectionSource =
    | 'progress_set'
    | 'plan_execution'
    | 'manual'
    | 'external_url'
    | 'training_video';

export interface StudentVideoCollection {
    id: string;
    user_id: string;
    training_video_id?: string | null;
    execution_set_video_id?: string | null;
    source: VideoCollectionSource;
    title?: string | null;
    description: string;
    tags: string[];
    is_featured: boolean;
    video_url?: string | null;
    thumbnail_url?: string | null;
    storage_path?: string | null;
    storage_bucket?: string | null;
    duration_seconds?: number | null;
    file_size?: number | null;
    processing_status?: string | null;
    created_at: string;
    updated_at: string;
    deleted_at?: string | null;
}

