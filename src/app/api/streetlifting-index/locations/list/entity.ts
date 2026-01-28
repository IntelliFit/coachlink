export interface StreetliftingLocation {
    id: string;
    name: string;
    description: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    image_url: string | null;
    image_urls: string[] | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    user_contact: string | null;
}

export interface StreetliftingListLocationsDto {}

export interface StreetliftingListLocationsResponseDto {
    locations: StreetliftingLocation[];
}
