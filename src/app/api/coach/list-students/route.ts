import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    GetStudentsDto,
    ListStudentsResponseDto,
    StudentSubscription,
} from "./entity";
import { UserProfilesRow } from "@/types";
import pLimit from "p-limit";
import { ApiData } from "@/types/api";

async function getVideoStats(studentIds: string[]) {
    const limitController = pLimit(5);

    const tasks = studentIds.map((id) =>
        limitController(async () => {
            const { data: videos } = await supabase
                .from("training_videos")
                .select("coach_feedback")
                .in("user_id", [id]);

            const uploaded = videos?.length || 0;
            const reviewed = videos?.filter(
                (v) => (!!v.coach_feedback &&
                    Object.keys(v.coach_feedback).length > 0),
            ).length || 0;

            return {
                student_id: id,
                uploaded,
                reviewed,
            };
        })
    );

    const res = await Promise.all(tasks);
    return new Map(res.map((item) => [item.student_id, item]));
}

async function getStudentPlanData(coachId: string, studentId: string) {
    // 获取当前活跃的计划实例
    const { data: planInstance, error: instanceErr } = await supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, status, rest_days_count, training_days_count, start_execution_day",
        )
        .eq("coach_id", coachId)
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (planInstance) {
        // 统计已完成的任务数量 (利用 head: true 优化性能)
        const { count: completedCount } = await supabase
            .from("plan_instance_executions")
            .select("id", { count: "exact", head: true })
            .eq("instance_id", planInstance.id)
            .eq("status", "completed");

        return {
            plan: {
                name: planInstance.name,
                description: planInstance.description || "",
                status: planInstance.status,
                id: planInstance.id, // 保留 ID 方便前端跳转
            },
            progress: {
                total: planInstance.training_days_count || 0,
                completed: completedCount || 0,
            },
        };
    }

    // 无计划时的回退数据
    return {
        plan: null,
        progress: { total: 0, completed: 0 },
    };
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "未登录" }, {
            status: 401,
        });
    }

    const { pagination } = await req.json() as GetStudentsDto;

    // 1. 获取教练身份
    const { data: coachRow } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", session.user.id)
        .maybeSingle();

    if (!coachRow?.id) {
        return NextResponse.json(
            { success: false, message: "未找到教练身份" },
            { status: 400 },
        );
    }

    // 2. 获取订阅列表
    const page = pagination?.page || 0;
    const limit = pagination?.limit || 20;
    const from = page * limit;
    const to = from + limit - 1;

    const { data: subs, count, error: subsErr } = await supabase
        .from("coach_subscriptions")
        .select(
            "id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price, subscribed_weeks, prior_training_weeks",
            { count: "exact" },
        )
        .eq("coach_id", coachRow.id)
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .range(from, to);

    if (subsErr) {
        return NextResponse.json({ success: false, message: subsErr.message }, {
            status: 500,
        });
    }

    const studentIds = Array.from(
        new Set((subs || []).map((s) => s.student_id)),
    ).filter(Boolean);

    // 3. 并行获取档案和视频统计
    const [profilesRows, studentViews] = await Promise.all([
        supabase.from("user_profiles").select("*").in(
            "user_id",
            studentIds as string[],
        ),
        getVideoStats(studentIds as string[]),
    ]);

    const profileMap = new Map(
        (profilesRows.data || []).map((p) => [p.user_id, p]),
    );

    // 4. 并行获取 Plan 和 Progress 数据
    const limitController = pLimit(10);
    const planDetailTasks = (subs || []).map((sub) =>
        limitController(async () => {
            const detail = await getStudentPlanData(
                coachRow.id,
                sub.student_id,
            );
            return { subId: sub.id, ...detail };
        })
    );
    const planDetails = await Promise.all(planDetailTasks);
    const planDetailMap = new Map(
        planDetails.map(
            (d) => [d.subId, { plan: d.plan, progress: d.progress }],
        ),
    );

    // 5. 组装数据
    const students: StudentSubscription[] = (subs || []).map((sub) => {
        const studentId = sub.student_id;
        const profile = profileMap.get(studentId) || null;
        const view = studentViews.get(studentId);
        const detail = planDetailMap.get(sub.id);

        return {
            ...sub,
            tier: Number(sub.tier), // 确保类型为 number
            profile,
            uploaded: view?.uploaded || 0,
            reviewed: view?.reviewed || 0,
            plan: detail?.plan || null, // 对应实例中的 status, name 等
            progress: detail?.progress || { total: 0, completed: 0 },
        } as unknown as StudentSubscription;
    });

    return NextResponse.json<ApiData<ListStudentsResponseDto>>({
        success: true,
        message: "ok",
        data: {
            students,
            pagination: { page, limit, total: count || 0 },
        },
    });
}
