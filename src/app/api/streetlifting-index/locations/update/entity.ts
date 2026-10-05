import type { StreetliftingLocation } from "../list/entity";
import type { LocationEquipmentType } from '@coachlink/core';

export interface StreetliftingUpdateLocationDto {
    id: string;
    equipment_types?: LocationEquipmentType[] | null;
    country?: string | null;
    coordinate_system?: 'wgs84' | 'gcj02' | null;
    name?: string;
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

export interface StreetliftingUpdateLocationResponseDto {
    location: StreetliftingLocation;
}
