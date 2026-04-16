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
import { deriveProjectedSubscriptionEndDate } from "@/lib/subscriptionEstimatedEndDate";
import { getSubscriptionCarryoverSummary } from "@/lib/subscriptionCarryover";

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
            "id, name, description, status, rest_days_count, training_days_count, start_execution_day, student_id, created_at, training_days",
        )
        .eq("coach_id", coachId)
        .in("student_id", studentIds)
        // 排除已归档实例，优先展示当前进行中计划；没有进行中时再回退到已完成
        .in("status", ["active", "paused", "completed"])
        .order("created_at", { ascending: false });

    // 选取优先级：active/paused > completed（按 created_at desc）
    const latestActiveByStudent = new Map<string, any>();
    const latestCompletedByStudent = new Map<string, any>();
    for (const inst of instances || []) {
        if (!inst?.student_id) continue;
        if (inst.status === "active" || inst.status === "paused") {
            if (!latestActiveByStudent.has(inst.student_id)) {
                latestActiveByStudent.set(inst.student_id, inst);
            }
            continue;
        }
        if (inst.status === "completed") {
            if (!latestCompletedByStudent.has(inst.student_id)) {
                latestCompletedByStudent.set(inst.student_id, inst);
            }
        }
    }

    // 2) Batch fetch completed executions for these instances and count in memory
    const instanceIds = Array.from(
        new Map(
            Array.from(latestActiveByStudent.values())
                .concat(Array.from(latestCompletedByStudent.values()))
                .map((i) => [i.id, i]),
        ).values(),
    )
        .map((i) => i.id)
        .filter(Boolean);
    const completedByInstance = new Map<string, number>();
    const executionsByInstance = new Map<string, Array<{ day_index: number; status: string | null }>>();
    if (instanceIds.length > 0) {
        const { data: execs } = await supabase
            .from("plan_instance_executions")
            .select("instance_id, day_index, status")
            .in("instance_id", instanceIds)
            .eq("status", "completed");

        for (const e of execs || []) {
            const iid = (e as any).instance_id as string;
            completedByInstance.set(iid, (completedByInstance.get(iid) || 0) + 1);
            const list = executionsByInstance.get(iid) || [];
            list.push({
                day_index: Number((e as any).day_index || 0),
                status: String((e as any).status || ""),
            });
            executionsByInstance.set(iid, list);
        }
    }

    // 3) Assemble result map
    const result = new Map<string, { plan: any; progress: any; instanceMeta?: any }>();
    for (const studentId of studentIds) {
        const inst = latestActiveByStudent.get(studentId) || latestCompletedByStudent.get(studentId);
        if (!inst) {
            result.set(studentId, { plan: null, progress: { total: 0, completed: 0 } });
            continue;
        }
        const startExecutionDay = Number(inst.start_execution_day || 1);
        const trainingDayTotal = Array.isArray(inst.training_days)
            ? inst.training_days.filter((day: any) => {
                const dayIndex = Number(day?.dayIndex ?? day?.day_index ?? 0);
                return dayIndex >= startExecutionDay && day?.type === "training";
            }).length
            : Number(inst.training_days_count || 0);
        const completedCount = completedByInstance.get(inst.id) || 0;
        const isLogicallyCompleted = trainingDayTotal > 0 &&
            completedCount >= trainingDayTotal;
        const derivedStatus = inst.status === "active" && isLogicallyCompleted
            ? "completed"
            : inst.status;

        result.set(studentId, {
            plan: {
                name: inst.name,
                description: inst.description || "",
                status: derivedStatus,
                raw_status: inst.status,
                is_logically_completed: isLogicallyCompleted,
                id: inst.id,
            },
            progress: {
                total: trainingDayTotal,
                completed: completedCount,
            },
            instanceMeta: {
                instance_id: inst.id,
                created_at: inst.created_at || null,
                training_days: Array.isArray(inst.training_days) ? inst.training_days : [],
                start_execution_day: startExecutionDay,
                executions: executionsByInstance.get(inst.id) || [],
            },
        });
    }
    return result;
}

