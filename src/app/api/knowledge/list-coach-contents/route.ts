import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type {
    ListCoachContentsDto,
    ListCoachContentsResponseDto,
    CoachContentListItem,
} from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json(
            { success: false, message: "用户未登录", data: null },
            { status: 401 },
        );
    }

    const userId = session.user.id;

    const { limit = 20, offset = 0, content_type } =
        (await req.json()) as ListCoachContentsDto;

    let query = supabase
        .from("coach_contents")
        .select(
            `
            *,
            coach:coaches(
                id,
                name,
                avatar_url,
                user_id,
                status
            )
        `,
            { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (content_type) {
        query = query.eq("content_type", content_type);
    }

    const { data, error, count } = await query;

    if (error) {
        console.error("获取教练内容列表失败:", error);
        return NextResponse.json<ApiData<ListCoachContentsResponseDto>>(
            { success: false, message: "获取内容失败", data: null },
            { status: 500 },
        );
    }

    // publish-content 已限制仅 approved 教练可发布；这里不再对嵌套字段做过滤，避免 PostgREST 兼容性问题
    const rows = (data || []) as any[];

    // 一次性查询用户对这些教练的订阅 tier
    const coachIds = Array.from(
        new Set(
            rows
                .map((r) => r?.coach?.id as string | undefined)
                .filter(Boolean) as string[],
        ),
    );

    const tierByCoachId = new Map<string, number>();
    if (coachIds.length > 0) {
        const { data: subs, error: subsError } = await supabase
            .from("coach_subscriptions")
            .select("coach_id,tier")
            .eq("student_id", userId)
            .eq("status", "active")
            .in("coach_id", coachIds);

        if (subsError) {
            console.error("获取订阅 tier 失败:", subsError);
        } else {
            (subs || []).forEach((s: any) => {
                if (!s?.coach_id) return;
                tierByCoachId.set(s.coach_id, s?.tier ?? 0);
            });
        }
    }

    const items: CoachContentListItem[] = rows.map((r) => {
        const coach = r.coach as any;
        const requiredTier = (r.required_tier ?? 0) as number;

        const accessTier =
            coach?.user_id && coach.user_id === userId
                ? 3
                : tierByCoachId.get(coach?.id) ?? 0;

        return {
            content: r,
            coach: {
                id: coach?.id,
                name: coach?.name || "教练",
                avatar_url: coach?.avatar_url ?? null,
                status: coach?.status ?? null,
            },
            accessTier,
            canView: accessTier >= requiredTier,
        };
    });

    return NextResponse.json<ApiData<ListCoachContentsResponseDto>>({
        success: true,
        message: "获取成功",
        data: {
            items,
            total: count || 0,
            limit,
            offset,
        },
    });
}

