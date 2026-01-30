import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import type { ApiData } from "@/types/api";
import { fenToYuan } from "@/lib/moneyUtils";

export const dynamic = "force-dynamic";

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: "未登录" };
    if (!(session.user as { is_admin?: boolean })?.is_admin) return { ok: false as const, status: 403, message: "无权限" };
    return { ok: true as const };
}

/** 管理员：提现列表（含教练与支付宝信息），可筛 status */
export async function GET(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok) return NextResponse.json({ success: false, message: auth.message, data: null }, { status: auth.status });

    const url = new URL(req.url);
    const status = url.searchParams.get("status"); // pending | success | failed | cancelled | 空=全部
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 100);
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

    let q = serviceRoleSupabase
        .from("alipay_withdrawals")
        .select("id, coach_id, amount, fee, status, out_biz_no, alipay_order_id, confirmed_by_user_id, created_at, processed_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) q = q.eq("status", status);

    const { data: rawRows, error, count } = await q;

    if (error) return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });

    type Row = { coach_id: string; confirmed_by_user_id?: string | null };
    const rows = ((rawRows ?? []) as unknown) as Row[];

    const coachIds = [...new Set(rows.map((r) => r.coach_id))];
    if (coachIds.length === 0) {
        return NextResponse.json<ApiData<{ list: Row[]; total: number }>>({
            success: true,
            message: "ok",
            data: { list: rows, total: count ?? 0 },
        });
    }

    const { data: coaches } = await serviceRoleSupabase.from("coaches").select("id, name, user_id").in("id", coachIds);
    const coachUserIds = (coaches ?? []).map((c: { user_id: string }) => c.user_id).filter(Boolean);
    const { data: profiles } = coachUserIds.length
        ? await serviceRoleSupabase.from("user_profiles").select("user_id, nickname, full_name").in("user_id", coachUserIds)
        : { data: [] };
    const { data: accounts } = await serviceRoleSupabase.from("alipay_accounts").select("coach_id, payee_account, payee_type, real_name").in("coach_id", coachIds);

    const confirmedByUserIds = [...new Set(rows.map((r) => r.confirmed_by_user_id).filter((id): id is string => Boolean(id)))];
    const { data: confirmerProfiles } = confirmedByUserIds.length
        ? await serviceRoleSupabase.from("user_profiles").select("user_id, nickname, full_name").in("user_id", confirmedByUserIds)
        : { data: [] };

    const coachMap = new Map(
        (coaches ?? []).map((c: { id: string; name: string; user_id: string }) => [c.id, { name: c.name, user_id: c.user_id }])
    );
    const profileByUserId = new Map((profiles ?? []).map((p: { user_id: string; nickname: string | null; full_name: string | null }) => [p.user_id, { nickname: p.nickname, full_name: p.full_name }]));
    const confirmerNameByUserId = new Map((confirmerProfiles ?? []).map((p: { user_id: string; nickname: string | null; full_name: string | null }) => [p.user_id, p.nickname || p.full_name || p.user_id]));
    const accountByCoachId = new Map((accounts ?? []).map((a: { coach_id: string; payee_account: string; payee_type: string | null; real_name: string | null }) => [a.coach_id, { payee_account: a.payee_account, payee_type: a.payee_type, real_name: a.real_name }]));

    const list = rows.map((r) => {
        const coach = coachMap.get(r.coach_id);
        const profile = coach ? profileByUserId.get(coach.user_id) : null;
        const acc = accountByCoachId.get(r.coach_id);
        const displayName = profile?.nickname || profile?.full_name || coach?.name || "—";
        const confirmedByUserId = r.confirmed_by_user_id ?? null;
        const confirmedByName = confirmedByUserId ? (confirmerNameByUserId.get(confirmedByUserId) ?? null) : null;
        return {
            ...r,
            // 将金额从分转换为元返回给前端
            amount: fenToYuan((r as unknown as { amount: number }).amount ?? 0),
            fee: fenToYuan((r as unknown as { fee: number }).fee ?? 0),
            coach_name: displayName,
            coach_user_id: coach?.user_id ?? null,
            payee_account: acc?.payee_account ?? null,
            payee_type: acc?.payee_type ?? null,
            real_name: acc?.real_name ?? null,
            confirmed_by_user_id: confirmedByUserId,
            confirmed_by_name: confirmedByName,
        };
    });

    return NextResponse.json<ApiData<{ list: typeof list; total: number }>>({
        success: true,
        message: "ok",
        data: { list, total: count ?? 0 },
    });
}
