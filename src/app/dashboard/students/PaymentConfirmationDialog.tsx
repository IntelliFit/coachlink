'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { Image } from 'primereact/image';
import { Tag } from 'primereact/tag';
import { Checkbox } from 'primereact/checkbox';
import { userService } from '@/app/service/userService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { CoachSubscriptionRow, CoachesRow } from '@/types';
import type { GetUserProfileResponseDto } from '@/app/api/user/get-profile/entity';

// 线下支付数据结构
interface OfflinePaymentData {
    payment_type: 'offline';
    expires_at: string;
    amount?: number;
    receipt_url?: string;
    note?: string;
}

interface PaymentConfirmationDialogProps {
    visible: boolean;
    manualSubscriptions: CoachSubscriptionRow[];
    systemSubscriptions: CoachSubscriptionRow[];
    coach: CoachesRow | null;
    onHide: () => void;
    onConfirm: () => void;
}

interface SubscriptionWithStudentProfile extends CoachSubscriptionRow {
    studentProfile?: GetUserProfileResponseDto['profile'] | null;
    loadingProfile?: boolean;
    __kind?: 'manual' | 'system';
}

export const PaymentConfirmationDialog: React.FC<PaymentConfirmationDialogProps> = ({
    visible,
    manualSubscriptions,
    systemSubscriptions,
    coach,
    onHide,
    onConfirm
}) => {
    const { showToast } = useToastContext();
    const { trackEvent } = useAnalytics();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [subscriptionsWithProfiles, setSubscriptionsWithProfiles] = useState<SubscriptionWithStudentProfile[]>([]);

    // 获取学员信息
    useEffect(() => {
        const fetchStudentProfiles = async () => {
            const allSubscriptions = [...manualSubscriptions, ...systemSubscriptions];
            if (!visible || allSubscriptions.length === 0) {
                setSubscriptionsWithProfiles([]);
                setSelectedIds(new Set());
                return;
            }

            // 初始化订阅列表，添加加载状态
            const initialSubscriptions = [
                ...manualSubscriptions.map(sub => ({ ...sub, __kind: 'manual' as const })),
                ...systemSubscriptions.map(sub => ({ ...sub, __kind: 'system' as const })),
            ].map(sub => ({
                ...(sub as any),
                loadingProfile: true,
                studentProfile: undefined
            }));
            setSubscriptionsWithProfiles(initialSubscriptions);

            // 并行获取所有学员信息
            const profilePromises = allSubscriptions.map(async (subscription) => {
                try {
                    const profile = await userService.getProfile({ userId: subscription.student_id });
                    return {
                        ...subscription,
                        loadingProfile: false,
                        studentProfile: profile?.profile || null
                    };
                } catch (error) {
                    console.error(`获取学员 ${subscription.student_id} 信息失败:`, error);
                    return {
                        ...subscription,
                        loadingProfile: false,
                        studentProfile: null
                    };
                }
            });

            const updatedSubscriptions = await Promise.all(profilePromises);
            // re-attach kind
            const kindMap = new Map<string, 'manual' | 'system'>([
                ...manualSubscriptions.map(s => [s.id, 'manual' as const]),
                ...systemSubscriptions.map(s => [s.id, 'system' as const]),
            ]);
            setSubscriptionsWithProfiles(updatedSubscriptions.map(s => ({ ...(s as any), __kind: kindMap.get((s as any).id) })));

        };

        fetchStudentProfiles();
    }, [visible, manualSubscriptions, systemSubscriptions]);

    const manualRows = subscriptionsWithProfiles.filter(s => s.__kind !== 'system');

    const toggleSelect = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    };

    const toggleSelectAllManual = (checked: boolean) => {
        setSelectedIds(() => {
            if (!checked) return new Set();
            return new Set(manualRows.map(s => s.id));
        });
    };

    const handleConfirm = async () => {
        setLoading(true);
        try {
            // 批量更新订阅状态，并为线下支付/续费请求处理 end_date
            const selectedSubscriptions = subscriptionsWithProfiles
                .filter(s => selectedIds.has(s.id) && s.__kind !== 'system')
                .map(s => s as CoachSubscriptionRow);

            const updatePromises = selectedSubscriptions.map(subscription => {
                const paymentData = (subscription as any).payment_data as any;
                const offlinePayment: OfflinePaymentData | undefined = paymentData?.offline_payment || undefined;
                const pendingRenew = paymentData?.pending_renew as
                    | { additional_weeks?: number; amount?: number; requested_at?: string }
                    | undefined;
                
                const updateData: Record<string, unknown> = {
                    id: subscription.id,
                    status: 'active'
                };

                // 如果是线下支付，设置 end_date 为学员填写的到期日期
                if (offlinePayment?.expires_at) {
                    updateData.end_date = offlinePayment.expires_at;
                }

                // 如果是续费待确认：在原 end_date 基础上延长
                const weeks = Number(pendingRenew?.additional_weeks || 0);
                if (weeks > 0) {
                    const base = subscription.end_date ? new Date(subscription.end_date) : new Date();
                    const now = new Date();
                    const effectiveBase = base.getTime() < now.getTime() ? now : base;
                    effectiveBase.setDate(effectiveBase.getDate() + weeks * 7);
                    updateData.end_date = effectiveBase.toISOString();
                }

                // 清理 pending_renew，避免重复处理（保留 offline_payment 作为凭证记录）
                if (paymentData && typeof paymentData === 'object' && !Array.isArray(paymentData)) {
                    updateData.payment_data = { ...paymentData, pending_renew: null };
                }

                return subscriptionService.updateSubscription(updateData as Parameters<typeof subscriptionService.updateSubscription>[0]);
            });

            await Promise.all(updatePromises);
            trackEvent('coach_manual_payment', 'business', {
                count: selectedSubscriptions.length,
                subscription_ids: selectedSubscriptions.map(s => s.id)
            });
            
            
            showToast({
                severity: 'success',
                summary: '成功',
                detail: `成功确认 ${selectedSubscriptions.length} 位学员的支付`
            });
            
            onConfirm();
            onHide();
        } catch (error) {
            console.error('确认支付失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '确认支付失败，请稍后重试'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async (subscriptionId: string) => {
        setLoading(true);
        try {
            const nowIso = new Date().toISOString();
            await subscriptionService.updateSubscription({ id: subscriptionId, coach_seen_at: nowIso } as any);
            showToast({ severity: 'success', summary: '已忽略', detail: '该通知已隐藏' });
            onConfirm(); // refresh list
        } catch (e) {
            console.error('dismiss failed', e);
            showToast({ severity: 'error', summary: '失败', detail: '无法忽略该通知' });
        } finally {
            setLoading(false);
        }
    };

    // 获取线下支付数据
    const getOfflinePayment = (subscription: SubscriptionWithStudentProfile): OfflinePaymentData | null => {
        const paymentData = (subscription as any).payment_data as any;
        if (!paymentData) return null;
        return paymentData.offline_payment || null;
    };

    // 支付方式模板
    const paymentTypeTemplate = (subscription: SubscriptionWithStudentProfile) => {
        if (subscription.__kind === 'system') {
            if ((subscription as any).status === 'inactive') {
                return <Tag value="平台支付（待支付）" severity="info" rounded />;
            }
            return <Tag value="平台支付（系统已确认）" severity="success" rounded />;
        }
        const offlinePayment = getOfflinePayment(subscription);
        if (offlinePayment) {
            return <Tag value="线下已支付" severity="warning" rounded />;
        }
        return <Tag value="扫码支付" severity="info" rounded />;
    };

    // 线下支付详情模板
    const offlineDetailsTemplate = (subscription: SubscriptionWithStudentProfile) => {
        const offlinePayment = getOfflinePayment(subscription);
        if (!offlinePayment) {
            return <span className="text-surface-400">-</span>;
        }

        return (
            <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-surface-500">到期:</span>
                    <span className="font-medium text-primary">
                        {new Date(offlinePayment.expires_at).toLocaleDateString()}
                    </span>
                </div>
                {offlinePayment.amount && (
                    <div className="flex items-center gap-2">
                        <span className="text-surface-500">金额:</span>
                        <span>¥{offlinePayment.amount}</span>
                    </div>
                )}
                {offlinePayment.receipt_url && (
                    <div className="flex items-center gap-2">
                        <span className="text-surface-500">凭证:</span>
                        <Image
                            src={offlinePayment.receipt_url}
                            alt="支付凭证"
                            width="40"
                            height="40"
                            preview
                            className="rounded border cursor-pointer"
                        />
                    </div>
                )}
            </div>
        );
    };

    const studentTemplate = (subscription: SubscriptionWithStudentProfile) => (
        <div className="flex items-center space-x-3">
            {subscription.loadingProfile ? (
                <Skeleton shape="circle" width="2.5rem" height="2.5rem" />
            ) : (
                <Avatar
                    image={subscription.studentProfile?.avatar_url || undefined}
                    label={
                        subscription.studentProfile?.avatar_url
                            ? undefined
                            : subscription.studentProfile?.nickname?.charAt(0) ||
                              subscription.studentProfile?.full_name?.charAt(0) ||
                              'U'
                    }
                    shape="circle"
                    className="bg-primary text-surface font-bold flex-shrink-0"
                    size="normal"
                />
            )}
            <div>
                {subscription.loadingProfile ? (
                    <Skeleton width="6rem" height="1rem" />
                ) : (
                    <div className="font-medium">
                        {subscription.studentProfile?.nickname || subscription.studentProfile?.full_name || '未知用户'}
                    </div>
                )}
                <div className="text-sm text-surface-500">
                    订阅等级: {subscription.tier}
                </div>
            </div>
        </div>
    );

    const tierTemplate = (subscription: SubscriptionWithStudentProfile) => (
        <span className="px-2 py-1 bg-primary text-surface rounded-full text-sm">
            等级 {subscription.tier}
        </span>
    );

    const priceTemplate = (subscription: SubscriptionWithStudentProfile) => {
        const offlinePayment = getOfflinePayment(subscription);
        
        if (offlinePayment) {
            return (
                <div className="text-right">
                    {offlinePayment.amount ? (
                        <>
                            <div className="font-medium text-green-600">¥{offlinePayment.amount}</div>
                            <div className="text-xs text-surface-500">线下实付</div>
                        </>
                    ) : (
                        <div className="text-surface-500 italic">线下支付</div>
                    )}
                </div>
            );
        }

        return (
            <div className="text-right">
                <div>¥{subscription.monthly_price.toFixed(2)}</div>
                {subscription.order_id && (
                    <div className="text-xs text-surface-500">订单: {subscription.order_id.substring(0, 8)}...</div>
                )}
            </div>
        );
    };

    const noteTemplate = (subscription: SubscriptionWithStudentProfile) => {
        const note = subscription.remind_coach_note;
        if (!note) {
            return <div className="text-surface-500 italic">无备注</div>;
        }
        
        // 检测是否包含付款凭证 URL
        const receiptMatch = note.match(/付款凭证:\s*(https?:\/\/[^\s]+)/);
        if (receiptMatch) {
            const receiptUrl = receiptMatch[1];
            const otherNote = note.replace(/付款凭证:\s*https?:\/\/[^\s]+/, '').trim();
            
            return (
                <div className="flex items-center gap-2">
                    <Image 
                        src={receiptUrl} 
                        alt="付款凭证" 
                        width="40"
                        height="40"
                        preview
                        className="rounded border cursor-pointer flex-shrink-0"
                    />
                    {otherNote && (
                        <span className="text-sm text-surface-600 truncate max-w-[100px]" title={otherNote}>
                            {otherNote}
                        </span>
                    )}
                </div>
            );
        }
        
        return (
            <div className="max-w-xs truncate" title={note}>
                {note}
            </div>
        );
    };

    const footerContent = (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onHide}
                className="p-button-text rounded-2xl"
                disabled={loading}
            />
            <Button
                label={`确认支付 (${selectedIds.size})`}
                icon="pi pi-check"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0 || loading}
                className="p-button-primary rounded-2xl"
                loading={loading}
            />
        </div>
    );

    const selectHeaderTemplate = () => {
        const allSelected = manualRows.length > 0 && manualRows.every(r => selectedIds.has(r.id));
        return (
            <Checkbox
                checked={allSelected}
                onChange={(e) => toggleSelectAllManual(!!e.checked)}
                disabled={manualRows.length === 0 || loading}
            />
        );
    };

    const selectBodyTemplate = (rowData: SubscriptionWithStudentProfile) => {
        if (rowData.__kind === 'system') return <span className="text-surface-400">-</span>;
        return (
            <Checkbox
                checked={selectedIds.has(rowData.id)}
                onChange={(e) => toggleSelect(rowData.id, !!e.checked)}
                disabled={loading}
            />
        );
    };

    const actionTemplate = (rowData: SubscriptionWithStudentProfile) => {
        if (rowData.__kind !== 'system') return <span className="text-surface-400">-</span>;
        return (
            <Button
                label="忽略"
                size="small"
                outlined
                onClick={() => handleDismiss(rowData.id)}
                disabled={loading}
            />
        );
    };

    return (
        <Dialog
            header={`待支付确认 (${manualSubscriptions.length + systemSubscriptions.length})`}
            visible={visible}
            onHide={onHide}
            footer={footerContent}
            modal
            draggable={false}
            resizable={false}
            style={{ width: '90%', maxWidth: '900px' }}
        >
            <div className="p-4">
                {subscriptionsWithProfiles.length > 0 ? (
                    <DataTable
                        value={subscriptionsWithProfiles}
                        dataKey="id"
                        scrollable
                        scrollHeight="400px"
                    >
                        <Column
                            header={selectHeaderTemplate}
                            body={selectBodyTemplate}
                            headerStyle={{ width: '3rem' }}
                            bodyStyle={{ width: '3rem' }}
                        />
                        <Column field="student" header="学员" body={studentTemplate}></Column>
                        <Column field="payment_type" header="支付方式" body={paymentTypeTemplate} style={{ width: '100px' }}></Column>
                        <Column field="offline_details" header="线下支付详情" body={offlineDetailsTemplate} style={{ width: '180px' }}></Column>
                        <Column field="monthly_price" header="月费" body={priceTemplate} align="right" style={{ width: '100px' }}></Column>
                        <Column 
                            field="remind_coach_note" 
                            header="备注" 
                            body={noteTemplate}
                            style={{ maxWidth: '150px' }}
                        ></Column>
                        <Column 
                            field="created_at" 
                            header="申请时间" 
                            body={(rowData) => new Date(rowData.created_at).toLocaleString()}
                            style={{ width: '140px' }}
                        ></Column>
                        <Column
                            header="操作"
                            body={actionTemplate}
                            style={{ width: '100px' }}
                        />
                    </DataTable>
                ) : (
                    <div className="text-center text-surface-500 py-8">
                        暂无待确认的支付信息
                    </div>
                )}
                
                {subscriptionsWithProfiles.length > 0 && (
                    <div className="mt-4 text-sm text-surface-500">
                        已选择 {selectedIds.size} 位学员，确认后将激活/续费生效。
                    </div>
                )}
            </div>
        </Dialog>
    );
};