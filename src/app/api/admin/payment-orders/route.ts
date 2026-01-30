import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type {
    ListPaymentOrdersDto,
    ListPaymentOrdersResponseDto,
    PaymentOrderWithUser,
} from './entity';

function requireAdmin(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session?.user?.id) return { ok: false as const, status: 401, message: '未登录' };
    if (!(session.user as { is_admin?: boolean })?.is_admin)
        return { ok: false as const, status: 403, message: '无权限' };
    return { ok: true as const };
}

/** 管理员：支付宝订单列表（账单） */
export async function POST(req: Request) {
    const session = await getServerSession();
    const auth = requireAdmin(session);
    if (!auth.ok)
        return NextResponse.json({ success: false, message: auth.message, data: null }, { status: auth.status });

    const body = (await req.json().catch(() => ({}))) as ListPaymentOrdersDto;
    const page = Math.max(1, body.page ?? 1);
    const limit = Math.min(50, Math.max(1, body.limit ?? 20));
    const offset = (page - 1) * limit;

    let q = serviceRoleSupabase
        .from('alipay_orders')
        .select('id, user_id, subject, total_amount, status, order_type, order_data, alipay_trade_no, created_at, updated_at', {
            count: 'exact',
        })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (body.status) {
        q = q.eq('status', body.status);
    }
    if (body.orderType) {
        q = q.eq('order_type', body.orderType);
    }

    const { data: rows, error, count } = await q;

    if (error) {
        return NextResponse.json({ success: false, message: error.message, data: null }, { status: 500 });
    }

    const orders = (rows ?? []) as PaymentOrderWithUser[];
    const userIds = [...new Set(orders.map((o) => o.user_id).filter(Boolean))];

    if (userIds.length > 0) {
        const { data: profiles } = await serviceRoleSupabase
            .from('user_profiles')
            .select('user_id, nickname, full_name')
            .in('user_id', userIds);

        const profileMap = new Map(
            (profiles ?? []).map((p: { user_id: string; nickname: string | null; full_name: string | null }) => [
                p.user_id,
                { nickname: p.nickname, full_name: p.full_name },
            ])
        );

        for (const order of orders) {
            const p = profileMap.get(order.user_id);
            order.user_nickname = p?.nickname ?? null;
            order.user_full_name = p?.full_name ?? null;
        }
    }

    return NextResponse.json<ApiData<ListPaymentOrdersResponseDto>>({
        success: true,
        message: 'ok',
        data: {
            orders,
            total: count ?? 0,
            page,
            limit,
        },
    });
}
