import type { CoachContentColumnRow } from '@/types';

export type ContentColumnDto = {
    id?: string;
    name: string;
    description?: string | null;
    cover_url?: string | null;
    slug?: string | null;
    sort_order?: number;
    is_visible?: boolean;
};

export type ContentColumnsResponseDto = {
    columns: CoachContentColumnRow[];
};

export type ContentColumnResponseDto = {
    column: CoachContentColumnRow;
};
