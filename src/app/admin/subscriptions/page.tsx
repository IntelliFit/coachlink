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
import type { ListSubscriptionGetDto, QueryCoachSubscription } from '@/app/api/subscription/list-subscriptions/entity';
import { StatusFilterComponent, statusTemplate } from '../payments/StatusFilterComponent';
import { TierFilterComponent, tierTemplate } from '../payments/TierFilterComponent';
import { StudentFilterComponent } from '../payments/StudentFilterComponent';
import { CoachFilterComponent } from '../payments/CoachFilterComponent';
import { StudentInfoComponent } from '../payments/StudentInfoComponent';
import { CoachInfoComponent } from '../payments/CoachInfoComponent';

interface SubscriptionWithProfiles extends QueryCoachSubscription {
}

export default function AdminSubscriptionsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [subscriptions, setSubscriptions] = useState<SubscriptionWithProfiles[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [filters, setFilters] = useState<any>({
        'student': { value: null, matchMode: 'equals' },
        'coach': { value: null, matchMode: 'equals' },
        'tier': { value: null, matchMode: 'equals' },
        'status': { value: null, matchMode: 'equals' }
    });

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }

        loadSubscriptions(1, rows);
    }, [session, status]);

    const loadSubscriptions = async (
        page: number = 1,
        limit: number = rows,
        filters?: any
    ) => {
        try {
            setLoading(true);

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

            if (filters?.status?.value) {
                reqData.status = filters.status.value;
            }

            if (filters?.tier?.value) {
                reqData.tier = filters.tier.value;
            }

            const res = await subscriptionService.listSubscriptions(reqData);

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
            showToast({
                severity: 'warn',
                summary: '已废弃',
                detail: '管理员后台不再参与支付确认；平台支付自动确认，个人收款码由教练确认。'
            });
            return;
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
            profile={subscription.student}
            tier={subscription.tier}
        />
    );

    const coachTemplate = (subscription: SubscriptionWithProfiles) => (
        <CoachInfoComponent profile={subscription.coach} />
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
            <div className="min-w-0 break-words" title={subscription.remind_coach_note}>
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
        const page = event.page + 1;
        loadSubscriptions(page, event.rows);
    };

    const onFilter = (event: DataTableStateEvent) => {
        setFilters(event.filters);
        setFirst(0);
        loadSubscriptions(1, rows, event.filters);
    };

    const skeletonData = Array.from({ length: rows }).map((_, index) => ({
        id: `skeleton-${index}`,
        student: {},
        coach: {},
        tier: '',
        monthly_price: 0,
        status: '',
        remind_coach_note: '',
        created_at: '',
        order_id: ''
    }));

    return (
        <div className="w-full min-w-0">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-surface-900">订阅管理</h1>
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
                        label="支付确认已废弃"
                        icon="pi pi-check"
                        onClick={handleConfirm}
                        disabled
                        className="p-button-secondary"
                    />
                </div>
            </div>

            <div className="w-full overflow-x-auto rounded-lg border border-surface-200">
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
                    dataKey="id"
                    filterDisplay="row"
                    className="w-full"
                >
                <Column
                    filterField="student"
                    header="学员"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : studentTemplate(rowData)}
                    filter
                    filterElement={(options) => <StudentFilterComponent options={options} />}
                    showFilterMenu={false}
                    style={{ minWidth: '140px' }}
                ></Column>
                <Column
                    filterField="coach"
                    header="教练"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : coachTemplate(rowData)}
                    filter
                    filterElement={(options) => <CoachFilterComponent options={options} />}
                    showFilterMenu={false}
                    style={{ minWidth: '120px' }}
                ></Column>
                <Column
                    filterField="tier"
                    header="订阅等级"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : tierTemplate(rowData.tier)}
                    filter
                    filterElement={(options) => <TierFilterComponent options={options} />}
                    showFilterMenu={false}
                    style={{ minWidth: '90px' }}
                ></Column>
                <Column
                    field="monthly_price"
                    header="月费"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : priceTemplate(rowData)}
                    align="right"
                    style={{ minWidth: '90px' }}
                ></Column>
                <Column
                    filterField="status"
                    header="状态"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : statusTemplate(rowData.status)}
                    filter
                    filterElement={(options) => <StatusFilterComponent options={options} />}
                    showFilterMenu={false}
                    showClearButton
                    style={{ minWidth: '100px' }}
                ></Column>
                <Column
                    field="remind_coach_note"
                    header="支付备注"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : noteTemplate(rowData)}
                    style={{ minWidth: '180px', maxWidth: '280px' }}
                ></Column>
                <Column
                    field="created_at"
                    header="申请时间"
                    body={(rowData) => loading ? <Skeleton width="100%" height="2rem" /> : dateTemplate(rowData)}
                    style={{ minWidth: '150px' }}
                ></Column>
            </DataTable>
            </div>

            {!loading && subscriptions.length > 0 && (
                <div className="mt-4 text-sm text-surface-500">
                    共 {totalRecords} 条订阅记录
                </div>
            )}
        </div>
    );
}
