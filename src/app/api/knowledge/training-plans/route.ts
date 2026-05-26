import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    toTrainingPlanListItem,
    type PublicTrainingPlanTemplate,
} from "./_helpers";

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "all";
    const search = (searchParams.get("q") || "").trim();
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    let query = supabase
        .from("public_training_plan_templates")
        .select("*", { count: "exact" })
        .eq("status", "published")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true })
        .range(offset, offset + limit - 1);

    if (level !== "all") {
        query = query.eq("level", level);
    }

    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sport.ilike.%${search}%,goal.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) {
        console.error("[knowledge/training-plans] list failed:", error);
        return NextResponse.json({
            success: false,
            message: "获取训练计划模板失败",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<{
        plans: ReturnType<typeof toTrainingPlanListItem>[];
        total: number;
        limit: number;
        offset: number;
    }>>({
        success: true,
        message: "获取训练计划模板成功",
        data: {
            plans: ((data || []) as PublicTrainingPlanTemplate[]).map(toTrainingPlanListItem),
            total: count || 0,
            limit,
            offset,
        },
    });
}
