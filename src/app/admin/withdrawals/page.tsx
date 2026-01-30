'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { DataTable, DataTableStateEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Skeleton } from 'primereact/skeleton';
import { useToastContext } from '@/context/ToastContext';
import axios from 'axios';
import { format } from 'date-fns';

interface WithdrawalItem {
    id: string;
    coach_id: string;
    coach_name: string;
    coach_user_id: string | null;
    amount: number;
    fee: number;
    status: 'pending' | 'success' | 'failed' | 'cancelled';
    out_biz_no: string | null;
    alipay_order_id: string | null;
    payee_account: string | null;
    payee_type: string | null;
    real_name: string | null;
    confirmed_by_user_id: string | null;
    confirmed_by_name: string | null;
    created_at: string;
    processed_at: string | null;
}

export default function AdminWithdrawalsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(20);
    const [totalRecords, setTotalRecords] = useState(0);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [selectedWithdrawal, setSelectedWithdrawal] = useState<WithdrawalItem | null>(null);
    const [alipayOrderId, setAlipayOrderId] = useState('');
    const [confirming, setConfirming] = useState(false);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }

        loadWithdrawals(1, rows, statusFilter);
    }, [session, status, statusFilter]);

    const loadWithdrawals = async (page: number = 1, limit: number = rows, status?: string | null) => {
        try {
            setLoading(true);
            const offset = (page - 1) * limit;
            const params = new URLSearchParams({
                limit: limit.toString(),
                offset: offset.toString(),
            });
            if (status) {
                params.append('status', status);
            }

            const res = await axios.get(`/api/admin/withdrawals?${params.toString()}`);
            if (res.data && res.data.success) {
                setWithdrawals(res.data.data.list || []);
                setTotalRecords(res.data.data.total || 0);
            }
        } catch (error) {
            console.error('加载提现记录失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载提现数据' });
        } finally {
            setLoading(false);
        }
    };

    const handleConfirm = async () => {
        if (!selectedWithdrawal || !alipayOrderId.trim()) {
            showToast({ severity: 'warn', summary: '提示', detail: '请填写转账订单号' });
            return;
        }

        setConfirming(true);
        try {
            const res = await axios.post('/api/admin/withdrawals/confirm', {
                id: selectedWithdrawal.id,
                alipay_order_id: alipayOrderId.trim(),
            });

            if (res.data && res.data.success) {
                showToast({ severity: 'success', summary: '成功', detail: '已确认到账' });
                setShowConfirmDialog(false);
                setSelectedWithdrawal(null);
                setAlipayOrderId('');
                const currentPage = Math.floor(first / rows) + 1;
                loadWithdrawals(currentPage, rows, statusFilter);
            } else {
                showToast({ severity: 'error', summary: '失败', detail: res.data?.message || '确认失败' });
            }
        } catch (error: any) {
            console.error('确认到账失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: error?.response?.data?.message || '确认到账失败，请稍后重试',
            });
        } finally {
            setConfirming(false);
        }
    };

    const openConfirmDialog = (withdrawal: WithdrawalItem) => {
        setSelectedWithdrawal(withdrawal);
        setAlipayOrderId(withdrawal.alipay_order_id || '');
        setShowConfirmDialog(true);
    };

    const statusTemplate = (rowData: WithdrawalItem) => {
        const statusMap: Record<string, { label: string; className: string }> = {
            pending: { label: '待处理', className: 'bg-yellow-100 text-yellow-800' },
            success: { label: '已到账', className: 'bg-green-100 text-green-800' },
            failed: { label: '失败', className: 'bg-red-100 text-red-800' },
            cancelled: { label: '已撤回', className: 'bg-gray-100 text-gray-800' },
        };
        const statusInfo = statusMap[rowData.status] || { label: rowData.status, className: 'bg-gray-100 text-gray-800' };
        return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${statusInfo.className}`}>
                {statusInfo.label}
            </span>
        );
    };

    const amountTemplate = (rowData: WithdrawalItem) => {
        return <div className="text-right font-mono">¥{Number(rowData.amount).toFixed(2)}</div>;
    };

    const accountTemplate = (rowData: WithdrawalItem) => {
        if (!rowData.payee_account) return <span className="text-surface-500">—</span>;
        return (
            <div className="text-sm">
                <div className="font-mono">{rowData.payee_account}</div>
                {rowData.real_name && <div className="text-xs text-surface-500">{rowData.real_name}</div>}
            </div>
        );
    };

    const actionTemplate = (rowData: WithdrawalItem) => {
        if (rowData.status !== 'pending') {
            return <span className="text-surface-500 text-sm">—</span>;
        }
        return (
            <Button
                label="确认到账"
                icon="pi pi-check"
                size="small"
                onClick={() => openConfirmDialog(rowData)}
                className="p-button-sm"
            />
        );
    };

    const dateTemplate = (rowData: WithdrawalItem, field: 'created_at' | 'processed_at') => {
        const date = rowData[field];
        if (!date) return <span className="text-surface-500">—</span>;
        return <span className="text-sm">{format(new Date(date), 'yyyy-MM-dd HH:mm')}</span>;
    };

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        const page = event.page + 1;
        loadWithdrawals(page, event.rows, statusFilter);
    };

    const skeletonData = Array.from({ length: rows }).map((_, index) => ({
        id: `skeleton-${index}`,
        coach_name: '',
        amount: 0,
        status: 'pending' as const,
        created_at: '',
    }));

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-surface-900">提现管理</h1>
                <div className="flex gap-2">
                    <Button
                        label="全部"
                        icon="pi pi-list"
                        onClick={() => {
                            setStatusFilter(null);
                            setFirst(0);
                            loadWithdrawals(1, rows, null);
                        }}
                        className={statusFilter === null ? '' : 'p-button-outlined'}
                    />
                    <Button
                        label="待处理"
                        icon="pi pi-clock"
                        onClick={() => {
                            setStatusFilter('pending');
                            setFirst(0);
                            loadWithdrawals(1, rows, 'pending');
                        }}
                        className={statusFilter === 'pending' ? '' : 'p-button-outlined'}
                    />
                    <Button
                        label="已到账"
                        icon="pi pi-check-circle"
                        onClick={() => {
                            setStatusFilter('success');
                            setFirst(0);
                            loadWithdrawals(1, rows, 'success');
                        }}
                        className={statusFilter === 'success' ? '' : 'p-button-outlined'}
                    />
                    <Button
                        label="刷新"
                        icon="pi pi-refresh"
                        onClick={() => {
                            const currentPage = Math.floor(first / rows) + 1;
                            loadWithdrawals(currentPage, rows, statusFilter);
                        }}
                        className="p-button-outlined"
                    />
                </div>
            </div>

            <DataTable
                value={loading ? skeletonData : withdrawals}
                paginator
                rows={rows}
                totalRecords={loading ? rows : totalRecords}
                first={first}
                onPage={onPage}
                stripedRows
                tableStyle={{ minWidth: '50rem' }}
            >
                <Column
                    field="coach_name"
                    header="教练"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : (
                            <div className="font-medium">{rowData.coach_name || '—'}</div>
                        )
                    }
                    headerStyle={{ width: '12%' }}
                />
                <Column
                    field="amount"
                    header="提现金额"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : amountTemplate(rowData)
                    }
                    headerStyle={{ width: '10%' }}
                />
                <Column
                    field="payee_account"
                    header="支付宝账号"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : accountTemplate(rowData)
                    }
                    headerStyle={{ width: '15%' }}
                />
                <Column
                    field="status"
                    header="状态"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : statusTemplate(rowData)
                    }
                    headerStyle={{ width: '10%' }}
                />
                <Column
                    field="out_biz_no"
                    header="提现单号"
                    body={(rowData) =>
                        loading ? (
                            <Skeleton width="100%" height="2rem" />
                        ) : (
                            <span className="text-xs font-mono text-surface-600">
                                {rowData.out_biz_no ? rowData.out_biz_no.substring(0, 16) + '...' : '—'}
                            </span>
                        )
                    }
                    headerStyle={{ width: '15%' }}
                />
                <Column
                    field="alipay_order_id"
                    header="转账订单号"
                    body={(rowData) =>
                        loading ? (
                            <Skeleton width="100%" height="2rem" />
                        ) : (
                            <span className="text-sm">{rowData.alipay_order_id || <span className="text-surface-500">未填写</span>}</span>
                        )
                    }
                    headerStyle={{ width: '15%' }}
                />
                <Column
                    field="created_at"
                    header="申请时间"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : dateTemplate(rowData, 'created_at')
                    }
                    headerStyle={{ width: '12%' }}
                />
                <Column
                    field="processed_at"
                    header="处理时间"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : dateTemplate(rowData, 'processed_at')
                    }
                    headerStyle={{ width: '12%' }}
                />
                <Column
                    field="confirmed_by"
                    header="确认人"
                    body={(rowData) =>
                        loading ? (
                            <Skeleton width="100%" height="2rem" />
                        ) : rowData.confirmed_by_user_id ? (
                            <span className="text-sm">
                                {rowData.confirmed_by_name ? `${rowData.confirmed_by_name} (` : ''}
                                <span className="font-mono text-surface-600">{rowData.confirmed_by_user_id}</span>
                                {rowData.confirmed_by_name ? ')' : ''}
                            </span>
                        ) : (
                            <span className="text-surface-500">—</span>
                        )
                    }
                    headerStyle={{ width: '12%' }}
                />
                <Column
                    header="操作"
                    body={(rowData) =>
                        loading ? <Skeleton width="100%" height="2rem" /> : actionTemplate(rowData)
                    }
                    headerStyle={{ width: '10%' }}
                />
            </DataTable>

            <Dialog
                header="确认到账"
                visible={showConfirmDialog}
                style={{ width: '500px' }}
                onHide={() => {
                    if (!confirming) {
                        setShowConfirmDialog(false);
                        setSelectedWithdrawal(null);
                        setAlipayOrderId('');
                    }
                }}
                footer={
                    <div>
                        <Button
                            label="取消"
                            icon="pi pi-times"
                            onClick={() => {
                                setShowConfirmDialog(false);
                                setSelectedWithdrawal(null);
                                setAlipayOrderId('');
                            }}
                            disabled={confirming}
                            className="p-button-text"
                        />
                        <Button
                            label="确认"
                            icon="pi pi-check"
                            onClick={handleConfirm}
                            loading={confirming}
                            className="p-button-primary"
                        />
                    </div>
                }
            >
                {selectedWithdrawal && (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">教练</label>
                            <div className="text-surface-700">{selectedWithdrawal.coach_name}</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">提现金额</label>
                            <div className="text-surface-700 font-mono">¥{Number(selectedWithdrawal.amount).toFixed(2)}</div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">支付宝账号</label>
                            <div className="text-surface-700">
                                {selectedWithdrawal.payee_account || '—'}
                                {selectedWithdrawal.real_name && ` (${selectedWithdrawal.real_name})`}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                转账订单号 <span className="text-red-500">*</span>
                            </label>
                            <InputText
                                value={alipayOrderId}
                                onChange={(e) => setAlipayOrderId(e.target.value)}
                                placeholder="请输入支付宝转账订单号"
                                className="w-full"
                                disabled={confirming}
                            />
                            <div className="text-xs text-surface-500 mt-1">
                                请填写您手动转账时的支付宝订单号
                            </div>
                        </div>
                        {selectedWithdrawal.status === 'success' && selectedWithdrawal.confirmed_by_user_id && (
                            <div>
                                <label className="block text-sm font-medium mb-2">确认人</label>
                                <div className="text-surface-700 text-sm">
                                    {selectedWithdrawal.confirmed_by_name ? `${selectedWithdrawal.confirmed_by_name} (` : ''}
                                    <span className="font-mono text-xs">{selectedWithdrawal.confirmed_by_user_id}</span>
                                    {selectedWithdrawal.confirmed_by_name ? ')' : ''}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </Dialog>
        </div>
    );
}
