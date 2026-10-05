import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { getLocationCountry, normalizeLocationEquipment, validateLocationEquipment, type LocationEquipmentInput } from '@coachlink/core';
import { readEquipmentLocations } from '../equipmentQuery';
import type { StreetliftingListLocationsDto, StreetliftingLocation } from '../list/entity';

export interface MapPin extends LocationEquipmentInput {
    id: string;
    country?: string | null;
    coordinate_system?: 'wgs84' | 'gcj02' | null;
    name: string;
    latitude: number;
    longitude: number;
    province?: string | null;
    city?: string | null;
    county?: string | null;
    address?: string | null;
}

export async function POST(req?: Request): Promise<Response> {
    try {
        const body = (await req?.json().catch(() => ({})) || {}) as StreetliftingListLocationsDto;
        const equipmentError = validateLocationEquipment(body.equipment);
        if (equipmentError) return NextResponse.json({ success: false, message: equipmentError, data: null }, { status: 400 });
        const query = serviceRoleSupabase.from('streetlifting_locations').select('*')
            .not('latitude', 'is', null).not('longitude', 'is', null).order('id');
        const rows = await readEquipmentLocations<StreetliftingLocation>((from, to) => query.range(from, to), normalizeLocationEquipment(body.equipment));
        const country = body.country?.trim();
        const province = body.province?.trim();
        const search = body.search?.trim().toLowerCase();
        const data = rows.filter(item =>
            (!country || country === 'all' || getLocationCountry(item) === country) &&
            (!province || province === 'all' || item.province === province) &&
            (!body.city || item.city === body.city) && (!body.county || item.county === body.county) &&
            (!search || [item.name, getLocationCountry(item), item.province, item.city, item.address, item.description].some(value => String(value || '').toLowerCase().includes(search)))
        );

        return NextResponse.json<ApiData<MapPin[]>>({
            success: true,
            message: "ok",
            data: data.map(item => ({
                id: item.id, name: item.name, country: getLocationCountry(item) || null,
                coordinate_system: item.coordinate_system, latitude: item.latitude!, longitude: item.longitude!,
                province: item.province, city: item.city, county: item.county, address: item.address,
                equipment_types: item.equipment_types, equipment_source: item.equipment_source
            })),
        });
    } catch (error) {
        console.error("[streetlifting-index][map-pins] error:", error);
        return NextResponse.json<ApiData<MapPin[]>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
