'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { Dropdown } from 'primereact/dropdown';
import { Tag } from 'primereact/tag';
import { adminService } from '@/app/service/adminService';
import { useToastContext } from '@/context/ToastContext';
import type { PaymentOrderWithUser } from '@/app/api/admin/payment-orders/entity';
import { formatBeijingDate } from '@/lib/beijingTime';

const STATUS_OPTIONS = [
    { label: '全部状态', value: null },
    { label: '待支付', value: 'pending' },
    { label: '已支付', value: 'paid' },
    { label: '已关闭', value: 'closed' },
    { label: '失败', value: 'failed' },
    { label: '已退款', value: 'refunded' },
];

const ORDER_TYPE_OPTIONS = [
    { label: '全部类型', value: null },
    { label: '订阅', value: 'subscription' },
    { label: '续费', value: 'subscription_renew' },
    { label: '教练订阅', value: 'coach_subscription' },
    { label: '教练续费', value: 'coach_subscription_renew' },
    { label: '会员', value: 'student_membership' },
];

function statusTag(status: string) {
    const severity =
        status === 'paid'
            ? 'success'
            : status === 'pending'
              ? 'warning'
              : status === 'refunded'
                ? 'info'
                : 'danger';
    const label =
        status === 'paid'
            ? '已支付'
            : status === 'pending'
              ? '待支付'
              : status === 'refunded'
                ? '已退款'
                : status === 'closed'
                  ? '已关闭'
                  : status === 'failed'
                    ? '失败'
                  : status;
    return <Tag severity={severity} value={label} />;
}

function orderTypeLabel(type: string | null) {
    if (!type) return '—';
    const map: Record<string, string> = {
        subscription: '订阅',
        subscription_renew: '续费',
        coach_subscription: '教练订阅',
        coach_subscription_renew: '教练续费',
        student_membership: '会员',
    };
    return map[type] ?? type;
}

function providerLabel(provider: string | null | undefined) {
    const value = String(provider || '').toLowerCase();
    if (value === 'huifu_alipay') return '汇付支付宝';
    if (value === 'wechat') return '汇付微信';
    if (value === 'alipay') return '支付宝直连';
    return provider || '—';
}

function settlementLabel(status: string | undefined) {
    const map: Record<string, string> = {
        pending: '待分账',
        processing: '处理中',
        split_success: '已分账',
        split_failed: '分账失败',
        wallet_credited: '已入账',
    };
    return status ? map[status] ?? status : '—';
}

function settlementSeverity(status: string | undefined) {
    if (status === 'wallet_credited' || status === 'split_success') return 'success';
    if (status === 'processing' || status === 'pending') return 'warning';
    if (status === 'split_failed') return 'danger';
    return 'info';
}

function isHuifuOrder(row: PaymentOrderWithUser) {
    const provider = String(row.payment_provider || '').toLowerCase();
    const orderData = (row.order_data || {}) as Record<string, unknown>;
    return provider.includes('huifu') || provider === 'wechat' || orderData.requires_huifu_split === true;
}

