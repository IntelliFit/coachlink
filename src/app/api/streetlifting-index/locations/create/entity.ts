import type { StreetliftingLocation } from "../list/entity";

export interface StreetliftingCreateLocationDto {
    name: string;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    county?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    image_urls?: string[] | null;
    user_contact?: string | null;
}

export interface StreetliftingCreateLocationResponseDto {
    location: StreetliftingLocation;
}
