'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { DataTable, DataTableStateEvent } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Skeleton } from 'primereact/skeleton';
import { Tag } from 'primereact/tag';
import { MultiSelect } from 'primereact/multiselect';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import CoachApplicationDialog from './CoachApplicationDialog';
import ReviewNotesDialog from './ReviewNotesDialog';
import type { CoachApplicationRow } from '@/types';

const STATUS_OPTIONS = [
    { label: '待审核', value: 'pending', severity: 'warning' },
    { label: '审核中', value: 'reviewing', severity: 'info' },
    { label: '已通过', value: 'approved', severity: 'success' },
    { label: '已拒绝', value: 'rejected', severity: 'danger' },
    { label: '补充材料', value: 'needs_info', severity: 'secondary' }
];

export default function AdminCoachApplicationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [applications, setApplications] = useState<CoachApplicationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);
    const [selectedApplications, setSelectedApplications] = useState<CoachApplicationRow[]>([]);
    const [filters, setFilters] = useState<any>({
        status: { value: null, matchMode: 'equals' }
    });
    const [dialogVisible, setDialogVisible] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState<CoachApplicationRow | null>(null);
    const [reviewNotesDialogVisible, setReviewNotesDialogVisible] = useState(false);
    const [applicationToReject, setApplicationToReject] = useState<string | null>(null);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }
        loadApplications(1, rows);
    }, [session, status]);

    const loadApplications = async (page: number = 1, limit: number = rows, statusFilter?: string | null) => {
        try {
            setLoading(true);
            const res = await coachService.listCoachApplications({
                page,
                limit,
                status: statusFilter || undefined
            });
            if (res) {
                setApplications(res.applications);
                setTotalRecords(res.pagination.total);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法获取申请数据' });
        } finally {
            setLoading(false);
        }
    };

    // --- 模板渲染 ---

    const statusTemplate = (rowData: CoachApplicationRow) => {
        if (loading) return <Skeleton width="60px" height="24px" />;
        const config = STATUS_OPTIONS.find(opt => opt.value === rowData.status);
        return <Tag severity={config?.severity as any} value={config?.label || rowData.status} rounded />;
    };

    const userInfoTemplate = (rowData: CoachApplicationRow) => {
        if (loading) return <Skeleton width="120px" height="20px" />;
        return (
            <div className="flex flex-col">
                <span className="font-bold text-surface-900">{rowData.name}</span>
                <small className="text-surface-500">{rowData.contact_email}</small>
            </div>
        );
    };

    const actionTemplate = (rowData: CoachApplicationRow) => {
        if (loading) return <Skeleton width="100px" height="32px" />;
        return (
            <div className="flex gap-1 justify-content-end">
                <Button 
                    icon="pi pi-search" 
                    tooltip="查看详情" 
                    rounded text 
                    onClick={() => viewApplicationDetails(rowData)} 
                />
                {rowData.status === 'pending' && (
                    <>
                        <Button 
                            icon="pi pi-check" 
                            tooltip="批准" 
                            rounded text severity="success" 
                            onClick={() => approveApplication(rowData.id)} 
                        />
                        <Button 
                            icon="pi pi-times" 
                            tooltip="拒绝" 
                            rounded text severity="danger" 
                            onClick={() => openRejectDialog(rowData.id)} 
                        />
                    </>
                )}
            </div>
        );
    };

    // --- 业务逻辑 ---

    const viewApplicationDetails = async (application: CoachApplicationRow) => {
        try {
            const res = await coachService.getCoachApplication({ id: application.id });
            if (res?.application) {
                setSelectedApplication(res.application);
                setDialogVisible(true);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '详情加载失败' });
        }
    };

    const approveApplication = async (id: string) => {
        try {
            await coachService.updateCoachApplication({ id, status: 'approved' });
            showToast({ severity: 'success', summary: '已批准申请' });
            loadApplications(Math.floor(first / rows) + 1, rows, filters.status.value);
        } catch (error) {
            showToast({ severity: 'error', summary: '操作失败' });
        }
    };

    const handleRejectSubmit = async (notes: string) => {
        if (!applicationToReject) return;
        try {
            await coachService.updateCoachApplication({ id: applicationToReject, status: 'rejected', reviewNotes: notes });
            showToast({ severity: 'info', summary: '申请已拒绝' });
            loadApplications(Math.floor(first / rows) + 1, rows, filters.status.value);
        } catch (error) {
            showToast({ severity: 'error', summary: '操作失败' });
        } finally {
            setApplicationToReject(null);
            setReviewNotesDialogVisible(false);
        }
    };

    const openRejectDialog = (applicationId: string) => {
        setApplicationToReject(applicationId);
        setReviewNotesDialogVisible(true);
    };

    return (
        <div className="card p-4 md:p-6 mx-auto max-w-7xl">
            {/* 头部区域优化 */}
            <div className="flex flex-column md:flex-row justify-between items-center mb-5 gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-surface-900 m-0">教练入驻审核</h1>
                    <p className="text-surface-500 text-sm mt-1">管理并审核所有教练的资质申请</p>
                </div>
                <div className="flex gap-2">
                    <Button
                        icon="pi pi-refresh"
                        outlined
                        severity="secondary"
                        onClick={() => loadApplications(Math.floor(first / rows) + 1, rows, filters.status.value)}
                        disabled={loading}
                        tooltip="刷新数据"
                    />
                    {selectedApplications.length > 0 && (
                        <Button
                            label={`批量批准 (${selectedApplications.length})`}
                            icon="pi pi-check-circle"
                            severity="success"
                            onClick={() => {/* 逻辑同上 */}}
                            disabled={loading}
                        />
                    )}
                </div>
            </div>

            <DataTable
                value={loading ? Array.from({ length: 5 }) : applications}
                paginator
                rows={rows}
                totalRecords={totalRecords}
                lazy
                first={first}
                onPage={(e) => { setFirst(e.first); setRows(e.rows); loadApplications(e.page + 1, e.rows, filters.status.value); }}
                selection={selectedApplications}
                onSelectionChange={(e) => !loading && setSelectedApplications(e.value as CoachApplicationRow[])}
                filters={filters}
                onFilter={(e) => { setFilters(e.filters); setFirst(0); loadApplications(1, rows, e.filters?.status?.value); }}
                filterDisplay="row"
                className="p-datatable-sm shadow-1 border-round-xl overflow-hidden"
                responsiveLayout="stack"
                emptyMessage={<div className="p-5 text-center text-surface-400">暂无待处理的申请申请</div>}
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                <Column header="申请人信息" body={userInfoTemplate} style={{ minWidth: '14rem' }}></Column>
                <Column field="years_experience" header="教龄" body={(d) => loading ? <Skeleton /> : `${d.years_experience} 年`} style={{ width: '8rem' }}></Column>
                <Column 
                    field="status" 
                    header="状态" 
                    body={statusTemplate} 
                    style={{ width: '10rem' }}
                    filter
                    filterElement={
                        <MultiSelect
                            value={filters.status.value}
                            options={STATUS_OPTIONS}
                            onChange={(e) => {
                                const f = { ...filters };
                                f.status.value = e.value;
                                setFilters(f);
                                loadApplications(1, rows, e.value);
                            }}
                            placeholder="筛选状态"
                            className="p-column-filter"
                            maxSelectedLabels={1}
                        />
                    }
                ></Column>
                <Column header="申请时间" body={(d) => loading ? <Skeleton /> : new Date(d.applied_at).toLocaleDateString()} style={{ width: '10rem' }}></Column>
                <Column header="操作" body={actionTemplate} align="right" style={{ width: '12rem' }}></Column>
            </DataTable>

            <CoachApplicationDialog
                visible={dialogVisible}
                application={selectedApplication}
                onHide={() => setDialogVisible(false)}
            />

            <ReviewNotesDialog
                visible={reviewNotesDialogVisible}
                applicationId={applicationToReject || ''}
                onSubmit={handleRejectSubmit}
                onHide={() => { setReviewNotesDialogVisible(false); setApplicationToReject(null); }}
            />
        </div>
    );
}