import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingListLocationsDto } from "./entity";
import type { StreetliftingListLocationsResponseDto } from "./entity";
import { CHINA_PROVINCE_NAMES, getLocationCountry } from '@coachlink/core';

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
        const country = (body?.country || "").trim();
        const city = (body?.city || "").trim();
        const county = (body?.county || "").trim();

        let q = db
            .from("streetlifting_locations")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false });

        if (province && province !== "all") {
            q = q.eq("province", province);
        }
        const legacyChina = `country.eq.中国,country.in.(CN,China,中国大陆),and(or(country.is.null,country.eq.\"\"),province.in.(${CHINA_PROVINCE_NAMES.join(',')}))`;
        const chinaFilter = country === '中国';
        if (country && country !== 'all' && !chinaFilter) q = q.eq('country', country);
        if (city) {
            q = q.eq("city", city);
        }
        if (county) {
            q = q.eq("county", county);
        }

        if (search) {
            const pattern = `"%${search.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, "\\%").replace(/_/g, "\\_")}%"`;
            const searchTerms = [
                    `name.ilike.${pattern}`,
                    `country.ilike.${pattern}`,
                    `province.ilike.${pattern}`,
                    `city.ilike.${pattern}`,
                    `address.ilike.${pattern}`,
                    `description.ilike.${pattern}`,
                ];
            if (['中国', 'China', 'CN'].includes(search)) searchTerms.push(`and(or(country.is.null,country.eq.\"\"),province.in.(${CHINA_PROVINCE_NAMES.join(',')}))`);
            const searchFilter = searchTerms.join(',');
            q = q.or(chinaFilter ? `and(or(${legacyChina}),or(${searchFilter}))` : searchFilter);
        } else if (chinaFilter) {
            q = q.or(legacyChina);
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

        const { data: countryData } = await db.from('streetlifting_locations').select('country,province').limit(2000);
        const provinces = Array.from(new Set((countryData || []).filter(item => !country || country === 'all' || getLocationCountry(item) === country).map(item => String(item.province || '').trim()).filter(Boolean))).sort();
        const countries = Array.from(new Set((countryData || []).map(getLocationCountry).filter(Boolean))).sort((a, b) => a === '中国' ? -1 : b === '中国' ? 1 : a.localeCompare(b));

        return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
            success: true,
            message: "获取地点成功",
            data: {
                locations: (data || []).map(item => ({ ...item, country: getLocationCountry(item) || null })),
                pagination: {
                    page,
                    limit,
                    total: Number(count || 0),
                },
                provinces,
                countries,
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
