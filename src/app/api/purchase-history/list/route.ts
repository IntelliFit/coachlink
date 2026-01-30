import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { fenToYuan } from '@/lib/moneyUtils';
import type { ApiData } from '@/types/api';

export interface PurchaseHistoryItem {
    id: string | number;
    orderType: 'subscription' | 'student_membership' | 'other';
    subject: string;
    amount: number;
    status: 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';
    createdAt: string;
    paidAt?: string;
    orderData?: any;
    // 订阅相关
    coachId?: string;
    coachName?: string;
    subscriptionId?: string;
    // 会员相关
    productKey?: string;
}

export interface PurchaseHistoryResponseDto {
    orders: PurchaseHistoryItem[];
    total: number;
}

export async function GET(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '用户未登录',
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    try {
        // 1. 获取支付宝订单（订阅和会员订单）
        const { data: alipayOrders, error: alipayError } = await serviceRoleSupabase
            .from('alipay_orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (alipayError) {
            console.error('获取支付宝订单失败:', alipayError);
        }

        // 2. 获取会员订单
        const { data: membershipOrders, error: membershipError } = await serviceRoleSupabase
            .from('student_membership_orders')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (membershipError) {
            console.error('获取会员订单失败:', membershipError);
        }

        // 3. 合并并格式化订单数据
        const orders: PurchaseHistoryItem[] = [];

        // 处理支付宝订单
        if (alipayOrders) {
            for (const order of alipayOrders) {
                const orderData = (order.order_data as any) || {};
                let coachName = '';
                let coachId = '';

                // 如果是订阅订单，获取教练信息
                if (order.order_type === 'subscription' && orderData.subscription_id) {
                    try {
                        const { data: subscription } = await serviceRoleSupabase
                            .from('coach_subscriptions')
                            .select('coach_id, coaches(name)')
                            .eq('id', orderData.subscription_id)
                            .single();
                        
                        if (subscription) {
                            coachId = subscription.coach_id;
                            coachName = (subscription.coaches as any)?.name || '教练';
                        }
                    } catch (e) {
                        console.error('获取教练信息失败:', e);
                    }
                }

                orders.push({
                    id: order.id,
                    orderType: (order.order_type as any) || 'other',
                    subject: order.subject,
                    amount: fenToYuan(order.total_amount ?? 0),
                    status: order.status as any,
                    createdAt: order.created_at,
                    paidAt: order.status === 'paid' ? order.updated_at : undefined,
                    orderData: orderData,
                    coachId,
                    coachName,
                    subscriptionId: orderData.subscription_id,
                });
            }
        }

        // 处理会员订单
        if (membershipOrders) {
            for (const order of membershipOrders) {
                orders.push({
                    id: order.id,
                    orderType: 'student_membership',
                    subject: `会员服务 - ${order.product_key}`,
                    amount: fenToYuan(order.amount ?? 0),
                    status: order.status as any,
                    createdAt: order.created_at,
                    paidAt: order.paid_at || undefined,
                    productKey: order.product_key,
                });
            }
        }

        // 4. 按创建时间排序
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        // 5. 获取总数
        const { count: alipayCount } = await serviceRoleSupabase
            .from('alipay_orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const { count: membershipCount } = await serviceRoleSupabase
            .from('student_membership_orders')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        const total = (alipayCount || 0) + (membershipCount || 0);

        return NextResponse.json<ApiData<PurchaseHistoryResponseDto>>({
            success: true,
            message: '获取成功',
            data: {
                orders: orders.slice(0, limit), // 确保不超过 limit
                total,
            },
        });
    } catch (error: any) {
        console.error('获取购买记录失败:', error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: error.message || '获取购买记录失败',
            data: null,
        }, { status: 500 });
    }
}
