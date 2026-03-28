import { NextResponse } from "next/server";
import { getServerSession } from "../../../auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";

import type { ApiData } from "@/types/api";
import type {
    StreetliftingLocationContributorsDto,
    StreetliftingLocationContributorsResponseDto,
} from "./entity";

export async function POST(req: Request) {
    try {
        await getServerSession();
        const body = (await req.json().catch(() => ({}))) as StreetliftingLocationContributorsDto;
        const limitRaw = Number(body?.limit || 10);
        const limit = Math.min(50, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10));

        const { data, error } = await serviceRoleSupabase
            .from("streetlifting_location_contributors")
            .select("contributor_key, contributor_user_id, display_name, upload_count, detail_score_total, image_count_total, contribution_score, last_contributed_at")
            .order("contribution_score", { ascending: false })
            .order("upload_count", { ascending: false })
            .order("detail_score_total", { ascending: false })
            .order("last_contributed_at", { ascending: false })
            .limit(limit);

        if (error) {
            console.error("[streetlifting-index][locations] contributors error:", error);
            return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
                success: false,
                message: error.message || "获取贡献榜失败",
                data: null,
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
            success: true,
            message: "获取贡献榜成功",
            data: {
                contributors: (data || []) as any,
            },
        });
    } catch (error) {
        console.error("[streetlifting-index][locations] contributors error:", error);
        return NextResponse.json<ApiData<StreetliftingLocationContributorsResponseDto>>({
            success: false,
            message: "服务器异常",
            data: null,
        }, { status: 500 });
    }
}
