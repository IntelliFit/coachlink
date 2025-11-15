import { Database } from "@/types/database.types";

export interface UpdateProileDto {
    full_name: string | null;
    nickname: string | null;
    phone: string | null;
    address: string | null;
    gender: string | null;
    birth_date: string | null;
    height: number | null;
    weight: number | null;
    fitness_goal: string | null;
    fitness_level: string | null;
    bio: string | null;
}

export type UpdateProfileResponseDto = Database['public']['Tables']['user_profiles']['Insert'];