import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import {
    toTrainingPlanListItem,
    type PublicTrainingPlanTemplate,
} from "./_helpers";
import curatedReferences from "@/data/curatedTrainingPlanReferences.json";

type TrainingPlanListResponseItem = ReturnType<typeof toTrainingPlanListItem> & {
    entryKind: "template" | "reference";
    canCopy: boolean;
    author: string | null;
    sourceName: string | null;
    sourceUrl: string | null;
    rightsStatus: string | null;
};

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const level = searchParams.get("level") || "all";
    const specialty = (searchParams.get("specialty") || "all").trim();
    const search = (searchParams.get("q") || "").trim();
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const offset = Math.max(0, Number(searchParams.get("offset") || 0));

    const filteredReferences = curatedReferences.items.filter((plan) => {
        if (level !== "all" && plan.level !== level) return false;
        if (specialty && specialty !== "all" && plan.specialtyKey !== specialty) return false;
        if (!search) return true;
        const haystack = [
            plan.name,
            plan.description,
            plan.sport,
            plan.goal,
            plan.author,
            plan.specialtyLabel,
        ].join(" ").toLowerCase();
        return haystack.includes(search.toLowerCase());
    });

    const applyFilters = (builder: any) => {
        let query = builder;
        if (level !== "all") {
            query = query.eq("level", level);
        }
        if (specialty && specialty !== "all") {
            query = query.eq("specialty_key", specialty);
        }
        if (search) {
            query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,sport.ilike.%${search}%,goal.ilike.%${search}%`);
        }
        return query;
    };

    const countQuery = applyFilters(supabase
        .from("public_training_plan_templates")
        .select("id", { count: "exact", head: true })
        .eq("status", "published")
        .order("specialty_priority", { ascending: true })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }));
    const { count: databaseCount, error: countError } = await countQuery;
    if (countError) {
        console.error("[knowledge/training-plans] count failed:", countError);
        return NextResponse.json({
            success: false,
            message: "获取训练计划模板失败",
        }, { status: 500 });
    }

    const publishedCount = databaseCount || 0;
    const databaseTake = offset < publishedCount
        ? Math.min(limit, publishedCount - offset)
        : 0;
    let databaseRows: PublicTrainingPlanTemplate[] = [];
    if (databaseTake > 0) {
        const dataQuery = applyFilters(supabase
            .from("public_training_plan_templates")
            .select("*")
            .eq("status", "published")
            .order("specialty_priority", { ascending: true })
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true })
            .range(offset, offset + databaseTake - 1));
        const { data, error } = await dataQuery;
        if (error) {
            console.error("[knowledge/training-plans] list failed:", error);
            return NextResponse.json({
                success: false,
                message: "获取训练计划模板失败",
            }, { status: 500 });
        }
        databaseRows = (data || []) as PublicTrainingPlanTemplate[];
    }

    const databasePlans: TrainingPlanListResponseItem[] = databaseRows.map((template) => ({
        ...toTrainingPlanListItem(template),
        entryKind: "template" as const,
        canCopy: true,
        author: null,
        sourceName: "CoachLink",
        sourceUrl: null,
        rightsStatus: "platform-owned",
    }));
    const referenceStart = Math.max(0, offset - publishedCount);
    const referenceTake = Math.max(0, limit - databasePlans.length);
    const referencePlans = filteredReferences.slice(
        referenceStart,
        referenceStart + referenceTake,
    ) as unknown as TrainingPlanListResponseItem[];

    return NextResponse.json<ApiData<{
        plans: TrainingPlanListResponseItem[];
        total: number;
        limit: number;
        offset: number;
    }>>({
        success: true,
        message: "获取训练计划模板成功",
        data: {
            plans: [...databasePlans, ...referencePlans],
            total: publishedCount + filteredReferences.length,
            limit,
            offset,
        },
    });
}
