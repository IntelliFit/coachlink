import supabase from "@/lib/supabaseClient";
import { chunkIds, SUPABASE_MAX_ROWS } from "@/lib/supabaseKeysetPages";
import type { GetStudentsDto } from "./entity";

export type SortMode = NonNullable<GetStudentsDto["sort"]>["mode"];

export type SubscriptionRef = { id: string; student_id: string };

/** PostgREST 的 `or()` 过滤对逗号等字符较敏感；这里做一次轻量清洗，避免语法错误/性能问题 */
export function normalizeStudentSearch(search?: string | null): string {
    return (search || "")
        .trim()
        .replace(/[,\n\r\t]/g, " ")
        .slice(0, 64);
}

/** 固定且可控的排序：默认按订阅创建时间（created_at）排序，避免 updated_at 引起“顺序飘” */
export function applySubscriptionSort<Q extends { order: (column: string, options: any) => Q }>(
    query: Q,
    sortMode: SortMode,
): Q {
    if (sortMode === "subscription_created_asc") {
        return query
            .order("created_at", { ascending: true, nullsFirst: false })
            .order("id", { ascending: true });
    }
    if (sortMode === "subscription_updated_desc") {
        return query
            .order("updated_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false });
    }
    // default: subscription_created_desc
    return query
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false });
}

/**
 * 教练全部 active 订阅的 (id, student_id)，按列表排序返回。一个教练的订阅数
 * 很小（目前最多几十条），按 max-rows 分页读完。
 */
export async function loadOrderedActiveSubscriptionRefs(
    coachUserId: string,
    sortMode: SortMode,
): Promise<SubscriptionRef[]> {
    const refs: SubscriptionRef[] = [];
    for (let offset = 0; ; offset += SUPABASE_MAX_ROWS) {
        const query = supabase
            .from("coach_subscriptions")
            .select("id, student_id, coaches!inner(user_id)")
            .eq("coaches.user_id", coachUserId)
            .eq("status", "active");
        const { data, error } = await applySubscriptionSort(query, sortMode)
            .range(offset, offset + SUPABASE_MAX_ROWS - 1);
        if (error) throw new Error(`读取教练订阅失败: ${error.message}`);
        const page = data || [];
        refs.push(...page.map((row) => ({ id: String(row.id), student_id: String(row.student_id) })));
        if (page.length < SUPABASE_MAX_ROWS) return refs;
    }
}

/**
 * 只在本教练的学员里按昵称/手机号搜索。先全库搜索再 in(student_id) 会在宽泛
 * 关键词（如“1”）下拼出上千个 id、URL 超长而 400，且结果被 max-rows 截断在
 * 1000 条；按 100 个学员一块查，每块 URL 和结果都有上界。
 */
export async function searchStudentIdsByProfile(
    q: string,
    studentIds: readonly string[],
): Promise<Set<string>> {
    const results = await Promise.all(chunkIds(studentIds).map((chunk) =>
        supabase
            .from("user_profiles")
            .select("user_id")
            .in("user_id", chunk)
            .or(`nickname.ilike.%${q}%,phone.ilike.%${q}%`)
    ));
    const matched = new Set<string>();
    for (const { data, error } of results) {
        if (error) throw new Error(error.message);
        for (const row of data || []) {
            if (row.user_id) matched.add(String(row.user_id));
        }
    }
    return matched;
}

/** 在已排好序的订阅里按匹配学员过滤后分页。 */
export function pageMatchedSubscriptionIds(
    refs: readonly SubscriptionRef[],
    matchedStudentIds: ReadonlySet<string>,
    from: number,
    limit: number,
): { total: number; pageIds: string[] } {
    const matched = refs.filter((ref) => matchedStudentIds.has(ref.student_id));
    return {
        total: matched.length,
        pageIds: matched.slice(from, from + limit).map((ref) => ref.id),
    };
}

/** `in("id", ids)` 不保证顺序，按给定 id 顺序还原。 */
export function orderRowsByIds<T extends { id?: unknown }>(rows: readonly T[], ids: readonly string[]): T[] {
    const byId = new Map(rows.map((row) => [String(row.id), row]));
    return ids.map((id) => byId.get(id)).filter((row): row is T => Boolean(row));
}
