'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Card } from 'primereact/card';
import { Avatar } from 'primereact/avatar';
import { userService } from '@/app/service/userService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import type { CoachSubscriptionRow } from '@/types';
import type { GetUserProfileResponseDto } from '@/app/api/user/get-profile/entity';

interface SubscriptionWithProfiles extends CoachSubscriptionRow {
    studentProfile?: GetUserProfileResponseDto['profile'] | null;
    coachProfile?: GetUserProfileResponseDto['profile'] | null;
    loadingStudentProfile?: boolean;
    loadingCoachProfile?: boolean;
}

export default function AdminPaymentsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    
    const [subscriptions, setSubscriptions] = useState<SubscriptionWithProfiles[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [selectedSubscriptions, setSelectedSubscriptions] = useState<SubscriptionWithProfiles[]>([]);

    useEffect(() => {
        // 检查用户权限
        if (status === 'loading') return;
        
        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }
        
        loadSubscriptions();
    }, [session, status]);

    const loadSubscriptions = async () => {
        try {
            setLoading(true);
            
            // 获取所有等待支付确认的订阅
            const res = await subscriptionService.getCoachSubscriptions({
                status: 'waiting'
            });
            
            if (res) {
                // 初始化订阅列表，添加加载状态
                const initialSubscriptions = res.subscriptions.map(sub => ({
                    ...sub,
                    loadingStudentProfile: true,
                    loadingCoachProfile: true,
                    studentProfile: undefined,
                    coachProfile: undefined
                }));
                setSubscriptions(initialSubscriptions);

                // 并行获取所有学员和教练信息
                const profilePromises = res.subscriptions.map(async (subscription) => {
                    try {
                        // 获取学员信息
                        const studentProfilePromise = userService.getProfile({ userId: subscription.student_id });
                        
                        // 获取教练信息
                        const coachProfilePromise = userService.getProfile({ userId: subscription.coach_id });
                        
                        const [studentProfileRes, coachProfileRes] = await Promise.all([
                            studentProfilePromise,
                            coachProfilePromise
                        ]);
                        
                        return {
                            ...subscription,
                            loadingStudentProfile: false,
                            loadingCoachProfile: false,
                            studentProfile: studentProfileRes?.profile || null,
                            coachProfile: coachProfileRes?.profile || null
                        };
                    } catch (error) {
                        console.error(`获取订阅 ${subscription.id} 的用户信息失败:`, error);
                        return {
                            ...subscription,
                            loadingStudentProfile: false,
                            loadingCoachProfile: false,
                            studentProfile: null,
                            coachProfile: null
                        };
                    }
                });

                const updatedSubscriptions = await Promise.all(profilePromises);
                setSubscriptions(updatedSubscriptions);
                setTotalRecords(updatedSubscriptions.length);
            }
        } catch (error) {
            console.error('加载订阅信息失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载订阅数据' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
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
            
            // 重新加载数据
            loadSubscriptions();
            setSelectedSubscriptions([]);
        } catch (error) {
            console.error('确认支付失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '确认支付失败，请稍后重试'
            });
        }
    };

    const studentTemplate = (subscription: SubscriptionWithProfiles) => (
        <div className="flex items-center space-x-3">
            {subscription.loadingStudentProfile ? (
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
                {subscription.loadingStudentProfile ? (
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

    const coachTemplate = (subscription: SubscriptionWithProfiles) => (
        <div className="flex items-center space-x-3">
            {subscription.loadingCoachProfile ? (
                <Skeleton shape="circle" width="2.5rem" height="2.5rem" />
            ) : (
                <Avatar
                    image={subscription.coachProfile?.avatar_url || undefined}
                    label={
                        subscription.coachProfile?.avatar_url
                            ? undefined
                            : subscription.coachProfile?.nickname?.charAt(0) ||
                              subscription.coachProfile?.full_name?.charAt(0) ||
                              'C'
                    }
                    shape="circle"
                    className="bg-green-500 text-surface font-bold flex-shrink-0"
                    size="normal"
                />
            )}
            <div>
                {subscription.loadingCoachProfile ? (
                    <Skeleton width="6rem" height="1rem" />
                ) : (
                    <div className="font-medium">
                        {subscription.coachProfile?.nickname || subscription.coachProfile?.full_name || '未知教练'}
                    </div>
                )}
            </div>
        </div>
    );

    const tierTemplate = (subscription: SubscriptionWithProfiles) => (
        <span className="px-2 py-1 bg-primary text-surface rounded-full text-sm">
            等级 {subscription.tier}
        </span>
    );

    const priceTemplate = (subscription: SubscriptionWithProfiles) => (
        <div className="text-right">
            <div>¥{subscription.monthly_price.toFixed(2)}</div>
            {subscription.order_id && (
                <div className="text-xs text-surface-500">订单: {subscription.order_id.substring(0, 8)}...</div>
            )}
        </div>
    );

    const noteTemplate = (subscription: SubscriptionWithProfiles) => (
        subscription.remind_coach_note ? (
            <div className="max-w-xs truncate" title={subscription.remind_coach_note}>
                {subscription.remind_coach_note}
            </div>
        ) : (
            <div className="text-surface-500 italic">无备注</div>
        )
    );

    const statusTemplate = (rowData: SubscriptionWithProfiles) => {
        const severity = rowData.status === 'active' ? 'success' : 
                        rowData.status === 'waiting' ? 'warning' : 
                        rowData.status === 'cancelled' ? 'danger' : 'info';
        const label = rowData.status === 'active' ? '已激活' : 
                     rowData.status === 'waiting' ? '待确认' : 
                     rowData.status === 'cancelled' ? '已取消' : rowData.status;
        
        return <Tag severity={severity} value={label} />;
    };

    const dateTemplate = (rowData: SubscriptionWithProfiles) => {
        return new Date(rowData.created_at).toLocaleString('zh-CN');
    };

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
    };

    if (status === 'loading' || loading) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <Skeleton width="200px" height="32px" />
                </div>
                <Card>
                    <div className="p-4">
                        <Skeleton width="100%" height="400px" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-surface-900">支付管理</h1>
                <div className="flex gap-2">
                    <Button 
                        label="刷新" 
                        icon="pi pi-refresh" 
                        onClick={loadSubscriptions}
                        className="p-button-outlined"
                    />
                    <Button 
                        label={`确认支付 (${selectedSubscriptions.length})`}
                        icon="pi pi-check"
                        onClick={handleConfirm}
                        disabled={selectedSubscriptions.length === 0}
                        className="p-button-success"
                    />
                </div>
            </div>

            <Card>
                <DataTable 
                    value={subscriptions} 
                    paginator 
                    rows={rows}
                    totalRecords={totalRecords}
                    first={first}
                    onPage={onPage}
                    loading={loading}
                    stripedRows
                    tableStyle={{ minWidth: '50rem' }}
                    selection={selectedSubscriptions}
                    onSelectionChange={(e) => setSelectedSubscriptions(e.value as SubscriptionWithProfiles[])}
                    dataKey="id"
                    selectionMode="checkbox"
                >
                    <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                    <Column field="student" header="学员" body={studentTemplate}></Column>
                    <Column field="coach" header="教练" body={coachTemplate}></Column>
                    <Column field="tier" header="订阅等级" body={tierTemplate}></Column>
                    <Column field="monthly_price" header="月费" body={priceTemplate} align="right"></Column>
                    <Column field="status" header="状态" body={statusTemplate}></Column>
                    <Column 
                        field="remind_coach_note" 
                        header="支付备注" 
                        body={noteTemplate}
                    ></Column>
                    <Column 
                        field="created_at" 
                        header="申请时间" 
                        body={dateTemplate}
                    ></Column>
                </DataTable>
            </Card>
            
            {subscriptions.length > 0 && (
                <div className="mt-4 text-sm text-surface-500">
                    已选择 {selectedSubscriptions.length} 个订阅，确认支付后将激活这些订阅。
                </div>
            )}
        </div>
    );
}