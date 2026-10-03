import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { getLocationCountry } from '@coachlink/core';

export interface MapPin {
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

export async function POST(): Promise<Response> {
    try {
        await getServerSession();

        let { data, error } = await serviceRoleSupabase
            .from("streetlifting_locations")
            .select("id, name, country, coordinate_system, latitude, longitude, province, city, county, address")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .limit(2000);

        // Keep legacy browsing usable until the additive migration is deployed.
        if (error?.code === '42703' && /country|coordinate_system/.test(error.message)) {
            const legacy = await serviceRoleSupabase.from('streetlifting_locations')
                .select('id, name, latitude, longitude, province, city, county, address')
                .not('latitude', 'is', null).not('longitude', 'is', null).limit(2000);
            data = legacy.data as typeof data;
            error = legacy.error;
        }

        if (error) {
            console.error("[streetlifting-index][map-pins] error:", error);
            return NextResponse.json<ApiData<MapPin[]>>({
                success: false,
                message: error.message,
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<MapPin[]>>({
            success: true,
            message: "ok",
            data: (data ?? []).map(item => ({ ...item, country: getLocationCountry(item) || null })) as MapPin[],
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
