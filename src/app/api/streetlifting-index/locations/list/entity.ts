export interface StreetliftingLocation {
    id: string;
    country?: string | null;
    coordinate_system?: 'wgs84' | 'gcj02' | null;
    name: string;
    description: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    county: string | null;
    image_url: string | null;
    image_urls: string[] | null;
    latitude: number | null;
    longitude: number | null;
    created_at: string;
    user_contact: string | null;
    contributor_user_id?: string | null;
    contributor_name_snapshot?: string | null;
}

export interface StreetliftingListLocationsDto {
    page?: number; // 1-based
    limit?: number; // max 30
    search?: string;
    country?: string;
    province?: string; // 'all' means no filter
    city?: string;
    county?: string;
}

export interface StreetliftingListLocationsResponseDto {
    locations: StreetliftingLocation[];
    pagination: {
        page: number;
        limit: number;
        total: number;
    };
    provinces: string[]; // for filter dropdown
    countries?: string[];
}
