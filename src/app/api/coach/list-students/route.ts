import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import { fenToYuan } from "@/lib/moneyUtils";
import {
    GetStudentsDto,
    ListStudentsResponseDto,
    StudentSubscription,
} from "./entity";
import { UserProfilesRow } from "@/types";
import { ApiData } from "@/types/api";
import {
    selectCarryoverSubscriptionIds,
    SubscriptionCarryoverLookup,
    SubscriptionCarryoverSummary,
    summarizeSubscriptionCarryoverBatch,
} from "@/lib/subscriptionCarryover";
import { deriveSubscriptionEntitlementState } from "@/lib/subscriptionEntitlementModel";
import { loadStudentPageData } from "./studentPageData";

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

function deriveProjectedEndDate(params: {
    subscription: any;
    carryover: SubscriptionCarryoverSummary;
    instanceMeta?: {
        instance_id?: string;
        created_at?: string | null;
        status?: string | null;
        training_days: any[];
        start_execution_day: number;
        executions: Array<{ day_index: number; status: string | null }>;
    } | null;
}) {
    const { subscription, instanceMeta, carryover } = params;
    const model = deriveSubscriptionEntitlementState({
        subscription,
        planInstance: instanceMeta
            ? {
                id: instanceMeta.instance_id,
                status: instanceMeta.status || null,
                training_days: instanceMeta.training_days,
                start_execution_day: instanceMeta.start_execution_day,
            }
            : null,
        executions: instanceMeta?.executions || [],
        effectiveSubscribedWeeks: carryover.remainingWeeks,
    });
    return model.displayEndDate || subscription?.end_date || null;
}

const SUBSCRIPTION_COLUMNS =
    "id, student_id, tier, status, start_date, end_date, updated_at, subscribe_data, monthly_price, subscribed_weeks, prior_training_weeks, created_at, order_id, last_payment_order_id, payment_method";

async function findCoachId(userId: string): Promise<string | null> {
    const { data: coachRow } = await supabase
        .from("coaches")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
    return coachRow?.id || null;
}

function coachNotFound() {
    return NextResponse.json(
        { success: false, message: "未找到教练身份" },
        { status: 400 },
    );
}

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({ success: false, message: "未登录" }, {
            status: 401,
        });
    }

    const { pagination, search, sort } = await req.json() as GetStudentsDto;

    // 1. 获取教练身份。与订阅查询并行发出：订阅查询通过 coaches!inner(user_id)
    // 自带教练过滤（coaches.user_id 唯一），不必等 coach.id 回来再查。
    const coachIdPromise = findCoachId(authResult.userId);

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

        // 非教练仍优先返回 400，与先查教练再搜索时的响应一致
        if (!(await coachIdPromise)) return coachNotFound();

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
        .select(`${SUBSCRIPTION_COLUMNS}, coaches!inner(user_id)`, { count: "exact" })
        .eq("coaches.user_id", authResult.userId)
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

    const [coachId, { data: subRows, count, error: subsErr }] = await Promise.all([
        coachIdPromise,
        subsQuery.range(from, to),
    ]);

    if (!coachId) return coachNotFound();

    if (subsErr) {
        return NextResponse.json({ success: false, message: subsErr.message }, {
            status: 500,
        });
    }

    // 去掉仅用于过滤的 coaches 嵌入字段，保持返回结构不变
    const subs = (subRows || []).map(({ coaches: _coach, ...sub }) => sub);

    const studentIds = Array.from(
        new Set(subs.map((s) => s.student_id)),
    ).filter(Boolean) as string[];

    // 3. 档案、视频统计、计划数据并行发出。计划数据把“当前计划”和“历史计划
    // （carryover）”合并成一次实例查询 + 一次执行记录查询：两者的 training_days
    // 高度重叠，分开查会把同一批大字段下载两遍。按当前实例排除/截止时间的
    // carryover 过滤在内存里做（见 summarizeSubscriptionCarryoverBatch）。
    const carryoverSubscriptionIds = new Set(selectCarryoverSubscriptionIds(
        subs.map((sub) => ({
            subscriptionId: String(sub.id || ""),
            subscribedWeeks: Number(sub.subscribed_weeks || 0),
        })),
    ));
    const [profilesRows, studentViews, { planDetailByStudentId, carryoverHistory }] = await Promise.all([
        supabase.from("user_profiles").select("*").in("user_id", studentIds),
        getVideoStats(studentIds),
        loadStudentPageData({
            coachId,
            refs: subs.map((sub) => ({
                subscriptionId: String(sub.id || ""),
                studentId: String(sub.student_id || ""),
                loadCarryover: carryoverSubscriptionIds.has(String(sub.id || "")),
            })),
        }),
    ]);

    const profileMap = new Map(
        (profilesRows.data || []).map((p) => [p.user_id, p]),
    );

    const carryoverLookups: SubscriptionCarryoverLookup[] = subs.map((sub) => {
        const detail = planDetailByStudentId.get(sub.student_id);
        const instanceMeta = detail?.instanceMeta || null;
        return {
            subscriptionId: String(sub.id || ""),
            subscribedWeeks: Number(sub.subscribed_weeks || 0),
            excludeInstanceId: String(instanceMeta?.instance_id || ""),
            createdBefore: instanceMeta?.created_at || null,
            subscriptionStartDate: sub.start_date || null,
        };
    });
    const carryoverBySubscriptionId = summarizeSubscriptionCarryoverBatch(
        carryoverLookups,
        carryoverHistory,
    );

    // 4. 组装数据
    const students: StudentSubscription[] = subs.map((sub) => {
        const studentId = sub.student_id;
        const profile = profileMap.get(studentId) || null;
        const view = studentViews.get(studentId);
        const detail = planDetailByStudentId.get(studentId);
        const carryover = carryoverBySubscriptionId.get(String(sub.id)) || {
            purchasedWeeks: Number(sub.subscribed_weeks || 0),
            progressedDayIndex: 0,
            progressedWeeks: 0,
            remainingWeeks: Number(sub.subscribed_weeks || 0),
            sourceInstanceId: null,
            exhausted: Number(sub.subscribed_weeks || 0) <= 0,
        };
        const projectedEndDate = deriveProjectedEndDate({
            subscription: sub,
            instanceMeta: (detail as any)?.instanceMeta || null,
            carryover,
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
