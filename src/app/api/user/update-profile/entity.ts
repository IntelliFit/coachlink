import { Database } from "@/types/database.types";
import { SportCards } from "@/types/sportCards";

// Re-export SportCards for convenience
export type { SportCards } from "@/types/sportCards";

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
