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
import {
    applySubscriptionSort,
    loadOrderedActiveSubscriptionRefs,
    normalizeStudentSearch,
    orderRowsByIds,
    pageMatchedSubscriptionIds,
    searchStudentIdsByProfile,
    SortMode,
} from "./studentSearch";

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

function activeSubscriptionsQuery(coachUserId: string, options?: { count?: "exact" }) {
    // coaches!inner(user_id) 自带教练过滤（coaches.user_id 唯一），不必等 coach.id 回来再查
    return supabase
        .from("coach_subscriptions")
        .select(`${SUBSCRIPTION_COLUMNS}, coaches!inner(user_id)`, options)
        .eq("coaches.user_id", coachUserId)
        .eq("status", "active");
}

type SubscriptionPageRow = NonNullable<
    Awaited<ReturnType<typeof activeSubscriptionsQuery>>["data"]
>[number];
type SubscriptionPage = { rows: SubscriptionPageRow[]; total: number } | { error: string };

// PostgREST：offset 超过总行数时返回 416 / PGRST103，且不带 count
const RANGE_NOT_SATISFIABLE = "PGRST103";

async function listSubscriptionPage(params: {
    coachUserId: string;
    sortMode: SortMode;
    from: number;
    limit: number;
}): Promise<SubscriptionPage> {
    const { coachUserId, sortMode, from, limit } = params;
    const { data, count, error } = await applySubscriptionSort(
        activeSubscriptionsQuery(coachUserId, { count: "exact" }),
        sortMode,
    ).range(from, from + limit - 1);

    if (error?.code === RANGE_NOT_SATISFIABLE) {
        // 翻页越界：返回空页，但保留真实总数，前端据此纠正页码
        const { count: total, error: countError } = await supabase
            .from("coach_subscriptions")
            .select("id, coaches!inner(user_id)", { count: "exact", head: true })
            .eq("coaches.user_id", coachUserId)
            .eq("status", "active");
        if (countError) return { error: countError.message };
        return { rows: [], total: total || 0 };
    }
    if (error) return { error: error.message };
    return { rows: data || [], total: count || 0 };
}

async function searchSubscriptionPage(params: {
    coachUserId: string;
    q: string;
    sortMode: SortMode;
    from: number;
    limit: number;
}): Promise<SubscriptionPage> {
    const { coachUserId, q, sortMode, from, limit } = params;
    try {
        // 先取本教练排好序的订阅，只在这些学员里搜索，再在内存里分页：
        // 每条请求的 id 列表都有上界，不会因关键词宽泛而 URL 超长
        const refs = await loadOrderedActiveSubscriptionRefs(coachUserId, sortMode);
        const matched = await searchStudentIdsByProfile(q, refs.map((ref) => ref.student_id));
        const { total, pageIds } = pageMatchedSubscriptionIds(refs, matched, from, limit);
        if (pageIds.length === 0) return { rows: [], total };

        const { data, error } = await activeSubscriptionsQuery(coachUserId).in("id", pageIds);
        if (error) return { error: error.message };
        return { rows: orderRowsByIds(data || [], pageIds), total };
    } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
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

    const page = pagination?.page || 0;
    const limit = pagination?.limit || 20;
    const from = page * limit;
    const sortMode = sort?.mode || "subscription_created_desc";
    // 可选：按昵称/手机号搜索学员
    const q = normalizeStudentSearch(search);

    // 1. 教练身份与订阅页并行获取；非教练仍优先返回 400
    const [coachId, subscriptionPage] = await Promise.all([
        findCoachId(authResult.userId),
        q
            ? searchSubscriptionPage({ coachUserId: authResult.userId, q, sortMode, from, limit })
            : listSubscriptionPage({ coachUserId: authResult.userId, sortMode, from, limit }),
    ]);

    if (!coachId) return coachNotFound();

    if ("error" in subscriptionPage) {
        return NextResponse.json({ success: false, message: subscriptionPage.error }, {
            status: 500,
        });
    }

    // 空页（无匹配或翻页越界）：直接返回，不再查档案/计划
    if (subscriptionPage.rows.length === 0) {
        return NextResponse.json<ApiData<ListStudentsResponseDto>>({
            success: true,
            message: "ok",
            data: {
                students: [],
                pagination: { page, limit, total: subscriptionPage.total },
            },
        });
    }

    // 去掉仅用于过滤的 coaches 嵌入字段，保持返回结构不变
    const subs = subscriptionPage.rows.map(({ coaches: _coach, ...sub }) => sub);

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
            pagination: { page, limit, total: subscriptionPage.total },
        },
    });
}
