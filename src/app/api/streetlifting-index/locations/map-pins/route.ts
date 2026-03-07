import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";

export interface MapPin {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
}

export async function POST(): Promise<Response> {
    try {
        await getServerSession();

        const { data, error } = await serviceRoleSupabase
            .from("streetlifting_locations")
            .select("id, name, latitude, longitude")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .limit(2000);

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
            data: (data ?? []) as MapPin[],
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
