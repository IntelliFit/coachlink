import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    ListHistoryDto,
    ListHistoryResponseDto,
    PlanHistoryItem,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { schedulePlanCompletionAutomation } from "@/lib/planCompletionAutomation";
import {
    persistCompletedPlanInstanceIfNeeded,
    summarizePlanCompletion,
} from "@/lib/planInstanceCompletion";

export async function POST(req: Request) {
    const { page = 1, limit = 20, source = "all" } = await req
        .json() as ListHistoryDto;

    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: entitlementSubs, error: entitlementError } = await supabase
        .from("coach_subscriptions")
        .select("id")
        .eq("student_id", userId);

    if (entitlementError) {
        console.error("Error fetching student subscription entitlements:", entitlementError);
        return NextResponse.json({
            success: false,
            message: `鑾峰彇鍘嗗彶璁″垝澶辫触: ${entitlementError.message}`,
        }, { status: 500 });
    }

    const entitlementSubscriptionIds = Array.from(
        new Set((entitlementSubs || []).map((sub: any) => String(sub?.id || "")).filter(Boolean)),
    );

    let query = supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, source, status, start_date, end_date, start_execution_day, created_at, updated_at, training_days, student_id, coach_subscription_id",
        )
        .in("status", ["active", "completed", "archived"])
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false });

    if (source === "coach") {
        query = query.eq("source", "coach");
    } else if (source === "student") {
        query = query.or("source.eq.student,source.eq.self");
    }

    const { data: rawPlans, error } = await query;

    if (error) {
        console.error("Error fetching plan history:", error);
        return NextResponse.json({
            success: false,
            message: `获取历史计划失败: ${error.message}`,
        }, { status: 500 });
    }

    const dedupedPlans = new Map<string, any>();
    for (const plan of rawPlans || []) {
        const directStudentMatch = String((plan as any)?.student_id || "") === userId;
        const entitledSubscriptionMatch = entitlementSubscriptionIds.includes(
            String((plan as any)?.coach_subscription_id || ""),
        );

        if (!directStudentMatch && !entitledSubscriptionMatch) {
            continue;
        }

        if (!dedupedPlans.has(plan.id)) {
            dedupedPlans.set(plan.id, plan);
        }
    }

    const filteredPlans = Array.from(dedupedPlans.values());
    const plans = filteredPlans.slice(from, to + 1);
    const count = filteredPlans.length;

    const planIds = (plans || [])
        .map((plan: any) => plan?.id)
        .filter(Boolean);

    const { data: resolvedExecutions } = planIds.length > 0
        ? await supabase
            .from("plan_instance_executions")
            .select("instance_id, day_index, status, completed_at, updated_at")
            .in("instance_id", planIds)
            .in("status", ["completed", "abandoned"])
        : { data: [] as any[] };

    const latestResolvedAtByInstanceId = new Map<string, string>();
    for (const exec of resolvedExecutions || []) {
        const instanceId = String((exec as any)?.instance_id || "");
        if (!instanceId) continue;
        const resolvedAt = (exec as any)?.completed_at || (exec as any)?.updated_at;
        if (!resolvedAt) continue;

        const current = latestResolvedAtByInstanceId.get(instanceId);
        if (
            !current ||
            new Date(String(resolvedAt)).getTime() >=
                new Date(String(current)).getTime()
        ) {
            latestResolvedAtByInstanceId.set(instanceId, String(resolvedAt));
        }
    }

    const plansWithStats: PlanHistoryItem[] = await Promise.all(
        (plans || []).map(async (plan: any) => {
            const dayList = Array.isArray(plan.training_days)
                ? plan.training_days
                : [];
            const completionSummary = summarizePlanCompletion({
                trainingDays: dayList,
                startExecutionDay: Number(plan.start_execution_day || 1),
                executions: (resolvedExecutions || [])
                    .filter((exec: any) =>
                        String(exec?.instance_id || "") === String(plan.id)
                    )
                    .map((exec: any) => ({
                        day_index: Number(exec?.day_index ?? 0),
                        status: exec?.status || null,
                        completed_at: exec?.completed_at || null,
                        updated_at: exec?.updated_at || null,
                    })),
            });

            const persistedPlan = await persistCompletedPlanInstanceIfNeeded({
                supabase,
                instance: plan,
                summary: completionSummary,
                onCompleted: (completed) => schedulePlanCompletionAutomation(completed.id),
            });

            const normalizedStatus = String(persistedPlan.status || "")
                .trim()
                .toLowerCase();
            const displayStatus = normalizedStatus === "active" &&
                    completionSummary.isLogicallyCompleted
                ? "completed"
                : persistedPlan.status;
            const completionRate = completionSummary.overallTotalTrainingDays > 0
                ? Math.round(
                    (completionSummary.overallResolvedTrainingDays /
                        completionSummary.overallTotalTrainingDays) * 100,
                )
                : undefined;
            const shouldDeriveEndDate = !persistedPlan.end_date &&
                (
                    completionSummary.isLogicallyCompleted ||
                    normalizedStatus === "completed" ||
                    normalizedStatus === "archived"
                );
            const derivedEndDate = shouldDeriveEndDate
                ? (
                    completionSummary.latestCompletedAt ||
                    latestResolvedAtByInstanceId.get(plan.id) ||
                    persistedPlan.updated_at ||
                    null
                )
                : persistedPlan.end_date;

            return {
                id: persistedPlan.id,
                name: persistedPlan.name,
                description: persistedPlan.description,
                source: persistedPlan.source,
                status: displayStatus,
                start_date: persistedPlan.start_date,
                end_date: derivedEndDate,
                created_at: persistedPlan.created_at,
                updated_at: persistedPlan.updated_at,
                total_days: completionSummary.overallTotalTrainingDays,
                total_training_days: completionSummary.overallTotalTrainingDays,
                plan_span_days: dayList.length,
                completed_days: completionSummary.overallResolvedTrainingDays,
                completion_rate: completionRate,
                archive_reason: null,
                entitlement_consumption_policy: null,
            };
        }),
    );

    return NextResponse.json<ApiData<ListHistoryResponseDto>>({
        success: true,
        message: "获取历史计划成功",
        data: {
            plans: plansWithStats,
            totalCount: count || 0,
            page,
            limit,
        },
    });
}
