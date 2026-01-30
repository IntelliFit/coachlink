import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingListLocationsDto } from "./entity";
import type { StreetliftingListLocationsResponseDto } from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingListLocationsDto;
        const db = serviceRoleSupabase;

        const page = Math.max(1, Number(body?.page || 1));
        const limitRaw = Number(body?.limit || 30);
        const limit = Math.min(30, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 30));
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        const search = (body?.search || "").trim();
        const province = (body?.province || "").trim();

        let q = db
            .from("streetlifting_locations")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

        if (province && province !== "all") {
            q = q.eq("province", province);
        }

        if (search) {
            const pattern = `%${search.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
            q = q.or(
                [
                    `name.ilike.${pattern}`,
                    `province.ilike.${pattern}`,
                    `city.ilike.${pattern}`,
                    `address.ilike.${pattern}`,
                    `description.ilike.${pattern}`,
                ].join(","),
            );
        }

        const { data, error, count } = await q.range(from, to);

        if (error) {
            console.error("[streetlifting-index][locations] list error:", error);
            return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
                success: false,
                message: error.message || "获取地点失败",
                data: null,
            }, { status: 500 });
        }

        // Provinces facet (global list, capped for safety)
        const { data: provData } = await db
            .from("streetlifting_locations")
            .select("province")
            .not("province", "is", null)
            .limit(2000);
        const provinces = Array.from(new Set((provData || []).map((x: any) => String(x.province)).filter(Boolean))).sort();

        return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
            success: true,
            message: "获取地点成功",
            data: {
                locations: data || [],
                pagination: {
                    page,
                    limit,
                    total: Number(count || 0),
                },
                provinces,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] list error:", error);
        return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
