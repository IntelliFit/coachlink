import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { GetAllCoachesDto } from "./entity";
import { sanitizeCoachTrack } from "@/lib/coachApplicationOptions";

const TRACK_SORT_ORDER = ["buddy", "growth", "professional"] as const;

function getTrackAffinityScore(track: unknown, preferredTrack: string | null) {
    if (!preferredTrack || typeof track !== "string") {
        return 0;
    }

    const preferredIndex = TRACK_SORT_ORDER.indexOf(preferredTrack as (typeof TRACK_SORT_ORDER)[number]);
    const currentIndex = TRACK_SORT_ORDER.indexOf(track as (typeof TRACK_SORT_ORDER)[number]);

    if (preferredIndex === -1 || currentIndex === -1) {
        return 0;
    }

    const distance = Math.abs(preferredIndex - currentIndex);
    return Math.max(0, 3 - distance);
}

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 10,
        search = '',
        specialty = 'all',
        coachTrack = '',
        preferredCoachTrack = '',
        serviceMode = '',
        targetStudentLevel = '',
    } = await req.json() as GetAllCoachesDto;

    const from = (page - 1) * limit;
    const to = from + limit - 1;
    const preferredTrackForSort =
        !coachTrack.trim() && preferredCoachTrack.trim()
            ? sanitizeCoachTrack(preferredCoachTrack)
            : null;

    // 构建查询
    let query = supabase
        .from("coaches")
        .select("*", { count: "exact" })
        .eq("status", "approved");

    // 搜索
    if (search.trim()) {
        // 使用 ilike 做模糊匹配（简单方案）：
        query = query.or(
            `name.ilike.%${search}%,title.ilike.%${search}%`
        );
    }

    // specialty 数组过滤
    if (specialty.trim() && specialty.trim() !== 'all') {
        query = query.contains("specialties", [specialty]);
    }
    if (coachTrack.trim() && coachTrack.trim() !== 'all') {
        query = query.eq("coach_track", coachTrack);
    }
    if (serviceMode.trim() && serviceMode.trim() !== 'all') {
        query = query.contains("service_modes", [serviceMode]);
    }
    if (targetStudentLevel.trim() && targetStudentLevel.trim() !== 'all') {
        query = query.contains("target_student_levels", [targetStudentLevel]);
    }

    /**
     * 发现页希望按“水平”展示（而不是仅按 coaches.rating）。
     *
     * 这里的水平暂定为一个稳定、可解释的默认排序：
     * 1) is_featured（置顶/推荐）优先
     * 2) 学员数（活跃订阅数）降序
     * 3) 平均评分降序
     * 4) years_experience 降序
     * 5) updated_at 降序
     * 6) id 升序兜底（保证排序稳定）
     *
     * 注意：studentCount / averageRating 需要聚合 coach_subscriptions / student_comments，
     * 为保证“跨页顺序稳定”，必须先聚合排序再分页。
     *
     * 为避免大数据量下拉取过多，这里加一个上限；超过上限则退化为旧逻辑（按 rating DB 排序分页）。
     */
    const MAX_RANKING_FETCH = 500;

    // 先取所有候选教练（带 count），后续在内存里聚合排序再分页
    const { data: coachesAll, error, count } = await query.range(0, MAX_RANKING_FETCH - 1);

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message
        });
    }

    // 超过上限：退化为旧逻辑（DB 按 rating 排序分页），避免拉取过多数据导致慢查询/高内存
    if ((count || 0) > MAX_RANKING_FETCH) {
        let fallbackQuery = supabase
            .from("coaches")
            .select("*", { count: "exact" })
            .eq("status", "approved");

        if (search.trim()) {
            fallbackQuery = fallbackQuery.or(
                `name.ilike.%${search}%,title.ilike.%${search}%`
            );
        }
        if (specialty.trim() && specialty.trim() !== 'all') {
            fallbackQuery = fallbackQuery.contains("specialties", [specialty]);
        }
        if (coachTrack.trim() && coachTrack.trim() !== 'all') {
            fallbackQuery = fallbackQuery.eq("coach_track", coachTrack);
        }
        if (serviceMode.trim() && serviceMode.trim() !== 'all') {
            fallbackQuery = fallbackQuery.contains("service_modes", [serviceMode]);
        }
        if (targetStudentLevel.trim() && targetStudentLevel.trim() !== 'all') {
            fallbackQuery = fallbackQuery.contains("target_student_levels", [targetStudentLevel]);
        }

        const { data: coaches, error: fallbackError, count: fallbackCount } = await fallbackQuery
            .order("rating", { ascending: false })
            .range(from, to);

        if (fallbackError) {
            return NextResponse.json({
                success: false,
                message: fallbackError.message
            });
        }

        // 批量补充 stats（避免 N+1）
        const ids = (coaches || []).map((c: any) => c.id).filter(Boolean);
        const studentCountMap = new Map<string, number>();
        const avgRatingMap = new Map<string, number>();

        if (ids.length > 0) {
            const { data: subs } = await supabase
                .from('coach_subscriptions')
                .select('coach_id')
                .in('coach_id', ids)
                .eq('status', 'active');
            for (const s of (subs || []) as any[]) {
                const id = s.coach_id as string;
                studentCountMap.set(id, (studentCountMap.get(id) || 0) + 1);
            }

            const { data: reviews } = await supabase
                .from('student_comments')
                .select('coach_id,rating')
                .in('coach_id', ids);
            const sumMap = new Map<string, number>();
            const cntMap = new Map<string, number>();
            for (const r of (reviews || []) as any[]) {
                const id = r.coach_id as string;
                const rating = Number(r.rating || 0);
                sumMap.set(id, (sumMap.get(id) || 0) + rating);
                cntMap.set(id, (cntMap.get(id) || 0) + 1);
            }
            for (const id of ids) {
                const c = cntMap.get(id) || 0;
                const s = sumMap.get(id) || 0;
                avgRatingMap.set(id, c > 0 ? parseFloat((s / c).toFixed(1)) : 0);
            }
        }

        const coachesWithStats = (coaches || []).map((coach: any) => ({
            ...coach,
            studentCount: studentCountMap.get(coach.id) || 0,
            averageRating: avgRatingMap.get(coach.id) || 0,
        }));

        return NextResponse.json({
            success: true,
            message: "获取成功",
            data: {
                coaches: coachesWithStats,
                count: fallbackCount || 0,
                pagination: { page, limit }
            }
        });
    }

    const coaches = coachesAll || [];
    const ids = coaches.map((c: any) => c.id).filter(Boolean);

    // 批量聚合：学员数量（活跃订阅数）
    const studentCountMap = new Map<string, number>();
    if (ids.length > 0) {
        const { data: subs } = await supabase
            .from('coach_subscriptions')
            .select('coach_id')
            .in('coach_id', ids)
            .eq('status', 'active');
        for (const s of (subs || []) as any[]) {
            const id = s.coach_id as string;
            studentCountMap.set(id, (studentCountMap.get(id) || 0) + 1);
        }
    }

    // 批量聚合：平均评分
    const avgRatingMap = new Map<string, number>();
    if (ids.length > 0) {
        const { data: reviews } = await supabase
            .from('student_comments')
            .select('coach_id,rating')
            .in('coach_id', ids);
        const sumMap = new Map<string, number>();
        const cntMap = new Map<string, number>();
        for (const r of (reviews || []) as any[]) {
            const id = r.coach_id as string;
            const rating = Number(r.rating || 0);
            sumMap.set(id, (sumMap.get(id) || 0) + rating);
            cntMap.set(id, (cntMap.get(id) || 0) + 1);
        }
        for (const id of ids) {
            const c = cntMap.get(id) || 0;
            const s = sumMap.get(id) || 0;
            avgRatingMap.set(id, c > 0 ? parseFloat((s / c).toFixed(1)) : 0);
        }
    }

    const coachesWithStats = coaches.map((coach: any) => ({
        ...coach,
        studentCount: studentCountMap.get(coach.id) || 0,
        averageRating: avgRatingMap.get(coach.id) || 0,
    }));

    // 排序：先“水平”后分页（保证跨页顺序稳定）
    const sorted = coachesWithStats.sort((a: any, b: any) => {
        // 1) 优先将 "MAX" 放在最后
        const aIsMax = a.name === 'MAX' ? 1 : 0;
        const bIsMax = b.name === 'MAX' ? 1 : 0;
        if (aIsMax !== bIsMax) return aIsMax - bIsMax;

        // 2) is_featured（置顶/推荐）优先
        const af = a.is_featured ? 1 : 0;
        const bf = b.is_featured ? 1 : 0;
        if (bf !== af) return bf - af;

        // 3) 若前端未显式筛选层级，则优先展示更贴近用户当前阶段的教练层级
        const at = getTrackAffinityScore(a.coach_track, preferredTrackForSort);
        const bt = getTrackAffinityScore(b.coach_track, preferredTrackForSort);
        if (bt !== at) return bt - at;

        const as = Number(a.studentCount || 0);
        const bs = Number(b.studentCount || 0);
        if (bs !== as) return bs - as;

        const ar = Number(a.averageRating ?? a.rating ?? 0);
        const br = Number(b.averageRating ?? b.rating ?? 0);
        if (br !== ar) return br - ar;

        const ay = Number(a.years_experience || 0);
        const by = Number(b.years_experience || 0);
        if (by !== ay) return by - ay;

        const au = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bu = b.updated_at ? Date.parse(b.updated_at) : 0;
        if (bu !== au) return bu - au;

        return String(a.id).localeCompare(String(b.id));
    });

    const paged = sorted.slice(from, to + 1);

    return NextResponse.json({
        success: true,
        message: "获取成功",
        data: {
            coaches: paged,
            count,
            pagination: { page, limit }
        }
    });
}