async function deriveProjectedEndDate(params: {
    subscription: any;
    instanceMeta?: {
        instance_id?: string;
        created_at?: string | null;
        training_days: any[];
        start_execution_day: number;
        executions: Array<{ day_index: number; status: string | null }>;
    } | null;
}) {
    const { subscription, instanceMeta } = params;
    const carryover = await getSubscriptionCarryoverSummary({
        subscriptionId: String(subscription?.id || ""),
        subscribedWeeks: Number(subscription?.subscribed_weeks || 0),
        excludeInstanceId: String(instanceMeta?.instance_id || ""),
        createdBefore: instanceMeta?.created_at || null,
    });
    const projectedEndDate = deriveProjectedSubscriptionEndDate({
        startDate: subscription?.start_date || null,
        subscribedWeeks: subscription?.subscribed_weeks || null,
        effectiveSubscribedWeeks: carryover.remainingWeeks,
        trainingDays: instanceMeta?.training_days || [],
        startExecutionDay: instanceMeta?.start_execution_day || 1,
        executions: instanceMeta?.executions || [],
    });
    return projectedEndDate || subscription?.end_date || null;
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "未登录" }, {
            status: 401,
        });
    }

    const { pagination, search, sort } = await req.json() as GetStudentsDto;

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

    // 2.1 可选：按昵称/手机号搜索学员（先在 user_profiles 找 user_id，再 in 查询订阅）
    let filteredStudentIds: string[] | null = null;
    // PostgREST 的 `or()` 过滤对逗号等字符较敏感；这里做一次轻量清洗，避免语法错误/性能问题
    const q = (search || "")
        .trim()
        .replace(/[,\n\r\t]/g, " ")
        .slice(0, 64);
    if (q) {
        const { data: matchedProfiles, error: profileErr } = await supabase
            .from("user_profiles")
            .select("user_id")
            .or(`nickname.ilike.%${q}%,phone.ilike.%${q}%`)
            .limit(5000);

        if (profileErr) {
            return NextResponse.json({ success: false, message: profileErr.message }, { status: 500 });
        }

        filteredStudentIds = Array.from(
            new Set((matchedProfiles || []).map((p: any) => p.user_id).filter(Boolean)),
        );

        // 没有任何匹配：直接返回空列表（避免走订阅查询）
        if (filteredStudentIds.length === 0) {
            return NextResponse.json<ApiData<ListStudentsResponseDto>>({
                success: true,
                message: "ok",
                data: {
                    students: [],
                    pagination: { page, limit, total: 0 },
                },
            });
        }
    }

    // 2.2 固定且可控的排序：默认按订阅创建时间（created_at）排序，避免 updated_at 引起“顺序飘”
    const sortMode = sort?.mode || "subscription_created_desc";
    let subsQuery = supabase
        .from("coach_subscriptions")
        .select(
            "id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price, subscribed_weeks, prior_training_weeks, created_at, order_id, last_payment_order_id, payment_method",
            { count: "exact" },
        )
        .eq("coach_id", coachRow.id)
        .eq("status", "active");

    if (filteredStudentIds) {
        subsQuery = subsQuery.in("student_id", filteredStudentIds);
    }

    if (sortMode === "subscription_created_asc") {
        subsQuery = subsQuery
            .order("created_at", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true });
    } else if (sortMode === "subscription_updated_desc") {
        subsQuery = subsQuery
            .order("updated_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
    } else {
        // default: subscription_created_desc
        subsQuery = subsQuery
            .order("created_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
    }

    const { data: subs, count, error: subsErr } = await subsQuery.range(from, to);

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
    const students: StudentSubscription[] = await Promise.all((subs || []).map(async (sub) => {
        const studentId = sub.student_id;
        const profile = profileMap.get(studentId) || null;
        const view = studentViews.get(studentId);
        const detail = planDetailByStudentId.get(studentId);
        const projectedEndDate = await deriveProjectedEndDate({
            subscription: sub,
            instanceMeta: (detail as any)?.instanceMeta || null,
        });

        return {
            ...sub,
            monthly_price: fenToYuan(sub.monthly_price ?? 0),
            tier: Number(sub.tier), // 确保类型为 number
            end_date: projectedEndDate,
            profile,
            uploaded: view?.uploaded || 0,
            reviewed: view?.reviewed || 0,
            plan: detail?.plan || null, // 对应实例中的 status, name 等
            progress: detail?.progress || { total: 0, completed: 0 },
        } as unknown as StudentSubscription;
    }));

    return NextResponse.json<ApiData<ListStudentsResponseDto>>({
        success: true,
        message: "ok",
        data: {
            students,
            pagination: { page, limit, total: count || 0 },
        },
    });
}
