import { after, NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { rebuildStreetliftingLocationContributorStats } from "../contributorStats";
import { validateLocationInput } from '../locationInput';

import type { ApiData } from "@/types/api";
import type {
    StreetliftingCreateLocationDto,
    StreetliftingCreateLocationResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingCreateLocationDto;

        if (!body?.name?.trim()) {
            return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
                success: false,
                message: "请填写地点名称",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;
        const inputError = validateLocationInput(body);
        if (inputError) return NextResponse.json({ success: false, message: inputError, data: null }, { status: 400 });
        const profile = (session as any)?.profile || null;
        const contributorUserId = session?.user?.id || null;
        const contributorNameSnapshot = String(
            profile?.nickname ||
            profile?.full_name ||
            session?.user?.name ||
            body.user_contact ||
            "",
        ).trim() || null;
        const contributorContact = String(body.user_contact || contributorNameSnapshot || "").trim() || null;

        const { data, error } = await db
            .from("streetlifting_locations")
            .insert([{
                name: body.name.trim(),
                ...(body.country !== undefined ? { country: body.country?.trim() || null } : {}),
                ...(body.coordinate_system !== undefined ? { coordinate_system: body.coordinate_system } : {}),
                description: body.description || null,
                address: body.address || null,
                city: body.city || null,
                province: body.province || null,
                county: body.county || null,
                latitude: body.latitude ?? null,
                longitude: body.longitude ?? null,
                image_urls: body.image_urls?.length ? body.image_urls : null,
                user_contact: contributorContact,
                contributor_user_id: contributorUserId,
                contributor_name_snapshot: contributorNameSnapshot,
            }])
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][locations] create error:", error);
            return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
                success: false,
                message: error?.message || "提交失败",
                data: null,
            }, { status: 500 });
        }

        // The location is already saved. Ranking maintenance must not delay its acknowledgement.
        after(async () => {
            try {
                await rebuildStreetliftingLocationContributorStats();
            } catch (rebuildError) {
                console.error("[streetlifting-index][locations] contributor rebuild after create failed:", rebuildError);
            }
        });

        return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
            success: true,
            message: "提交成功",
            data: {
                location: data,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] create error:", error);
        return NextResponse.json<ApiData<StreetliftingCreateLocationResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
