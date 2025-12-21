'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { DataTable, DataTableStateEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import type { ListSubscriptionGetDto, ListSubscriptionGetResponseDto, QueryCoachSubscription } from '@/app/api/subscription/list-subscriptions/entity';
import { StatusFilterComponent, statusTemplate } from './StatusFilterComponent';
import { TierFilterComponent, tierTemplate } from './TierFilterComponent';
import { StudentFilterComponent } from './StudentFilterComponent';
import { CoachFilterComponent } from './CoachFilterComponent';
import { StudentInfoComponent } from './StudentInfoComponent';
import { CoachInfoComponent } from './CoachInfoComponent';

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
    const [filters, setFilters] = useState<any>({
        'student': { value: null, matchMode: 'equals' },
        'coach': { value: null, matchMode: 'equals' },
        'tier': { value: null, matchMode: 'equals' },
        'status': { value: null, matchMode: 'equals' }
    });

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

    const loadSubscriptions = async (
        page: number = 1,
        limit: number = rows,
        filters?: any
    ) => {
        try {
            setLoading(true);

            // 构造过滤参数
            const reqData: ListSubscriptionGetDto = {
                page: page,
                limit: limit
            };            
            
            if (filters?.coach?.value) {
                reqData.coachId = filters.coach.value.id;
            }

            if (filters?.student?.value) {
                reqData.studentId = filters.student.value.id;
            }

            if (filters?.status.value) {
                reqData.status = filters.status.value;
            }

            if (filters?.tier.value) {
                reqData.tier = filters.tier.value;
            }

            // 使用新的分页接口获取所有等待支付确认的订阅
            // 管理员需要看到所有状态的订阅，包括 waiting
            const res = await subscriptionService.listSubscriptions(reqData);

            console.log(res);
            

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
        <StudentInfoComponent
            profile={subscription.studentProfile}
            tier={subscription.tier}
        />
    );

    const coachTemplate = (subscription: SubscriptionWithProfiles) => (
        <CoachInfoComponent profile={subscription.coachProfile} />
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
            <div className="max-w-xs" title={subscription.remind_coach_note}>
                {subscription.remind_coach_note}
            </div>
        ) : (
            <div className="text-surface-500 italic">无备注</div>
        )
    );


    const dateTemplate = (rowData: SubscriptionWithProfiles) => {
        return new Date(rowData.created_at).toLocaleString('zh-CN');
    };

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        const page = event.page + 1; // API使用1基索引
        loadSubscriptions(page, event.rows);
    };

    const onFilter = (event: DataTableStateEvent) => {
        setFilters(event.filters);

        // 重置到第一页并加载数据
        setFirst(0);
        loadSubscriptions(1, rows, event.filters);
    };

    // 创建骨架数据用于加载状态
    const skeletonData = Array.from({ length: rows }).map((_, index) => ({
        id: `skeleton-${index}`,
        studentProfile: {},
        coachProfile: {},
        tier: '',
        monthly_price: 0,
        status: '',
        remind_coach_note: '',
        created_at: '',
        order_id: ''
    }));

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
                value={loading ? skeletonData : subscriptions}
                paginator
                rows={rows}
                totalRecords={loading ? rows : totalRecords}
                first={first}
                onPage={onPage}
                onFilter={onFilter}
                filters={filters}
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
                    filterField="student"
                    header="学员"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : studentTemplate(rowData)}
                    filter
                    filterElement={(options) => <StudentFilterComponent options={options} />}
                    showFilterMenu={false}
                    headerStyle={{ width: '20%' }}
                    bodyStyle={{ width: '20%' }}
                ></Column>
                <Column
                    filterField="coach"
                    header="教练"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : coachTemplate(rowData)}
                    filter
                    filterElement={(options) => <CoachFilterComponent options={options} />}
                    showFilterMenu={false}
                    headerStyle={{ width: '20%' }}
                    bodyStyle={{ width: '20%' }}
                ></Column>
                <Column
                    filterField="tier"
                    header="订阅等级"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : tierTemplate(rowData.tier)}
                    filter
                    filterElement={(options) => <TierFilterComponent options={options} />}
                    showFilterMenu={false}
                    headerStyle={{ width: '10%' }}
                    bodyStyle={{ width: '10%' }}
                ></Column>
                <Column
                    field="monthly_price"
                    header="月费"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : priceTemplate(rowData)}
                    align="right"
                    headerStyle={{ width: '10%' }}
                    bodyStyle={{ width: '10%' }}
                ></Column>
                <Column
                    filterField="status"
                    header="状态"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : statusTemplate(rowData.status)}
                    filter
                    filterElement={(options) => <StatusFilterComponent options={options} />}
                    showFilterMenu={false}
                    showClearButton
                    headerStyle={{ width: '10%' }}
                    bodyStyle={{ width: '10%' }}
                ></Column>
                <Column
                    field="remind_coach_note"
                    header="支付备注"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : noteTemplate(rowData)}
                    headerStyle={{ width: '15%' }}
                    bodyStyle={{ width: '15%' }}
                ></Column>
                <Column
                    field="created_at"
                    header="申请时间"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : dateTemplate(rowData)}
                    headerStyle={{ width: '12%' }}
                    bodyStyle={{ width: '12%' }}
                ></Column>
            </DataTable>

            {!loading && subscriptions.length > 0 && (
                <div className="mt-4 text-sm text-surface-500">
                    已选择 {selectedSubscriptions.length}/{subscriptions.length} 个订阅，确认支付后将激活这些订阅。
                </div>
            )}
        </div>
    );
}