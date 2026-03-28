// 请求参数
export interface StreetliftingStatsDto {}

export interface StreetliftingStatsTopAreaItem {
    name: string;
    count: number;
}

export interface StreetliftingStatsMonthlyTrendItem {
    month: string;
    count: number;
}

export interface StreetliftingLocationOverviewStats {
    totalCount: number;
    withImagesCount: number;
    withDescriptionCount: number;
    averageImageCount: number;
    provinceCount: number;
    mapReadyCount: number;
    contributorCount: number;
    topProvinces: StreetliftingStatsTopAreaItem[];
    topCities: StreetliftingStatsTopAreaItem[];
    recentMonths: StreetliftingStatsMonthlyTrendItem[];
}

// 返回数据
export interface StreetliftingStatsResponseDto {
    totalCount: number;
    lastUpdated: string | null;
    locationOverview: StreetliftingLocationOverviewStats;
}
