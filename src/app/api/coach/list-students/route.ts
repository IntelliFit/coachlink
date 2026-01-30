import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { fenToYuan } from "@/lib/moneyUtils";
import {
    GetStudentsDto,
    ListStudentsResponseDto,
    StudentSubscription,
} from "./entity";
import { UserProfilesRow } from "@/types";
import pLimit from "p-limit";
import { ApiData } from "@/types/api";

async function getVideoStats(studentIds: string[]) {
    if (!studentIds?.length) return new Map();

    // 1 query instead of N queries: fetch all videos for these students
    const { data: videos } = await supabase
        .from("training_videos")
        .select("user_id, coach_feedback")
        .in("user_id", studentIds);

    const statsMap = new Map<string, { student_id: string; uploaded: number; reviewed: number }>();
    for (const id of studentIds) {
        statsMap.set(id, { student_id: id, uploaded: 0, reviewed: 0 });
    }

    for (const v of videos || []) {
        const sid = (v as any).user_id as string;
        const stat = statsMap.get(sid);
        if (!stat) continue;
        stat.uploaded += 1;
        const feedback = (v as any).coach_feedback;
        if (feedback && typeof feedback === "object" && Object.keys(feedback).length > 0) {
            stat.reviewed += 1;
        }
    }

    return statsMap;
}

async function getStudentPlanDataBatch(coachId: string, studentIds: string[]) {
    if (!studentIds?.length) return new Map<string, { plan: any; progress: any }>();

    // 1) Batch fetch instances, then pick latest per student
    const { data: instances } = await supabase
        .from("coach_plan_instances")
        .select(
            "id, name, description, status, rest_days_count, training_days_count, start_execution_day, student_id, created_at",
        )
        .eq("coach_id", coachId)
        .in("student_id", studentIds)
        .order("created_at", { ascending: false });

    const latestByStudent = new Map<string, any>();
    for (const inst of instances || []) {
        if (!inst?.student_id) continue;
        if (!latestByStudent.has(inst.student_id)) {
            latestByStudent.set(inst.student_id, inst);
        }
    }

    // 2) Batch fetch completed executions for these instances and count in memory
    const instanceIds = Array.from(latestByStudent.values()).map((i) => i.id).filter(Boolean);
    const completedByInstance = new Map<string, number>();
    if (instanceIds.length > 0) {
        const { data: execs } = await supabase
            .from("plan_instance_executions")
            .select("instance_id")
            .in("instance_id", instanceIds)
            .eq("status", "completed");

        for (const e of execs || []) {
            const iid = (e as any).instance_id as string;
            completedByInstance.set(iid, (completedByInstance.get(iid) || 0) + 1);
        }
    }

    // 3) Assemble result map
    const result = new Map<string, { plan: any; progress: any }>();
    for (const studentId of studentIds) {
        const inst = latestByStudent.get(studentId);
        if (!inst) {
            result.set(studentId, { plan: null, progress: { total: 0, completed: 0 } });
            continue;
        }
        result.set(studentId, {
            plan: {
                name: inst.name,
                description: inst.description || "",
                status: inst.status,
                id: inst.id,
            },
            progress: {
                total: inst.training_days_count || 0,
                completed: completedByInstance.get(inst.id) || 0,
            },
        });
    }
    return result;
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
            "id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price, subscribed_weeks, prior_training_weeks, order_id, last_payment_order_id, payment_method",
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

    // 4. 批量获取 Plan 和 Progress 数据（1-2 queries instead of 2N queries）
    const planDetailByStudentId = await getStudentPlanDataBatch(coachRow.id, studentIds as string[]);

    // 5. 组装数据
    const students: StudentSubscription[] = (subs || []).map((sub) => {
        const studentId = sub.student_id;
        const profile = profileMap.get(studentId) || null;
        const view = studentViews.get(studentId);
        const detail = planDetailByStudentId.get(studentId);

        return {
            ...sub,
            monthly_price: fenToYuan(sub.monthly_price ?? 0),
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
