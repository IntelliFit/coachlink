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
import { TabPanel, TabView } from 'primereact/tabview';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import CoachApplicationDialog from './CoachApplicationDialog';
import CoachOnboardingTable from './CoachOnboardingTable';
import ReviewNotesDialog, { type ReviewNotesMode } from './ReviewNotesDialog';
import type { CoachApplicationRow } from '@/types';
import { formatBeijingDate } from '@/lib/beijingTime';
import { getCoachTrackShortLabel } from '@/lib/coachApplicationOptions';

const STATUS_OPTIONS = [
    { label: '待审核', value: 'pending', severity: 'warning' },
    { label: '审核中', value: 'reviewing', severity: 'info' },
    { label: '已通过', value: 'approved', severity: 'success' },
    { label: '已拒绝', value: 'rejected', severity: 'danger' },
    { label: '补充材料', value: 'needs_info', severity: 'secondary' }
];

// 待审核、审核中、待补充材料都还没有结论，可以通过或驳回
const OPEN_STATUSES = ['pending', 'reviewing', 'needs_info'];

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
    const [applicationToReview, setApplicationToReview] = useState<string | null>(null);
    const [reviewNotesMode, setReviewNotesMode] = useState<ReviewNotesMode>('reject');
    const [batchApproving, setBatchApproving] = useState(false);

    useEffect(() => {
        if (status === 'loading') return;
        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }
        loadApplications(1, rows);
    }, [session, status]);

    const loadApplications = async (page: number = 1, limit: number = rows, statusFilter?: string | string[] | null) => {
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
                {rowData.contact_phone && (
                    <span className="flex items-center gap-1 text-sm text-surface-700">
                        {rowData.contact_phone}
                        <Button
                            icon="pi pi-copy"
                            rounded text size="small"
                            tooltip="复制手机号"
                            onClick={() => copyPhone(rowData.contact_phone!)}
                        />
                    </span>
                )}
                {rowData.contact_email && <small className="text-surface-500">{rowData.contact_email}</small>}
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
                {OPEN_STATUSES.includes(rowData.status) && (
                    <>
                        <Button
                            icon="pi pi-check"
                            tooltip="批准"
                            rounded text severity="success"
                            onClick={() => approveApplication(rowData.id)}
                        />
                        {rowData.status !== 'needs_info' && (
                            <Button
                                icon="pi pi-file-edit"
                                tooltip="要求补充材料"
                                rounded text severity="warning"
                                onClick={() => openReviewNotesDialog(rowData.id, 'needs_info')}
                            />
                        )}
                        <Button
                            icon="pi pi-times"
                            tooltip="拒绝"
                            rounded text severity="danger"
                            onClick={() => openReviewNotesDialog(rowData.id, 'reject')}
                        />
                    </>
                )}
            </div>
        );
    };

    const trackTemplate = (rowData: CoachApplicationRow) => {
        if (loading) return <Skeleton width="72px" height="24px" />;
        const value = (rowData as any).coach_track;
        return (
            <Tag
                severity={value === 'buddy' ? 'contrast' : value === 'growth' ? 'info' : 'success'}
                value={getCoachTrackShortLabel(value)}
                rounded
            />
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

    const reloadCurrentPage = () => loadApplications(Math.floor(first / rows) + 1, rows, filters.status.value);

    const copyPhone = async (phone: string) => {
        try {
            await navigator.clipboard.writeText(phone);
            showToast({ severity: 'success', summary: '已复制手机号' });
        } catch {
            showToast({ severity: 'warn', summary: '复制失败，请手动复制' });
        }
    };

    const approveApplication = async (id: string) => {
        try {
            const res = await coachService.updateCoachApplication({ id, status: 'approved' });
            if (!res) throw new Error('approve failed');
            showToast({ severity: 'success', summary: '已批准申请' });
            reloadCurrentPage();
        } catch (error) {
            showToast({ severity: 'error', summary: '操作失败' });
        }
    };

    const approveSelected = async () => {
        const targets = selectedApplications.filter((application) => OPEN_STATUSES.includes(application.status));
        if (targets.length === 0) {
            showToast({ severity: 'warn', summary: '所选申请都已有审核结论' });
            return;
        }
        if (!window.confirm(`确认批准 ${targets.length} 份教练申请？批准后会立即开通教练端并私信通知申请人。`)) return;

        setBatchApproving(true);
        let approved = 0;
        // 逐个批准：每份都会写教练档案并发私信，串行更容易定位失败的那一份
        for (const application of targets) {
            try {
                const res = await coachService.updateCoachApplication({ id: application.id, status: 'approved' });
                if (res) approved += 1;
            } catch (error) {
                console.error('[admin/coach-applications] batch approve failed:', application.id, error);
            }
        }
        setBatchApproving(false);
        setSelectedApplications([]);
        showToast({
            severity: approved === targets.length ? 'success' : 'warn',
            summary: `已批准 ${approved}/${targets.length} 份申请`,
        });
        reloadCurrentPage();
    };

    const handleReviewNotesSubmit = async (notes: string) => {
        if (!applicationToReview) return;
        const status = reviewNotesMode === 'needs_info' ? 'needs_info' : 'rejected';
        try {
            const res = await coachService.updateCoachApplication({ id: applicationToReview, status, reviewNotes: notes });
            if (!res) throw new Error('review update failed');
            showToast({ severity: 'info', summary: status === 'needs_info' ? '已通知申请人补充材料' : '申请已拒绝' });
            reloadCurrentPage();
        } catch (error) {
            showToast({ severity: 'error', summary: '操作失败' });
        } finally {
            setApplicationToReview(null);
            setReviewNotesDialogVisible(false);
        }
    };

    const openReviewNotesDialog = (applicationId: string, mode: ReviewNotesMode) => {
        setApplicationToReview(applicationId);
        setReviewNotesMode(mode);
        setReviewNotesDialogVisible(true);
    };

    return (
        <div className="card p-4 md:p-6 mx-auto max-w-7xl">
            {/* 头部区域优化 */}
            <div className="mb-3">
                <h1 className="text-2xl font-bold text-surface-900 m-0">教练入驻审核</h1>
                <p className="text-surface-500 text-sm mt-1">审核教练资质申请，并跟进已通过教练的开店进度</p>
            </div>

            <TabView>
                <TabPanel header="入驻申请">
                    <div className="flex justify-end mb-3 gap-2">
                        <Button
                            icon="pi pi-refresh"
                            outlined
                            severity="secondary"
                            onClick={reloadCurrentPage}
                            disabled={loading}
                            tooltip="刷新数据"
                        />
                        {selectedApplications.length > 0 && (
                            <Button
                                label={`批量批准 (${selectedApplications.length})`}
                                icon={batchApproving ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'}
                                severity="success"
                                onClick={approveSelected}
                                disabled={loading || batchApproving}
                            />
                        )}
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
                        emptyMessage={<div className="p-5 text-center text-surface-400">暂无待处理的申请</div>}
                    >
                        <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                        <Column header="申请人信息" body={userInfoTemplate} style={{ minWidth: '14rem' }}></Column>
                        <Column header="层级" body={trackTemplate} style={{ width: '8rem' }}></Column>
                        <Column field="years_experience" header="教龄" body={(d) => loading ? <Skeleton /> : (d.years_experience ? `${d.years_experience} 年` : '—')} style={{ width: '8rem' }}></Column>
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
                        <Column header="申请时间" body={(d) => loading ? <Skeleton /> : formatBeijingDate(d.applied_at, 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })} style={{ width: '10rem' }}></Column>
                        <Column header="操作" body={actionTemplate} align="right" style={{ width: '12rem' }}></Column>
                    </DataTable>
                </TabPanel>
                <TabPanel header="开店进度">
                    <CoachOnboardingTable />
                </TabPanel>
            </TabView>

            <CoachApplicationDialog
                visible={dialogVisible}
                application={selectedApplication}
                onHide={() => setDialogVisible(false)}
            />

            <ReviewNotesDialog
                visible={reviewNotesDialogVisible}
                applicationId={applicationToReview || ''}
                mode={reviewNotesMode}
                onSubmit={handleReviewNotesSubmit}
                onHide={() => { setReviewNotesDialogVisible(false); setApplicationToReview(null); }}
            />
        </div>
    );
}