export default function AdminPaymentsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [orders, setOrders] = useState<PaymentOrderWithUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [orderTypeFilter, setOrderTypeFilter] = useState<string | null>(null);
    const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null);
    const [retryingSettlementOrderId, setRetryingSettlementOrderId] = useState<string | null>(null);
    const [reconcilingSettlementOrderId, setReconcilingSettlementOrderId] = useState<string | null>(null);

    const loadOrders = async (page: number = 1, limit: number = rows) => {
        try {
            setLoading(true);
            const res = await adminService.listPaymentOrders({
                page,
                limit,
                status: (statusFilter as 'pending' | 'paid' | 'closed' | 'failed' | 'refunded') || undefined,
                orderType: orderTypeFilter || undefined,
            });
            if (res) {
                setOrders(res.orders);
                setTotalRecords(res.total);
            }
        } catch (error) {
            console.error('加载账单失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载账单数据' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }
        setFirst(0);
        loadOrders(1, rows);
    }, [session, status, statusFilter, orderTypeFilter]);

    const handleRefund = async (order: PaymentOrderWithUser) => {
        if (order.status !== 'paid') return;
        if (isHuifuOrder(order)) {
            showToast({ severity: 'warn', summary: '需要人工处理', detail: '汇付/分账订单不能走支付宝直连退款，请先按正确通道处理网关退款。' });
            return;
        }
        if (!confirm(`确定对订单 ${order.id.substring(0, 8)}... 执行退款吗？订阅类订单将同步取消订阅并扣减教练钱包。`))
            return;
        setRefundingOrderId(order.id);
        try {
            const res = await fetch('/api/payment/alipay/refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, refundReason: '管理员操作退款' }),
            });
            const data = await res.json();
            if (data?.success) {
                showToast({ severity: 'success', summary: '退款成功', detail: '已同步更新订单及关联订阅' });
                loadOrders(Math.floor(first / rows) + 1, rows);
            } else {
                showToast({ severity: 'error', summary: '退款失败', detail: data?.message || '请稍后重试' });
            }
        } catch (e: unknown) {
            showToast({ severity: 'error', summary: '退款失败', detail: e instanceof Error ? e.message : '网络错误' });
        } finally {
            setRefundingOrderId(null);
        }
    };

    const handleRetrySettlement = async (order: PaymentOrderWithUser) => {
        if (order.settlement?.status !== 'split_failed') return;
        if (!confirm(`确定对订单 ${order.id.substring(0, 8)}... 重新发起汇付分账吗？这会调用真实的汇付余额支付接口。`))
            return;

        setRetryingSettlementOrderId(order.id);
        try {
            const res = await fetch('/api/admin/coach-subscription-settlements/retry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, confirm: 'RETRY_HUIFU_SPLIT' }),
            });
            const data = await res.json();
            if (data?.success) {
                showToast({ severity: 'success', summary: '分账已处理', detail: `当前状态：${settlementLabel(data.data?.splitStatus)}` });
                loadOrders(Math.floor(first / rows) + 1, rows);
            } else {
                showToast({ severity: 'error', summary: '分账重试失败', detail: data?.message || '请稍后重试' });
            }
        } catch (e: unknown) {
            showToast({ severity: 'error', summary: '分账重试失败', detail: e instanceof Error ? e.message : '网络错误' });
        } finally {
            setRetryingSettlementOrderId(null);
        }
    };

    const handleReconcileSettlement = async (order: PaymentOrderWithUser) => {
        if (order.settlement?.status !== 'processing') return;
        setReconcilingSettlementOrderId(order.id);
        try {
            const res = await fetch('/api/admin/coach-subscription-settlements/reconcile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: order.id, confirm: 'QUERY_HUIFU_SPLIT' }),
            });
            const data = await res.json();
            if (data?.success) {
                showToast({ severity: 'success', summary: '分账查询完成', detail: `当前状态：${settlementLabel(data.data?.splitStatus)}` });
                loadOrders(Math.floor(first / rows) + 1, rows);
            } else {
                showToast({ severity: 'error', summary: '分账查询失败', detail: data?.message || '请稍后重试' });
            }
        } catch (e: unknown) {
            showToast({ severity: 'error', summary: '分账查询失败', detail: e instanceof Error ? e.message : '网络错误' });
        } finally {
            setReconcilingSettlementOrderId(null);
        }
    };

    const onPage = (event: { first?: number; rows?: number; page?: number }) => {
        const firstVal = event.first ?? 0;
        const rowsVal = event.rows ?? rows;
        const pageVal = event.page ?? Math.floor(firstVal / rowsVal);
        setFirst(firstVal);
        setRows(rowsVal);
        loadOrders(pageVal + 1, rowsVal);
    };

    const userTemplate = (row: PaymentOrderWithUser) => (
        <span>{row.user_nickname || row.user_full_name || row.user_id || '—'}</span>
    );

    const amountTemplate = (row: PaymentOrderWithUser) => (
        <div className="text-right font-medium">¥{(row.total_amount ?? 0).toFixed(2)}</div>
    );

    const dateTemplate = (row: PaymentOrderWithUser) =>
        formatBeijingDate(row.created_at, 'zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });

    const providerTemplate = (row: PaymentOrderWithUser) => (
        <span className="text-sm">{providerLabel(row.payment_provider)}</span>
    );

    const settlementTemplate = (row: PaymentOrderWithUser) => {
        if (loading) return <Skeleton width="80px" height="1.5rem" />;
        if (!row.settlement) return <span className="text-surface-400 text-xs">—</span>;
        return (
            <div className="flex flex-col gap-1 max-w-[180px]">
                <Tag
                    severity={settlementSeverity(row.settlement.status) as any}
                    value={settlementLabel(row.settlement.status)}
                />
                {row.settlement.error_message && (
                    <span className="text-xs text-red-500 truncate" title={row.settlement.error_message}>
                        {row.settlement.error_message}
                    </span>
                )}
            </div>
        );
    };

    const actionTemplate = (row: PaymentOrderWithUser) => {
        if (loading) return <Skeleton width="60px" height="1.5rem" />;
        const canRetrySettlement = row.settlement?.status === 'split_failed';
        const canReconcileSettlement = row.settlement?.status === 'processing';
        const canRefund = row.status === 'paid' && !isHuifuOrder(row);
        if (!canRetrySettlement && !canReconcileSettlement && !canRefund) return <span className="text-surface-400 text-xs">—</span>;
        return (
            <div className="flex gap-2">
                {canReconcileSettlement && (
                    <Button
                        label="查询分账"
                        icon="pi pi-search"
                        size="small"
                        className="p-button-text p-button-sm text-blue-600"
                        loading={reconcilingSettlementOrderId === row.id}
                        onClick={() => handleReconcileSettlement(row)}
                    />
                )}
                {canRetrySettlement && (
                    <Button
                        label="重试分账"
                        icon="pi pi-refresh"
                        size="small"
                        className="p-button-text p-button-sm text-red-600"
                        loading={retryingSettlementOrderId === row.id}
                        onClick={() => handleRetrySettlement(row)}
                    />
                )}
                {canRefund && (
                    <Button
                        label="退款"
                        icon="pi pi-undo"
                        size="small"
                        className="p-button-text p-button-sm text-amber-600"
                        loading={refundingOrderId === row.id}
                        onClick={() => handleRefund(row)}
                    />
                )}
            </div>
        );
    };

    const skeletonData = Array.from({ length: rows }).map((_, i) => ({
        id: `sk-${i}`,
        user_id: '',
        subject: '',
        total_amount: 0,
        status: '',
        order_type: null,
        payment_provider: null,
        trade_status: null,
        created_at: '',
        updated_at: '',
        alipay_trade_no: null,
        order_data: null,
        settlement: null,
    }));

    return (
        <div className="w-full min-w-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-surface-900">账单管理</h1>
                <div className="flex gap-2 items-center">
                    <Link href="/admin/subscriptions">
                        <Button label="订阅管理" icon="pi pi-list" className="p-button-outlined" />
                    </Link>
                    <Button
                        label="刷新"
                        icon="pi pi-refresh"
                        onClick={() => loadOrders(Math.floor(first / rows) + 1, rows)}
                        className="p-button-outlined"
                    />
                </div>
            </div>

            <div className="flex flex-wrap gap-4 mb-4 items-center">
                <div className="flex items-center gap-2">
                    <span className="text-sm text-surface-600">状态：</span>
                    <Dropdown
                        value={statusFilter}
                        options={STATUS_OPTIONS}
                        onChange={(e) => setStatusFilter(e.value)}
                        placeholder="全部状态"
                        className="w-32"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-surface-600">类型：</span>
                    <Dropdown
                        value={orderTypeFilter}
                        options={ORDER_TYPE_OPTIONS}
                        onChange={(e) => setOrderTypeFilter(e.value)}
                        placeholder="全部类型"
                        className="w-32"
                    />
                </div>
                <span className="text-xs text-surface-500">教练端操作退款后，请点击「刷新」查看最新状态；已退款订单可在状态筛选中选「已退款」查看。</span>
            </div>

            <div className="w-full overflow-x-auto rounded-lg border border-surface-200">
            <DataTable
                value={loading ? skeletonData : orders}
                lazy
                paginator
                rows={rows}
                totalRecords={loading ? rows : totalRecords}
                first={first}
                onPage={onPage}
                stripedRows
                dataKey="id"
                className="w-full"
            >
                <Column
                    field="id"
                    header="订单号"
                    body={(row) =>
                        loading ? (
                            <Skeleton width="120px" height="1.5rem" />
                        ) : (
                            <code className="text-xs">{String(row.id).slice(0, 8)}...</code>
                        )
                    }
                    headerStyle={{ width: '12%' }}
                />
                <Column
                    header="用户"
                    body={(row) =>
                        loading ? <Skeleton width="80px" height="1.5rem" /> : userTemplate(row)
                    }
                    headerStyle={{ width: '15%' }}
                />
                <Column
                    field="subject"
                    header="商品/描述"
                    body={(row) =>
                        loading ? (
                            <Skeleton width="150px" height="1.5rem" />
                        ) : (
                            <span className="truncate max-w-[200px] block" title={row.subject}>
                                {row.subject || '—'}
                            </span>
                        )
                    }
                    headerStyle={{ width: '25%' }}
                />
                <Column
                    field="order_type"
                    header="类型"
                    body={(row) =>
                        loading ? (
                            <Skeleton width="60px" height="1.5rem" />
                        ) : (
                            orderTypeLabel(row.order_type)
                        )
                    }
                    headerStyle={{ width: '10%' }}
                />
                <Column
                    field="payment_provider"
                    header="通道"
                    body={(row) =>
                        loading ? <Skeleton width="80px" height="1.5rem" /> : providerTemplate(row)
                    }
                    headerStyle={{ width: '10%' }}
                />
                <Column
                    field="total_amount"
                    header="金额"
                    body={(row) =>
                        loading ? <Skeleton width="60px" height="1.5rem" /> : amountTemplate(row)
                    }
                    headerStyle={{ width: '10%' }}
                />
                <Column
                    field="status"
                    header="状态"
                    body={(row) =>
                        loading ? (
                            <Skeleton width="70px" height="1.5rem" />
                        ) : (
                            statusTag(row.status)
                        )
                    }
                    headerStyle={{ width: '10%' }}
                />
                <Column
                    header="分账"
                    body={settlementTemplate}
                    headerStyle={{ width: '12%' }}
                />
                <Column
                    field="created_at"
                    header="创建时间"
                    body={(row) =>
                        loading ? <Skeleton width="140px" height="1.5rem" /> : dateTemplate(row)
                    }
                    headerStyle={{ width: '18%' }}
                />
                <Column
                    header="操作"
                    body={actionTemplate}
                    headerStyle={{ width: '160px' }}
                />
            </DataTable>
            </div>

            {!loading && orders.length > 0 && (
                <div className="mt-4 text-sm text-surface-500">
                    共 {totalRecords} 条账单记录
                </div>
            )}
        </div>
    );
}
