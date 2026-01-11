'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { userService } from '@/app/service/userService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import type { CoachSubscriptionRow } from '@/types';
import type { GetUserProfileResponseDto } from '@/app/api/user/get-profile/entity';

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
            // 批量更新订阅状态
            const updatePromises = selectedSubscriptions.map(subscription =>
                subscriptionService.updateSubscription({
                    id: subscription.id,
                    status: 'active'
                })
            );

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

    const priceTemplate = (subscription: SubscriptionWithStudentProfile) => (
        <div className="text-right">
            <div>¥{subscription.monthly_price.toFixed(2)}</div>
            {subscription.order_id && (
                <div className="text-xs text-surface-500">订单: {subscription.order_id.substring(0, 8)}...</div>
            )}
        </div>
    );

    const noteTemplate = (subscription: SubscriptionWithStudentProfile) => (
        subscription.remind_coach_note ? (
            <div className="max-w-xs truncate" title={subscription.remind_coach_note}>
                {subscription.remind_coach_note}
            </div>
        ) : (
            <div className="text-surface-500 italic">无备注</div>
        )
    );

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
                label={`确认支付 (${selectedSubscriptions.length})`}
                icon="pi pi-check"
                onClick={handleConfirm}
                disabled={selectedSubscriptions.length === 0 || loading}
                className="p-button-primary rounded-2xl"
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
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                        <Column field="student" header="学员" body={studentTemplate}></Column>
                        <Column field="tier" header="订阅等级" body={tierTemplate}></Column>
                        <Column field="monthly_price" header="月费" body={priceTemplate} align="right"></Column>
                        <Column 
                            field="remind_coach_note" 
                            header="支付备注" 
                            body={noteTemplate}
                        ></Column>
                        <Column 
                            field="created_at" 
                            header="申请时间" 
                            body={(rowData) => new Date(rowData.created_at).toLocaleString()}
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