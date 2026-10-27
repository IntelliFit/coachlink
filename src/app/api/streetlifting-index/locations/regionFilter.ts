import { getLocationProvince, getLocationRegionCountry, matchesLocationSearch, sortProvinces, type LocationSearchInput } from '@coachlink/core';

export interface LocationRegionFilters {
    country?: string;
    province?: string;
    city?: string;
    county?: string;
    search?: string;
}

function selected(value?: string): string {
    const trimmed = String(value || '').trim();
    return trimmed === 'all' ? '' : trimmed;
}

// Country / province compare on normalized values so legacy rows typed as "广东",
// "北京是" or "西安" still belong to 广东省 / 北京市 / 陕西省.
export function matchesLocationRegionFilters(location: LocationSearchInput, filters: LocationRegionFilters): boolean {
    const country = selected(filters.country);
    const province = selected(filters.province);
    const city = selected(filters.city);
    const county = selected(filters.county);
    return (!country || getLocationRegionCountry(location) === country)
        && (!province || getLocationProvince(location) === province)
        && (!city || location.city === city)
        && (!county || location.county === county)
        && matchesLocationSearch(location, filters.search);
}

export function listLocationProvinces(rows: LocationSearchInput[], country?: string): string[] {
    const target = selected(country);
    const provinces = new Set<string>();
    rows.forEach(row => {
        if (target && getLocationRegionCountry(row) !== target) return;
        const province = getLocationProvince(row);
        if (province) provinces.add(province);
    });
    return sortProvinces(Array.from(provinces));
}

export function listLocationCountries(rows: LocationSearchInput[]): string[] {
    const countries = new Set(rows.map(getLocationRegionCountry).filter(Boolean));
    return Array.from(countries).sort((a, b) => a === '中国' ? -1 : b === '中国' ? 1 : a.localeCompare(b));
}
