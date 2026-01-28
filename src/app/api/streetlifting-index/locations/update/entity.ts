import type { StreetliftingLocation } from "../list/entity";

export interface StreetliftingUpdateLocationDto {
    id: string;
    name?: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    image_urls?: string[] | null;
    user_contact?: string | null;
}

export interface StreetliftingUpdateLocationResponseDto {
    location: StreetliftingLocation;
}
