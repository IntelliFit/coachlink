import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { isMissingTableError } from "@/lib/coachFunnelEvents";
import { buildCoachFunnelReport, type CoachFunnelReport, type FunnelEventRecord } from "@/lib/coachFunnelReport";
import type { ApiData } from "@/types/api";

const ALLOWED_DAYS = [7, 14, 30, 90];
const DEFAULT_DAYS = 14;
const PAGE_SIZE = 1000;
const MAX_EVENTS = 100_000;

export type CoachFunnelResponse = {
    days: number;
    /** 迁移还没执行时表不存在，后台据此提示，而不是显示一片 0。 */
    migrationPending: boolean;
    truncated: boolean;
    report: CoachFunnelReport | null;
};

async function loadEvents(since: string) {
    const events: FunnelEventRecord[] = [];
    for (let from = 0; from < MAX_EVENTS; from += PAGE_SIZE) {
        const { data, error } = await (serviceRoleSupabase.from("coach_funnel_events" as any) as any)
            .select("event,coach_id,user_id,anon_id,reason,note,properties,created_at")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .range(from, from + PAGE_SIZE - 1);
        if (error) return { events, error, truncated: false };
        events.push(...((data || []) as FunnelEventRecord[]));
        if (!data || data.length < PAGE_SIZE) return { events, error: null, truncated: false };
    }
    return { events, error: null, truncated: true };
}

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({ success: false, message: "用户未登录", data: null }, { status: 401 });
    }
    if (!(session.user as { is_admin?: boolean }).is_admin) {
        return NextResponse.json({ success: false, message: "用户无权限", data: null }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const days = ALLOWED_DAYS.includes(Number(body?.days)) ? Number(body.days) : DEFAULT_DAYS;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { events, error: eventsError, truncated } = await loadEvents(since);
    if (eventsError) {
        if (isMissingTableError(eventsError)) {
            return NextResponse.json<ApiData<CoachFunnelResponse>>({
                success: true,
                message: "查询成功",
                data: { days, migrationPending: true, truncated: false, report: null },
            });
        }
        console.error("[admin/coach-funnel] load events failed:", eventsError);
        return NextResponse.json({ success: false, message: "查询转化数据失败", data: null }, { status: 500 });
    }

    const [coachRes, pricingRes, settlementRes] = await Promise.all([
        serviceRoleSupabase.from("coaches").select("id,user_id,name,huifu_id,huifu_apply_no,huifu_card_token").eq("status", "approved"),
        serviceRoleSupabase.from("coach_pricing").select("coach_id,products,pricings"),
        // 结算单在付款成功时创建，是「真正付了钱」的依据，含续费
        (serviceRoleSupabase.from("coach_subscription_settlements" as any) as any).select("coach_id").gte("created_at", since),
    ]);
    const failed = [coachRes, pricingRes, settlementRes].find((res) => res.error);
    if (failed?.error) {
        console.error("[admin/coach-funnel] load context failed:", failed.error);
        return NextResponse.json({ success: false, message: "查询转化数据失败", data: null }, { status: 500 });
    }

    const paidOrdersByCoach: Record<string, number> = {};
    for (const row of (settlementRes.data || []) as Array<{ coach_id: string | null }>) {
        if (row.coach_id) paidOrdersByCoach[row.coach_id] = (paidOrdersByCoach[row.coach_id] || 0) + 1;
    }

    return NextResponse.json<ApiData<CoachFunnelResponse>>({
        success: true,
        message: "查询成功",
        data: {
            days,
            migrationPending: false,
            truncated,
            report: buildCoachFunnelReport({
                events,
                coaches: (coachRes.data || []) as any,
                pricing: (pricingRes.data || []) as any,
                paidOrdersByCoach,
            }),
        },
    });
}
