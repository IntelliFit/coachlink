import type { StreetliftingLocation } from "../list/entity";

export interface StreetliftingGetLocationDto {
  id: string;
}

export interface StreetliftingGetLocationResponseDto {
  location: StreetliftingLocation | null;
}
