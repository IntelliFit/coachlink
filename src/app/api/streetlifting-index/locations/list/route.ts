import { NextResponse } from "next/server";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type { StreetliftingListLocationsDto, StreetliftingListLocationsResponseDto, StreetliftingLocation } from "./entity";
import { getLocationProvince, getLocationRegionCountry, matchesLocationEquipment, normalizeLocationEquipment, validateLocationEquipment, withLocationEquipment } from '@coachlink/core';
import { readEquipmentLocations } from '../equipmentQuery';
import { listLocationCountries, listLocationProvinces, matchesLocationRegionFilters } from '../regionFilter';

export async function POST(req: Request) {
    try {
        // This public list has no user-specific data; keep profile requests off its critical path.
        const body = (await req.json().catch(() => ({}))) as StreetliftingListLocationsDto;
        const db = serviceRoleSupabase;

        const page = Math.max(1, Number(body?.page || 1));
        const limitRaw = Number(body?.limit || 30);
        const limit = Math.min(30, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 30));
        const from = (page - 1) * limit;

        const filters = {
            search: (body?.search || "").trim(),
            province: (body?.province || "").trim(),
            country: (body?.country || "").trim(),
            city: (body?.city || "").trim(),
            county: (body?.county || "").trim(),
        };
        const equipmentError = validateLocationEquipment(body?.equipment);
        if (equipmentError) return NextResponse.json({ success: false, message: equipmentError, data: null }, { status: 400 });
        const equipment = normalizeLocationEquipment(body?.equipment);

        const query = db
            .from("streetlifting_locations")
            .select("*")
            .order("created_at", { ascending: false })
            .order('id', { ascending: false });

        // Region and keyword matching rely on normalized legacy province text ("广东",
        // "北京是", "西安"), which PostgREST filters cannot express, so the (small) table
        // is read in chunks and matched in memory, like map-pins.
        let rows: StreetliftingLocation[];
        try {
            rows = await readEquipmentLocations<StreetliftingLocation>((start, end) => query.range(start, end), []);
        } catch (error) {
            console.error("[streetlifting-index][locations] list error:", error);
            return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
                success: false,
                message: (error as Error)?.message || "获取地点失败",
                data: null,
            }, { status: 500 });
        }

        const filtered = rows.filter(item => matchesLocationEquipment(item, equipment) && matchesLocationRegionFilters(item, filters));
        const pageRows = filtered.slice(from, from + limit);

        return NextResponse.json<ApiData<StreetliftingListLocationsResponseDto>>({
            success: true,
            message: "获取地点成功",
            data: {
                locations: pageRows.map(item => ({
                    ...withLocationEquipment(item),
                    country: getLocationRegionCountry(item) || null,
                    province: getLocationProvince(item) || item.province,
                })),
                pagination: {
                    page,
                    limit,
                    total: filtered.length,
                },
                provinces: listLocationProvinces(rows, filters.country),
                countries: listLocationCountries(rows),
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
