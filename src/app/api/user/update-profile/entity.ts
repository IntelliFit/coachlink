import { Database } from "@/types/database.types";

// 运动数据卡片类型定义
export interface SportCards {
    activeCards: string[];
    powerlifting?: {
        squat: number | null;
        bench: number | null;
        deadlift: number | null;
    };
    bodybuilding?: {
        chest: number | null;
        arm: number | null;
        waist: number | null;
        hip: number | null;
        bodyfat: number | null;
    };
    fitness?: {
        pullups: number | null;
        pushups: number | null;
        plank: number | null;
        restingHR: number | null;
    };
}

export interface UpdateProileDto {
    full_name?: string | null;
    nickname?: string | null;
    phone?: string | null;
    avatar_url?: string | null;
    address?: string | null;
    gender?: string | null;
    birth_date?: string | null;
    height?: number | null;
    weight?: number | null;
    fitness_goal?: string | null;
    fitness_level?: string | null;
    bio?: string | null;
    // 新增字段
    age?: number | null;
    lifestyle?: string | null;
    sport_cards?: SportCards | null;
    onboarding_completed?: boolean;
}

export type UpdateProfileResponseDto =
    Database["public"]["Tables"]["user_profiles"]["Insert"];
