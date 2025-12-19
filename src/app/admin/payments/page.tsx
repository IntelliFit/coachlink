'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { Avatar } from 'primereact/avatar';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import type { CoachSubscriptionRow } from '@/types';
import type { ListSubscriptionGetDto, ListSubscriptionGetResponseDto, QueryCoachSubscription } from '@/app/api/subscription/list-subscriptions/entity';

interface SubscriptionWithProfiles extends QueryCoachSubscription {
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

        // 加载第一页数据
        loadSubscriptions(1, rows);
    }, [session, status]);

    const loadSubscriptions = async (page: number = 1, limit: number = rows) => {
        try {
            setLoading(true);

            // 使用新的分页接口获取所有等待支付确认的订阅
            const res: ListSubscriptionGetResponseDto | null = await subscriptionService.listSubscriptions({
                page: page,
                limit: limit
            } as ListSubscriptionGetDto);

            if (res) {
                setSubscriptions(res.subscriptions);
                setTotalRecords(res.total || 0);
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

            // 重新加载数据，保持当前分页
            const currentPage = Math.floor(first / rows) + 1;
            loadSubscriptions(currentPage, rows);
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
            <div>
                <div className="font-medium">
                    {subscription.studentProfile?.nickname || subscription.studentProfile?.full_name || '未知用户'}
                </div>
                <div className="text-sm text-surface-500">
                    订阅等级: {subscription.tier}
                </div>
            </div>
        </div>
    );

    const coachTemplate = (subscription: SubscriptionWithProfiles) => (
        <div className="flex items-center space-x-3">
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
            <div>
                <div className="font-medium">
                    {subscription.coachProfile?.nickname || subscription.coachProfile?.full_name || '未知教练'}
                </div>
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
                rowData.status === 'inactive' ? 'danger' : 'info';
        const label = rowData.status === 'active' ? '已激活' :
            rowData.status === 'waiting' ? '等待确认' :
                rowData.status === 'inactive' ? '未支付' : rowData.status;

        return <Tag severity={severity} value={label} />;
    };

    // 状态过滤器组件
    const statusFilterTemplate = (options: any) => {
        const statusOptions = [
            { label: '未支付', value: 'inactive' },
            { label: '等待确认', value: 'waiting' },
            { label: '已激活', value: 'active' }
        ];

        return (
            <Dropdown
                value={options.value}
                options={statusOptions}
                onChange={(e) => options.filterApplyCallback(e.value)}
                placeholder="选择状态"
                className="p-column-filter"
                showClear
            />
        );
    };

    // 订阅等级过滤器组件
    const tierFilterTemplate = (options: any) => {
        const tierOptions = [
            { label: '等级 1', value: 1 },
            { label: '等级 2', value: 2 },
            { label: '等级 3', value: 3 }
        ];

        return (
            <Dropdown
                value={options.value}
                options={tierOptions}
                onChange={(e) => options.filterApplyCallback(e.value)}
                placeholder="选择等级"
                className="p-column-filter"
                showClear
            />
        );
    };

    // 学员姓名过滤器组件
    const studentFilterTemplate = (options: any) => {
        return (
            <InputText
                value={options.value || ''}
                onChange={(e) => options.filterApplyCallback(e.target.value)}
                placeholder="搜索学员"
                className="p-column-filter"
            />
        );
    };

    // 教练姓名过滤器组件
    const coachFilterTemplate = (options: any) => {
        return (
            <InputText
                value={options.value || ''}
                onChange={(e) => options.filterApplyCallback(e.target.value)}
                placeholder="搜索教练"
                className="p-column-filter"
            />
        );
    };

    const dateTemplate = (rowData: SubscriptionWithProfiles) => {
        return new Date(rowData.created_at).toLocaleString('zh-CN');
    };

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        const page = event.page + 1; // API使用1基索引
        loadSubscriptions(page, event.rows);
    };

    if (status === 'loading' || loading) {
        return (
            <div className="p-6">
                <div className="mb-6">
                    <Skeleton width="200px" height="32px" />
                </div>
                <div className="p-4">
                    <Skeleton width="100%" height="400px" />
                </div>
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
                        onClick={() => {
                            const currentPage = Math.floor(first / rows) + 1;
                            loadSubscriptions(currentPage, rows);
                        }}
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
                filterDisplay="row"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                <Column
                    filterField="studentProfile.full_name"
                    header="学员"
                    body={studentTemplate}
                    filter
                    filterElement={studentFilterTemplate}
                    showFilterMenu={false}
                ></Column>
                <Column
                    filterField="coachProfile.full_name"
                    header="教练"
                    body={coachTemplate}
                    filter
                    filterElement={coachFilterTemplate}
                    showFilterMenu={false}
                ></Column>
                <Column
                    filterField="tier"
                    header="订阅等级"
                    body={tierTemplate}
                    filter
                    filterElement={tierFilterTemplate}
                    showFilterMenu={false}
                ></Column>
                <Column field="monthly_price" header="月费" body={priceTemplate} align="right"></Column>
                <Column
                    filterField="status"
                    header="状态"
                    body={statusTemplate}
                    filter
                    filterElement={statusFilterTemplate}
                    showFilterMenu={false}
                    showClearButton
                ></Column>
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

            {subscriptions.length > 0 && (
                <div className="mt-4 text-sm text-surface-500">
                    已选择 {selectedSubscriptions.length} 个订阅，确认支付后将激活这些订阅。
                </div>
            )}
        </div>
    );
}