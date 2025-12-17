'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Avatar } from 'primereact/avatar';
import { Toast } from 'primereact/toast';
import { useToastContext } from '@/context/ToastContext';
import { subscriptionService } from '@/app/service/subscriptionService';
import type { CoachSubscriptionRow } from '@/types';

interface PaymentConfirmationDialogProps {
    visible: boolean;
    subscriptions: CoachSubscriptionRow[];
    onHide: () => void;
    onConfirm: () => void;
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

    const studentTemplate = (subscription: CoachSubscriptionRow) => (
        <div className="flex items-center space-x-3">
            <Avatar
                image={subscription.student_profile?.avatar_url || undefined}
                label={
                    subscription.student_profile?.avatar_url
                        ? undefined
                        : subscription.student_profile?.nickname?.charAt(0) ||
                          subscription.student_profile?.full_name?.charAt(0) ||
                          'U'
                }
                shape="circle"
                className="bg-primary text-surface font-bold flex-shrink-0"
                size="normal"
            />
            <div>
                <div className="font-medium">
                    {subscription.student_profile?.nickname || subscription.student_profile?.full_name || '未知用户'}
                </div>
                <div className="text-sm text-surface-500">
                    订阅等级: {subscription.tier}
                </div>
            </div>
        </div>
    );

    const tierTemplate = (subscription: CoachSubscriptionRow) => (
        <span className="px-2 py-1 bg-primary text-surface rounded-full text-sm">
            等级 {subscription.tier}
        </span>
    );

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
            style={{ width: '90%', maxWidth: '800px' }}
        >
            <div className="p-4">
                {subscriptions.length > 0 ? (
                    <DataTable
                        value={subscriptions}
                        selection={selectedSubscriptions}
                        onSelectionChange={(e) => setSelectedSubscriptions(e.value as CoachSubscriptionRow[])}
                        selectionMode="checkbox"
                        dataKey="id"
                        className="border border-surface-200"
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                        <Column field="student" header="学员" body={studentTemplate}></Column>
                        <Column field="tier" header="订阅等级" body={tierTemplate}></Column>
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
                
                {subscriptions.length > 0 && (
                    <div className="mt-4 text-sm text-surface-500">
                        已选择 {selectedSubscriptions.length} 位学员，确认支付后将激活他们的订阅。
                    </div>
                )}
            </div>
        </Dialog>
    );
};