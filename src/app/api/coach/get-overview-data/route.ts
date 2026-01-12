import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { GetOverviewDataResponseDto } from "./entity";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "未登录" }, {
            status: 401,
        });
    }

    const userId = session.user.id;

    // 1. 获取教练基础信息（可添加缓存逻辑）
    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({ success: false, message: "教练不存在" }, {
            status: 404,
        });
    }

    const coachId = coach.id;
    const now = new Date().toISOString();
    const startOfMonth = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        1,
    ).toISOString();

    // 2. 并行执行优化后的聚合查询
    const [
        statsResult,
        pendingReviewResult,
        ratingResult,
        contentCountResult,
        planTemplateCountResult,
        actionCountResult,
        coachQuestionResult,
        coachPricingResult,
    ] = await Promise.all([
        supabase
            .from("coach_subscriptions")
            .select("monthly_price, subscribe_data")
            .eq("coach_id", coachId)
            .eq("status", "active")
            .lte("start_date", now),

        // 假设 training_videos 表有 coach_id 或可以通过关联查询
        supabase
            .from("training_videos")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", coachId)
            .eq("requires_review", true)
            .eq("review_status", "pending")
            .is("deleted_at", null),

        supabase
            .from("student_comments")
            .select("rating")
            .eq("coach_id", coachId),

        supabase
            .from("coach_contents")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", coachId),

        supabase
            .from("coach_plan_templates")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", userId),

        supabase
            .from("coach_actions")
            .select("*", { count: "exact", head: true })
            .eq("coach_id", userId),

        supabase
            .from("coach_questionnaires")
            .select("id")
            .eq("coach_id", userId)
            .maybeSingle(),

        supabase
            .from("coach_pricing")
            .select("id")
            .eq("coach_id", coachId)
            .maybeSingle(),
    ]);

    // 3. 内存处理聚合数据（比多次 DB 查询快得多）
    const subscriptions = statsResult.data || [];
    const totalStudentCount = subscriptions.length;
    const pendingReviewCount = pendingReviewResult.count || 0;

    // Helper: check if subscription is an offline payment (money already collected outside platform)
    const isOfflinePayment = (sub: any): boolean => {
        const sd = sub.subscribe_data;
        if (!sd) return false;
        // New format: array with type='offline_payment'
        if (Array.isArray(sd)) {
            return sd.some((item: any) => item?.type === "offline_payment");
        }
        // Old format: object with offline_payment key
        if (typeof sd === "object" && sd.offline_payment) {
            return true;
        }
        return false;
    };

    // Only count revenue from platform payments (exclude offline payments)
    const monthlyRevenue = subscriptions
        .filter((sub) => !isOfflinePayment(sub))
        .reduce((sum, sub) => sum + (Number(sub.monthly_price) || 0), 0);
    const contentCount = contentCountResult.count || 0;
    const actionCount = actionCountResult.count || 0;
    const planTemplateCount = planTemplateCountResult.count || 0;
    const questionReady = Boolean(coachQuestionResult.data);
    const pricingReady = Boolean(coachPricingResult.data);

    const ratings = ratingResult.data || [];
    const averageRating = ratings.length > 0
        ? parseFloat(
            (ratings.reduce((sum, r) => sum + (r.rating || 0), 0) /
                ratings.length).toFixed(1),
        )
        : 0;

    return NextResponse.json<ApiData<GetOverviewDataResponseDto>>({
        success: true,
        data: {
            totalStudentCount,
            pendingReviewCount,
            averageRating,
            monthlyRevenue,
            contentCount,
            actionCount,
            planTemplateCount,
            questionReady,
            pricingReady,
        },
    });
}
