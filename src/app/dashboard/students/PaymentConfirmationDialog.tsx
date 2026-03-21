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
import { TabView, TabPanel } from 'primereact/tabview';
import { userService } from '@/app/service/userService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { CoachSubscriptionRow, CoachesRow } from '@/types';
import type { GetUserProfileResponseDto } from '@/app/api/user/get-profile/entity';
import { formatYuanFromFen, yuanToFen } from '@/lib/moneyUtils';

// 线下支付数据结构
interface OfflinePaymentData {
    payment_type: 'offline';
    expires_at: string;
    amount?: number;
    amount_unit?: 'fen' | 'yuan';
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
    const [activeTab, setActiveTab] = useState(0); // 0: 待确认  1: 历史
    const [selectedManualRows, setSelectedManualRows] = useState<SubscriptionWithStudentProfile[]>([]);
    const [loading, setLoading] = useState(false);
    const [subscriptionsWithProfiles, setSubscriptionsWithProfiles] = useState<SubscriptionWithStudentProfile[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyWithProfiles, setHistoryWithProfiles] = useState<SubscriptionWithStudentProfile[]>([]);
    const [historyLoadedOnce, setHistoryLoadedOnce] = useState(false);

    // 获取学员信息
    useEffect(() => {
        const fetchStudentProfiles = async () => {
            const allSubscriptions = [...manualSubscriptions, ...systemSubscriptions];
            if (!visible || allSubscriptions.length === 0) {
                setSubscriptionsWithProfiles([]);
                setSelectedManualRows([]);
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
            const kindEntries: Array<[string, 'manual' | 'system']> = [
                ...manualSubscriptions.map((s): [string, 'manual'] => [s.id, 'manual']),
                ...systemSubscriptions.map((s): [string, 'system'] => [s.id, 'system']),
            ];
            const kindMap = new Map<string, 'manual' | 'system'>(kindEntries);
            setSubscriptionsWithProfiles(updatedSubscriptions.map(s => ({ ...(s as any), __kind: kindMap.get((s as any).id) })));

        };

        fetchStudentProfiles();
    }, [visible, manualSubscriptions, systemSubscriptions]);

    const manualRows = subscriptionsWithProfiles.filter(s => s.__kind !== 'system');
    const systemRows = subscriptionsWithProfiles.filter(s => s.__kind === 'system');

    // 打开弹窗时默认回到“待确认”
    useEffect(() => {
        if (visible) {
            setActiveTab(0);
            setHistoryLoadedOnce(false);
            setHistoryWithProfiles([]);
            setSelectedManualRows([]);
        }
    }, [visible]);

    // 历史：进入 Tab 时加载（每次打开弹窗都会重新拉一次，确保能看到刚确认的记录）
    useEffect(() => {
        const loadHistory = async () => {
            if (!visible) return;
            if (activeTab !== 1) return;
            if (historyLoadedOnce) return;

            setHistoryLoading(true);
            try {
                const res = await coachService.getPaymentConfirmationHistory({ limit: 50 });
                const subs = res?.subscriptions || [];
                if (subs.length === 0) {
                    setHistoryWithProfiles([]);
                    setHistoryLoadedOnce(true);
                    return;
                }

                // 初始化 skeleton
                setHistoryWithProfiles(
                    subs.map((s) => ({
                        ...(s as any),
                        __kind: (s as any).payment_confirmed_by === 'system' ? ('system' as const) : ('manual' as const),
                        loadingProfile: true,
                        studentProfile: undefined,
                    })),
                );

                const updated = await Promise.all(
                    subs.map(async (subscription) => {
                        try {
                            const profile = await userService.getProfile({ userId: subscription.student_id });
                            return {
                                ...subscription,
                                loadingProfile: false,
                                studentProfile: profile?.profile || null,
                            };
                        } catch (e) {
                            console.error(`获取学员 ${subscription.student_id} 信息失败:`, e);
                            return {
                                ...subscription,
                                loadingProfile: false,
                                studentProfile: null,
                            };
                        }
                    }),
                );

                setHistoryWithProfiles(
                    updated.map((s: any) => ({
                        ...s,
                        __kind: s.payment_confirmed_by === 'system' ? ('system' as const) : ('manual' as const),
                    })),
                );
                setHistoryLoadedOnce(true);
            } finally {
                setHistoryLoading(false);
            }
        };

        loadHistory();
    }, [activeTab, visible, historyLoadedOnce]);

    const buildUpdateDataForConfirm = (subscription: CoachSubscriptionRow) => {
        const paymentData = (subscription as any).payment_data as any;
        const offlinePayment: OfflinePaymentData | undefined = paymentData?.offline_payment || undefined;
        const pendingRenew = paymentData?.pending_renew as
            | { additional_weeks?: number; amount?: number; requested_at?: string }
            | undefined;

        const updateData: Record<string, unknown> = {
            id: subscription.id,
            status: 'active',
        };

        // 如果是线下支付，设置 end_date 为学员填写的到期日期
        if (offlinePayment?.expires_at) {
            updateData.end_date = offlinePayment.expires_at;
        }

        // 如果是续费待确认：在原 end_date 基础上延长
        const weeks = Number(pendingRenew?.additional_weeks || 0);
        if (weeks > 0) {
            updateData.subscribed_weeks = Number(subscription.subscribed_weeks || 0) + weeks;
            const base = subscription.end_date ? new Date(subscription.end_date) : new Date();
            const now = new Date();
            const effectiveBase = base.getTime() < now.getTime() ? now : base;
            effectiveBase.setDate(effectiveBase.getDate() + weeks * 7);
            updateData.end_date = effectiveBase.toISOString();
        }

        // 老订阅重开且没有新到期信息时，避免沿用过期 end_date 导致“确认后仍提示续费”
        if (
            weeks <= 0 &&
            !offlinePayment?.expires_at &&
            subscription.end_date &&
            new Date(subscription.end_date).getTime() <= Date.now()
        ) {
            updateData.end_date = null;
        }

        // 清理 pending_renew，避免重复处理（保留 offline_payment 作为凭证记录）
        if (paymentData && typeof paymentData === 'object' && !Array.isArray(paymentData)) {
            updateData.payment_data = { ...paymentData, pending_renew: null };
        }

        return updateData;
    };

    const confirmSubscriptions = async (targets: CoachSubscriptionRow[], options?: { closeOnSuccess?: boolean }) => {
        const closeOnSuccess = options?.closeOnSuccess ?? false;
        setLoading(true);
        try {
            const updatePromises = (targets || []).map((subscription) =>
                subscriptionService.updateSubscription(
                    buildUpdateDataForConfirm(subscription) as Parameters<typeof subscriptionService.updateSubscription>[0],
                ),
            );

            await Promise.all(updatePromises);
            trackEvent('coach_manual_payment', 'business', {
                count: targets.length,
                subscription_ids: targets.map(s => s.id)
            });
            
            
            showToast({
                severity: 'success',
                summary: '成功',
                detail: `成功确认 ${targets.length} 位学员的支付`
            });

            // 清空选择（列表会在 onConfirm 后刷新）
            setSelectedManualRows([]);

            onConfirm(); // refresh list (parent will re-fetch)
            // 让历史 tab 重新拉取
            setHistoryLoadedOnce(false);

            if (closeOnSuccess) onHide();
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

    const handleConfirm = async () => {
        // 批量更新订阅状态，并为线下支付/续费请求处理 end_date
        const selectedSubscriptions = (selectedManualRows || []).map(s => s as CoachSubscriptionRow);

        if (selectedSubscriptions.length === 0) return;
        await confirmSubscriptions(selectedSubscriptions, { closeOnSuccess: true });
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

    // 线上展示只走确定性规则：优先按显式单位解释，默认按“分”
    const getOfflineAmountFen = (subscription: SubscriptionWithStudentProfile): number | null => {
        const offlinePayment = getOfflinePayment(subscription);
        const raw = Number(offlinePayment?.amount ?? 0);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        const amountUnit = offlinePayment?.amount_unit;
        if (amountUnit === 'yuan') return yuanToFen(raw);
        return Math.round(raw);
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

    const confirmSourceTemplate = (subscription: SubscriptionWithStudentProfile) => {
        const by = (subscription as any).payment_confirmed_by as string | null;
        if (by === 'system') return <Tag value="系统确认" severity="success" rounded />;
        if (by === 'coach') return <Tag value="教练确认" severity="warning" rounded />;
        return <Tag value="-" severity="info" rounded />;
    };

    // 线下支付详情模板
    const offlineDetailsTemplate = (subscription: SubscriptionWithStudentProfile) => {
        const offlinePayment = getOfflinePayment(subscription);
        const offlineAmountFen = getOfflineAmountFen(subscription);
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
                {offlineAmountFen && (
                    <div className="flex items-center gap-2">
                        <span className="text-surface-500">金额:</span>
                        <span>¥{formatYuanFromFen(offlineAmountFen)}</span>
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
        const offlineAmountFen = getOfflineAmountFen(subscription);
        
        if (offlinePayment) {
            return (
                <div className="text-right">
                    {offlineAmountFen ? (
                        <>
                            <div className="font-medium text-green-600">¥{formatYuanFromFen(offlineAmountFen)}</div>
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
                <div>¥{formatYuanFromFen(subscription.monthly_price)}</div>
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

    const actionTemplate = (rowData: SubscriptionWithStudentProfile) => {
        if (rowData.__kind !== 'system') {
            return (
                <Button
                    label="确认"
                    size="small"
                    onClick={() => confirmSubscriptions([rowData as any as CoachSubscriptionRow])}
                    disabled={loading}
                />
            );
        }
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

    const footerContent = activeTab === 0 ? (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={onHide}
                className="p-button-text rounded-2xl"
                disabled={loading}
            />
            <Button
                label={`确认支付 (${selectedManualRows.length})`}
                icon="pi pi-check"
                onClick={handleConfirm}
                disabled={selectedManualRows.length === 0 || loading}
                className="p-button-primary rounded-2xl"
                loading={loading}
            />
        </div>
    ) : (
        <div className="flex justify-end">
            <Button
                label="关闭"
                icon="pi pi-times"
                onClick={onHide}
                className="p-button-text rounded-2xl"
                disabled={loading || historyLoading}
            />
        </div>
    );

    return (
        <Dialog
            header={`待支付确认 (${manualSubscriptions.length + systemSubscriptions.length})`}
            visible={visible}
            onHide={onHide}
            footer={footerContent}
            modal
            draggable={false}
            resizable={false}
            style={{ width: '96vw', maxWidth: '1360px' }}
            breakpoints={{ '1400px': '96vw', '992px': '98vw', '768px': '99vw' }}
            contentStyle={{ maxHeight: '80vh', overflow: 'auto' }}
        >
            <div className="p-4">
                <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
                    <TabPanel header={`待确认 (${manualSubscriptions.length + systemSubscriptions.length})`}>
                        {manualRows.length === 0 && systemRows.length === 0 ? (
                            <div className="text-center text-surface-500 py-8">
                                暂无待确认的支付信息
                            </div>
                        ) : (
                            <>
                                {/* 需要教练确认（可勾选 / 可批量） */}
                                {manualRows.length > 0 && (
                                    <div className="mb-6">
                                        <div className="text-sm font-semibold text-surface-700 mb-2">
                                            需要确认（{manualRows.length}）
                                        </div>
                                        <DataTable
                                            value={manualRows}
                                            dataKey="id"
                                            scrollable
                                            scrollHeight="380px"
                                            tableStyle={{ minWidth: '1080px' }}
                                            selection={selectedManualRows}
                                            onSelectionChange={(e) => setSelectedManualRows((e.value || []) as SubscriptionWithStudentProfile[])}
                                            selectionMode="checkbox"
                                        >
                                            <Column selectionMode="multiple" headerStyle={{ width: '3rem' }} bodyStyle={{ width: '3rem' }} />
                                            <Column field="student" header="学员" body={studentTemplate}></Column>
                                            <Column field="payment_type" header="支付方式" body={paymentTypeTemplate} style={{ width: '110px' }}></Column>
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
                                                style={{ width: '110px' }}
                                            />
                                        </DataTable>

                                        <div className="mt-3 text-sm text-surface-500">
                                            已选择 {selectedManualRows.length} 位学员，确认后将激活/续费生效。
                                        </div>
                                    </div>
                                )}

                                {/* 系统通知（只读 / 可忽略） */}
                                {systemRows.length > 0 && (
                                    <div>
                                        <div className="text-sm font-semibold text-surface-700 mb-2">
                                            系统通知（{systemRows.length}）
                                        </div>
                                        <DataTable
                                            value={systemRows}
                                            dataKey="id"
                                            scrollable
                                            scrollHeight="300px"
                                            tableStyle={{ minWidth: '900px' }}
                                        >
                                            <Column field="student" header="学员" body={studentTemplate}></Column>
                                            <Column field="payment_type" header="支付方式" body={paymentTypeTemplate} style={{ width: '140px' }}></Column>
                                            <Column
                                                field="created_at"
                                                header="时间"
                                                body={(rowData) => new Date(rowData.created_at).toLocaleString()}
                                                style={{ width: '160px' }}
                                            ></Column>
                                            <Column
                                                header="操作"
                                                body={actionTemplate}
                                                style={{ width: '110px' }}
                                            />
                                        </DataTable>
                                        <div className="mt-2 text-xs text-surface-500">
                                            系统通知仅用于告知状态（如平台支付已自动确认），不会影响批量确认。
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </TabPanel>

                    <TabPanel header="历史">
                        {historyLoading ? (
                            <div className="py-6">
                                <Skeleton width="100%" height="40px" className="mb-2" />
                                <Skeleton width="100%" height="40px" className="mb-2" />
                                <Skeleton width="100%" height="40px" className="mb-2" />
                            </div>
                        ) : historyWithProfiles.length > 0 ? (
                            <DataTable
                                value={historyWithProfiles}
                                dataKey="id"
                                scrollable
                                scrollHeight="460px"
                                tableStyle={{ minWidth: '1020px' }}
                            >
                                <Column field="student" header="学员" body={studentTemplate}></Column>
                                <Column field="confirm_source" header="确认来源" body={confirmSourceTemplate} style={{ width: '110px' }} />
                                <Column field="payment_type" header="支付方式" body={paymentTypeTemplate} style={{ width: '110px' }}></Column>
                                <Column field="offline_details" header="线下支付详情" body={offlineDetailsTemplate} style={{ width: '180px' }}></Column>
                                <Column field="monthly_price" header="月费" body={priceTemplate} align="right" style={{ width: '100px' }}></Column>
                                <Column
                                    field="payment_confirmed_at"
                                    header="确认时间"
                                    body={(rowData) => rowData.payment_confirmed_at ? new Date(rowData.payment_confirmed_at).toLocaleString() : '-'}
                                    style={{ width: '140px' }}
                                ></Column>
                                <Column
                                    field="remind_coach_note"
                                    header="备注"
                                    body={noteTemplate}
                                    style={{ maxWidth: '180px' }}
                                ></Column>
                            </DataTable>
                        ) : (
                            <div className="text-center text-surface-500 py-10">
                                暂无历史记录
                            </div>
                        )}
                    </TabPanel>
                </TabView>
                
            </div>
        </Dialog>
    );
};
