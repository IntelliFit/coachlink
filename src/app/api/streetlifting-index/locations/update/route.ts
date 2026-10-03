import { after, NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { rebuildStreetliftingLocationContributorStats } from "../contributorStats";
import { validateLocationInput } from '../locationInput';

import type { ApiData } from "@/types/api";
import type {
    StreetliftingUpdateLocationDto,
    StreetliftingUpdateLocationResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingUpdateLocationDto;

        if (!body?.id) {
            return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
                success: false,
                message: "缺少地点ID",
                data: null,
            }, { status: 400 });
        }

        const db = serviceRoleSupabase;
        const inputError = validateLocationInput(body);
        if (inputError) return NextResponse.json({ success: false, message: inputError, data: null }, { status: 400 });
        const { data: existingLocation, error: existingError } = await db
            .from("streetlifting_locations")
            .select("id, user_contact, contributor_user_id, contributor_name_snapshot")
            .eq("id", body.id)
            .single();

        if (existingError || !existingLocation) {
            return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
                success: false,
                message: existingError?.message || "地点不存在",
                data: null,
            }, { status: 404 });
        }

        const profile = (session as any)?.profile || null;
        const fallbackUserId = session?.user?.id || null;
        const fallbackNameSnapshot = String(
            profile?.nickname ||
            profile?.full_name ||
            session?.user?.name ||
            body.user_contact ||
            "",
        ).trim() || null;
        const hasExistingContributor = !!(
            existingLocation.contributor_user_id ||
            String(existingLocation.contributor_name_snapshot || "").trim() ||
            String(existingLocation.user_contact || "").trim()
        );
        const contributorUserId = hasExistingContributor
            ? existingLocation.contributor_user_id || null
            : fallbackUserId;
        const contributorNameSnapshot = hasExistingContributor
            ? (String(existingLocation.contributor_name_snapshot || "").trim() || null)
            : fallbackNameSnapshot;
        const contributorContact = hasExistingContributor
            ? (String(existingLocation.user_contact || "").trim() || contributorNameSnapshot)
            : (String(body.user_contact || fallbackNameSnapshot || "").trim() || null);

        const { data, error } = await db
            .from("streetlifting_locations")
            .update({
                name: body.name,
                ...(body.country !== undefined ? { country: body.country?.trim() || null } : {}),
                ...(body.coordinate_system !== undefined ? { coordinate_system: body.coordinate_system } : {}),
                description: body.description ?? null,
                address: body.address ?? null,
                city: body.city ?? null,
                province: body.province ?? null,
                county: body.county ?? null,
                latitude: body.latitude ?? null,
                longitude: body.longitude ?? null,
                image_urls: body.image_urls?.length ? body.image_urls : null,
                user_contact: contributorContact,
                contributor_user_id: contributorUserId,
                contributor_name_snapshot: contributorNameSnapshot,
            })
            .eq("id", body.id)
            .select("*")
            .single();

        if (error || !data) {
            console.error("[streetlifting-index][locations] update error:", error);
            return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
                success: false,
                message: error?.message || "更新失败",
                data: null,
            }, { status: 500 });
        }

        // Return the persisted location before refreshing the derived leaderboard.
        after(async () => {
            try {
                await rebuildStreetliftingLocationContributorStats();
            } catch (rebuildError) {
                console.error("[streetlifting-index][locations] contributor rebuild after update failed:", rebuildError);
            }
        });

        return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
            success: true,
            message: "更新成功",
            data: {
                location: data,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] update error:", error);
        return NextResponse.json<ApiData<StreetliftingUpdateLocationResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
