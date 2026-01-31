'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import type { CoachOrderDetail } from '@/app/api/coach/wallet/order/[orderId]/route';
import { format } from 'date-fns';

const ORDER_TYPE_LABEL: Record<string, string> = {
    subscription: '订阅',
    subscription_renew: '续费',
    student_membership: '会员',
};

const STATUS_LABEL: Record<string, string> = {
    pending: '待支付',
    paid: '已支付',
    closed: '已关闭',
    failed: '失败',
    refunded: '已退款',
};

export default function WalletOrderDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orderId = typeof params.orderId === 'string' ? params.orderId : params.orderId?.[0];
    const [order, setOrder] = useState<CoachOrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!orderId) {
            setError('无效的订单ID');
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`/api/coach/wallet/order/${orderId}`);
                const json = await res.json();
                if (cancelled) return;
                if (!json?.success || !json?.data) {
                    setError(json?.message || '加载失败');
                    return;
                }
                setOrder(json.data);
            } catch (e) {
                if (!cancelled) setError('网络错误');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [orderId]);

    if (loading) {
        return (
            <div className="container mx-auto p-4 max-w-lg">
                <Skeleton width="8rem" height="2rem" className="mb-4" />
                <Skeleton width="100%" height="4rem" className="mb-3" />
                <Skeleton width="100%" height="4rem" className="mb-3" />
                <Skeleton width="100%" height="4rem" />
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="container mx-auto p-4 max-w-lg">
                <p className="text-surface-600 mb-4">{error || '订单不存在'}</p>
                <Link href="/dashboard/wallet">
                    <Button label="返回我的钱包" icon="pi pi-arrow-left" className="p-button-text" />
                </Link>
            </div>
        );
    }

    const statusLabel = STATUS_LABEL[order.status] ?? order.status;
    const typeLabel = order.order_type ? ORDER_TYPE_LABEL[order.order_type] ?? order.order_type : '—';
    const userName = order.user_nickname || order.user_full_name || order.id?.slice(0, 8) + '…';

    return (
        <div className="container mx-auto p-4 max-w-lg">
            <div className="mb-6 flex items-center gap-2">
                <Link href="/dashboard/wallet">
                    <Button icon="pi pi-arrow-left" className="p-button-text p-button-sm" aria-label="返回" />
                </Link>
                <h1 className="text-xl font-bold text-surface-900">订单详情</h1>
            </div>

            <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">订单号</span>
                    <code className="text-surface-900 font-mono text-xs">{order.id}</code>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">商品/描述</span>
                    <span className="text-surface-900 text-right max-w-[60%]">{order.subject || '—'}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">类型</span>
                    <span className="text-surface-900">{typeLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">金额</span>
                    <span className="font-medium text-surface-900">¥ {order.total_amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">状态</span>
                    <span className="text-surface-900">{statusLabel}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">付款用户</span>
                    <span className="text-surface-900">{userName}</span>
                </div>
                <div className="flex justify-between text-sm">
                    <span className="text-surface-500">创建时间</span>
                    <span className="text-surface-900">{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm:ss')}</span>
                </div>
                {order.alipay_trade_no ? (
                    <div className="flex justify-between text-sm">
                        <span className="text-surface-500">支付宝交易号</span>
                        <code className="text-surface-600 font-mono text-xs">{order.alipay_trade_no}</code>
                    </div>
                ) : null}
            </div>

            <div className="mt-6">
                <Link href="/dashboard/wallet">
                    <Button label="返回我的钱包" icon="pi pi-wallet" className="p-button-outlined" />
                </Link>
            </div>
        </div>
    );
}
