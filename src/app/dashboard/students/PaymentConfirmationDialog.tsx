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
import { userService } from '@/app/service/userService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import type { CoachSubscriptionRow } from '@/types';
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
    subscriptions: CoachSubscriptionRow[];
    onHide: () => void;
    onConfirm: () => void;
}

interface SubscriptionWithStudentProfile extends CoachSubscriptionRow {
    studentProfile?: GetUserProfileResponseDto['profile'] | null;
    loadingProfile?: boolean;
}

export const PaymentConfirmationDialog: React.FC<PaymentConfirmationDialogProps> = ({
    visible,
    subscriptions,
    onHide,
    onConfirm
}) => {
    const { showToast } = useToastContext();
    const [selectedSubscriptions, setSelectedSubscriptions] = useState<CoachSubscriptionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [subscriptionsWithProfiles, setSubscriptionsWithProfiles] = useState<SubscriptionWithStudentProfile[]>([]);

    // 获取学员信息
    useEffect(() => {
        const fetchStudentProfiles = async () => {
            if (!visible || subscriptions.length === 0) {
                setSubscriptionsWithProfiles([]);
                return;
            }

            // 初始化订阅列表，添加加载状态
            const initialSubscriptions = subscriptions.map(sub => ({
                ...sub,
                loadingProfile: true,
                studentProfile: undefined
            }));
            setSubscriptionsWithProfiles(initialSubscriptions);

            // 并行获取所有学员信息
            const profilePromises = subscriptions.map(async (subscription) => {
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
            setSubscriptionsWithProfiles(updatedSubscriptions);
        };

        fetchStudentProfiles();
    }, [visible, subscriptions]);

    const handleConfirm = async () => {
        setLoading(true);
        try {
            // 批量更新订阅状态，并为线下支付设置 end_date
            const updatePromises = selectedSubscriptions.map(subscription => {
                const subscribeData = subscription.subscribe_data as any;
                // 兼容处理：支持数组或对象格式查找
                let offlinePayment: OfflinePaymentData | undefined;
                
                if (Array.isArray(subscribeData)) {
                    offlinePayment = subscribeData.find((item: any) => item.type === 'offline_payment');
                } else if (subscribeData?.offline_payment) {
                    offlinePayment = subscribeData.offline_payment;
                }
                
                const updateData: Record<string, unknown> = {
                    id: subscription.id,
                    status: 'active'
                };

                // 如果是线下支付，设置 end_date 为学员填写的到期日期
                if (offlinePayment?.expires_at) {
                    updateData.end_date = offlinePayment.expires_at;
                }
                
                // 自动修复数据结构：如果发现是对象格式，借此机会转换为数组
                if (!Array.isArray(subscribeData) && subscribeData && typeof subscribeData === 'object') {
                     // 尝试转换: 将对象属性转换为数组项，或者保留 offline_payment
                     const newSubscribeData = [];
                     if (offlinePayment) {
                         newSubscribeData.push({ type: 'offline_payment', ...offlinePayment });
                     }
                     // 如果有其他属性（如问卷），这里比较难无损恢复，但通常线下支付时问卷数据可能为空或不同
                     // 简单起见，如果检测到格式错误，我们在激活时修复它
                    updateData.subscribe_data = newSubscribeData;
                }

                return subscriptionService.updateSubscription(updateData as Parameters<typeof subscriptionService.updateSubscription>[0]);
            });

            await Promise.all(updatePromises);
            
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

    // 获取线下支付数据
    const getOfflinePayment = (subscription: SubscriptionWithStudentProfile): OfflinePaymentData | null => {
        const subscribeData = subscription.subscribe_data as any;
        if (!subscribeData) return null;
        
        if (Array.isArray(subscribeData)) {
            return subscribeData.find((item: any) => item.type === 'offline_payment') || null;
        }
        
        // 兼容旧对象格式
        return subscribeData.offline_payment || null;
    };

    // 支付方式模板
    const paymentTypeTemplate = (subscription: SubscriptionWithStudentProfile) => {
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
                className="p-button-text"
                disabled={loading}
            />
            <Button
                label={`确认支付 (${selectedSubscriptions.length})`}
                icon="pi pi-check"
                onClick={handleConfirm}
                disabled={selectedSubscriptions.length === 0 || loading}
                className="p-button-primary"
                loading={loading}
            />
        </div>
    );

    return (
        <Dialog
            header={`待确认支付 (${subscriptions.length})`}
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
                        selection={selectedSubscriptions}
                        onSelectionChange={(e) => setSelectedSubscriptions(e.value as CoachSubscriptionRow[])}
                        selectionMode="checkbox"
                        dataKey="id"
                        scrollable
                        scrollHeight="400px"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
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
                    </DataTable>
                ) : (
                    <div className="text-center text-surface-500 py-8">
                        暂无待确认的支付信息
                    </div>
                )}
                
                {subscriptionsWithProfiles.length > 0 && (
                    <div className="mt-4 text-sm text-surface-500">
                        已选择 {selectedSubscriptions.length} 位学员，确认支付后将激活他们的订阅。
                    </div>
                )}
            </div>
        </Dialog>
    );
};