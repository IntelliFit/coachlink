'use client';

import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import {
    coachRefundAmountText,
    coachRefundConfirmText,
    coachRefundConsequence,
    coachRefundProviderLabel,
    coachRefundResult,
    coachRefundRoleLabel,
    COACH_REFUND_EMPTY_TEXT,
    type CoachRefundOrder,
    type CoachRefundSubscriptionOutcome,
} from '@coachlink/core/src/coachRefund';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';

interface StudentRefundDialogProps {
    visible: boolean;
    subscriptionId: string;
    onHide: () => void;
    /** Called after every successful refund with whether the server cancelled the subscription. */
    onRefunded: (result: { subscriptionCancelled: boolean }) => void;
}

function formatPaidAt(value: string | null) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function refundOrder(orderId: string): Promise<CoachRefundSubscriptionOutcome | undefined> {
    const res = await fetch('/api/payment/alipay/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, refundReason: '教练/学员申请退款' }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body?.success) throw new Error(body?.message || '请稍后重试');
    return body?.data?.subscriptionOutcome;
}

/** Lists the student's paid orders so the coach picks the one to refund (e.g. only the duplicate of a double charge). */
export function StudentRefundDialog({ visible, subscriptionId, onHide, onRefunded }: StudentRefundDialogProps) {
    const { showToast } = useToastContext();
    const [orders, setOrders] = useState<CoachRefundOrder[] | null>(null);
    const [loadError, setLoadError] = useState('');
    const [refundingId, setRefundingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoadError('');
        setOrders(null);
        try {
            setOrders(await coachService.listSubscriptionRefundOrders(subscriptionId));
        } catch (error) {
            setLoadError((error as Error)?.message || '读取订单失败');
        }
    }, [subscriptionId]);

    useEffect(() => {
        if (visible) void load();
    }, [visible, load]);

    const handleRefund = async (order: CoachRefundOrder) => {
        if (refundingId) return;
        if (!confirm(coachRefundConfirmText(order))) return;
        setRefundingId(order.id);
        try {
            const result = coachRefundResult(await refundOrder(order.id));
            showToast({ severity: 'success', summary: result.title });
            onRefunded({ subscriptionCancelled: result.subscriptionCancelled });
            if (result.subscriptionCancelled) onHide();
            else await load();
        } catch (error) {
            showToast({ severity: 'error', summary: '退款失败', detail: (error as Error)?.message });
        } finally {
            setRefundingId(null);
        }
    };

    return (
        <Dialog header="选择要退款的订单" visible={visible} onHide={onHide} className="w-[min(32rem,92vw)]" dismissableMask>
            {loadError ? (
                <div className="flex flex-col items-start gap-3">
                    <p className="text-sm text-red-600">{loadError}</p>
                    <Button label="重试" size="small" outlined onClick={() => void load()} />
                </div>
            ) : !orders ? (
                <p className="text-sm text-surface-500">正在读取订单…</p>
            ) : orders.length === 0 ? (
                <p className="text-sm text-surface-500">{COACH_REFUND_EMPTY_TEXT}</p>
            ) : (
                <ul className="flex flex-col gap-3" data-testid="coach-refund-orders">
                    {orders.map((order) => (
                        <li key={order.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 p-3">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-base font-bold text-surface-900">{coachRefundAmountText(order)}</span>
                                    <span
                                        className={`rounded-md border px-2 py-0.5 text-xs font-bold ${order.role === 'duplicate'
                                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                                            : 'border-surface-200 bg-surface-50 text-surface-600'}`}
                                    >
                                        {coachRefundRoleLabel(order.role)}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-surface-500">
                                    {coachRefundProviderLabel(order.paymentProvider)} · {formatPaidAt(order.createdAt)} · {coachRefundConsequence(order)}
                                </p>
                            </div>
                            <Button
                                label="退这笔"
                                size="small"
                                outlined
                                severity={order.cancelsSubscription ? 'danger' : 'warning'}
                                loading={refundingId === order.id}
                                disabled={Boolean(refundingId) && refundingId !== order.id}
                                onClick={() => void handleRefund(order)}
                            />
                        </li>
                    ))}
                </ul>
            )}
        </Dialog>
    );
}
