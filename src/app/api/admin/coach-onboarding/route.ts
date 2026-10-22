import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { buildCoachOnboardingProgress } from "@/lib/coachOnboardingProgress";

// 重要！必须以 import type 引入接口类型
import type { ApiData } from "@/types/api";
import type { CoachOnboardingRow, ListCoachOnboardingResponseDto } from "./entity";

type CountMap = Map<string, number>;

function countBy(rows: Array<{ coach_id: string | null }> | null): CountMap {
    const counts: CountMap = new Map();
    for (const row of rows || []) {
        if (!row.coach_id) continue;
        counts.set(row.coach_id, (counts.get(row.coach_id) || 0) + 1);
    }
    return counts;
}

/**
 * 运营回访用：列出所有已通过（含暂停）的教练、联系方式和开店进度。
 * coach_pricing / coach_subscriptions 用 coaches.id，coach_questionnaires / coach_plan_templates 用 users.id。
 */
export async function POST() {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }
    if (!(session.user as { is_admin?: boolean }).is_admin) {
        return NextResponse.json({ success: false, message: "用户无权限", data: null }, { status: 403 });
    }

    const { data: coaches, error } = await serviceRoleSupabase
        .from("coaches")
        .select("id,user_id,name,coach_track,status,province,city,created_at,huifu_id,huifu_apply_no,huifu_card_token")
        .in("status", ["approved", "suspended"])
        .order("created_at", { ascending: false });

    if (error) {
        console.error("[admin/coach-onboarding] load coaches failed:", error);
        return NextResponse.json<ApiData<null>>({ success: false, message: "查询教练失败", data: null }, { status: 500 });
    }

    const coachRows = (coaches || []) as any[];
    if (coachRows.length === 0) {
        return NextResponse.json<ApiData<ListCoachOnboardingResponseDto>>({
            success: true,
            message: "查询成功",
            data: { coaches: [] },
        });
    }
    const coachIds = coachRows.map((coach) => coach.id);
    const userIds = coachRows.map((coach) => coach.user_id).filter(Boolean) as string[];

    const [pricingRes, subscriptionRes, questionnaireRes, templateRes, userRes, profileRes, applicationRes] = await Promise.all([
        serviceRoleSupabase.from("coach_pricing").select("coach_id,products,pricings").in("coach_id", coachIds),
        serviceRoleSupabase.from("coach_subscriptions").select("coach_id").in("coach_id", coachIds).eq("status", "active"),
        // 只算已发布的问卷，草稿学员看不到
        serviceRoleSupabase.from("coach_questionnaires").select("coach_id").in("coach_id", userIds).eq("status", "active"),
        serviceRoleSupabase.from("coach_plan_templates").select("coach_id").in("coach_id", userIds),
        serviceRoleSupabase.from("users").select("id,phone,email").in("id", userIds),
        serviceRoleSupabase.from("user_profiles").select("user_id,nickname").in("user_id", userIds),
        serviceRoleSupabase.from("coach_applications").select("user_id,contact_phone,contact_email").in("user_id", userIds),
    ]);

    const failed = [pricingRes, subscriptionRes, questionnaireRes, templateRes, userRes, profileRes, applicationRes]
        .find((res) => res.error);
    if (failed?.error) {
        console.error("[admin/coach-onboarding] load progress failed:", failed.error);
        return NextResponse.json<ApiData<null>>({ success: false, message: "查询开店进度失败", data: null }, { status: 500 });
    }

    const pricingByCoach = new Map((pricingRes.data || []).map((row: any) => [row.coach_id, row]));
    const activeStudents = countBy(subscriptionRes.data as any);
    const questionnaires = countBy(questionnaireRes.data as any);
    const templates = countBy(templateRes.data as any);
    const users = new Map((userRes.data || []).map((row: any) => [row.id, row]));
    const nicknames = new Map((profileRes.data || []).map((row: any) => [row.user_id, row.nickname]));
    const applications = new Map((applicationRes.data || []).map((row: any) => [row.user_id, row]));

    const rows: CoachOnboardingRow[] = coachRows.map((coach) => {
        const user = users.get(coach.user_id);
        const application = applications.get(coach.user_id);
        const activeStudentCount = activeStudents.get(coach.id) || 0;
        return {
            coachId: coach.id,
            userId: coach.user_id ?? null,
            name: coach.name,
            nickname: nicknames.get(coach.user_id) ?? null,
            coachTrack: coach.coach_track ?? null,
            status: coach.status ?? null,
            phone: user?.phone || application?.contact_phone || null,
            email: application?.contact_email || user?.email || null,
            city: [coach.province, coach.city].filter(Boolean).join(" ") || null,
            approvedAt: coach.created_at ?? null,
            activeStudentCount,
            progress: buildCoachOnboardingProgress({
                huifuCardToken: coach.huifu_card_token,
                huifuId: coach.huifu_id,
                huifuApplyNo: coach.huifu_apply_no,
                pricing: pricingByCoach.get(coach.id) ?? null,
                questionnaireCount: questionnaires.get(coach.user_id) || 0,
                templateCount: templates.get(coach.user_id) || 0,
                activeStudentCount,
            }),
        };
    });

    return NextResponse.json<ApiData<ListCoachOnboardingResponseDto>>({
        success: true,
        message: "查询成功",
        data: { coaches: rows },
    });
}
