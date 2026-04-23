export type PublishContentDto = {
    userId?: string | null;
    coachId: string;
    title: string;
    content: string;
    content_type: 'text' | 'video' | 'image' | 'live' | 'plan';
    required_tier: 0 | 1 | 2 | 3;
    /**
     * 单篇价格（分）。0 表示免费（无需单篇支付）。
     */
    price_cents?: number;
    /**
     * 所属专栏。null 表示闲散文章。
     */
    column_id?: string | null;
    column_sort_order?: number | null;
    is_featured?: boolean;
    tags?: string[];
    media_urls?: string[];
    thumbnail_url?: string | null;
    isDraft?: boolean;
    /**
     * 是否通知全体学员
     */
    notifyAllStudents?: boolean;
};

export type PublishContentResponseDto = {
    id: string;
    coach_id: string;
    title: string;
    content: string;
    content_type: string;
    required_tier: number;
    price_cents: number;
    column_id: string | null;
    column_sort_order: number | null;
    is_featured: boolean;
    tags: string[];
    media_urls: string[];
    thumbnail_url: string | null;
    created_at: string;
    updated_at: string;
};
