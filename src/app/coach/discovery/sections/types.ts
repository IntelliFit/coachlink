import type { CoachesRow } from '@/types';
import type { Product, DurationOption } from '@/app/api/coach/get-pricing/entity';

export type DiscoveryCoach = CoachesRow & {
    studentCount?: number;
    averageRating?: number;
    coach_track?: string | null;
};

export interface ProductFeedItem {
    coach: CoachesRow;
    product: Product;
    opt: DurationOption;
}

export interface PublicArticleListItem {
    id: string;
    coachId: string;
    coachName: string;
    coachAvatarUrl: string | null;
    title: string;
    summary: string;
    contentType: string;
    requiredTier: number;
    priceCents: number;
    publishedAt: string | null;
}

export const TIER_LABELS: Record<string, string> = {
    basic: 'L1 基础版',
    standard: 'L2 进阶版',
    premium: 'L3 专业版',
};

export function tierLabel(tier: string | null | undefined): string {
    return TIER_LABELS[tier || ''] || 'L3 专业版';
}
