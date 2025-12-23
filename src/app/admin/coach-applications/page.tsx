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

// 定义状态选项
const STATUS_OPTIONS = [
    { label: '待审核', value: 'pending' },
    { label: '审核中', value: 'reviewing' },
    { label: '已通过', value: 'approved' },
    { label: '已拒绝', value: 'rejected' },
    { label: '需要补充材料', value: 'needs_info' }
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
        // 检查用户权限
        if (status === 'loading') return;

        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }

        loadApplications(1, rows);
    }, [session, status]);

    const loadApplications = async (
        page: number = 1,
        limit: number = rows,
        statusFilter?: string | null
    ) => {
        try {
            setLoading(true);

            const reqData = {
                page: page,
                limit: limit,
                status: statusFilter || undefined
            };

            const res = await coachService.listCoachApplications(reqData);

            if (res) {
                setApplications(res.applications);
                setTotalRecords(res.pagination.total);
            }
        } catch (error) {
            console.error('加载教练申请失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载教练申请数据' });
        } finally {
            setLoading(false);
        }
    };

    const getCurrentData = () => {
        if (loading) {
            // 创建骨架数据用于加载状态
            return Array.from({ length: rows }).map((_, index) => ({
                id: `skeleton-${index}`,
                name: '',
                contact_email: '',
                status: '',
                applied_at: '',
                years_experience: 0
            }));
        }
        return applications;
    };

    const statusTemplate = (rowData: CoachApplicationRow) => {
        // 骨架屏状态下不渲染
        if (loading) {
            return <Skeleton width="60px" height="20px" />;
        }

        const statusOption = STATUS_OPTIONS.find(opt => opt.value === rowData.status);
        const severity = rowData.status === 'approved' ? 'success' :
            rowData.status === 'pending' ? 'warning' :
                rowData.status === 'reviewing' ? 'info' :
                    rowData.status === 'rejected' ? 'danger' : 'secondary';

        return <Tag severity={severity} value={statusOption?.label || rowData.status} />;
    };

    const dateTemplate = (rowData: CoachApplicationRow) => {
        // 骨架屏状态下不渲染
        if (loading) {
            return <Skeleton width="100px" height="20px" />;
        }

        return new Date(rowData.applied_at).toLocaleString('zh-CN');
    };

    const nameTemplate = (rowData: CoachApplicationRow) => {
        // 骨架屏状态下不渲染
        if (loading) {
            return <Skeleton width="80px" height="20px" />;
        }

        return rowData.name;
    };

    const emailTemplate = (rowData: CoachApplicationRow) => {
        // 骨架屏状态下不渲染
        if (loading) {
            return <Skeleton width="120px" height="20px" />;
        }

        return rowData.contact_email;
    };

    const experienceTemplate = (rowData: CoachApplicationRow) => {
        // 骨架屏状态下不渲染
        if (loading) {
            return <Skeleton width="40px" height="20px" />;
        }

        return rowData.years_experience;
    };

    const actionTemplate = (rowData: CoachApplicationRow) => {
        // 骨架屏状态下不渲染
        if (loading) {
            return <Skeleton width="80px" height="20px" />;
        }

        return (
            <div className="flex gap-2">
                <Button
                    icon="pi pi-eye"
                    rounded
                    text
                    onClick={() => viewApplicationDetails(rowData)}
                />
                {rowData.status === 'pending' && (
                    <>
                        <Button
                            icon="pi pi-check"
                            rounded
                            text
                            severity="success"
                            onClick={() => approveApplication(rowData.id)}
                        />
                        <Button
                            icon="pi pi-times"
                            rounded
                            text
                            severity="danger"
                            onClick={() => openRejectDialog(rowData.id)}
                        />
                    </>
                )}
            </div>
        );
    };

    const viewApplicationDetails = async (application: CoachApplicationRow) => {
        try {
            // 获取完整的申请信息
            const res = await coachService.getCoachApplication({ id: application.id });
            if (res?.application) {
                setSelectedApplication(res.application);
                setDialogVisible(true);
            }
        } catch (error) {
            console.error('获取申请详情失败:', error);
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载申请详情' });
        }
    };

    const openRejectDialog = (applicationId: string) => {
        setApplicationToReject(applicationId);
        setReviewNotesDialogVisible(true);
    };

    const handleRejectSubmit = async (notes: string) => {
        if (!applicationToReject) return;

        try {
            await coachService.updateCoachApplication({
                id: applicationToReject,
                status: 'rejected',
                reviewNotes: notes
            });

            showToast({ severity: 'info', summary: '操作成功', detail: `已拒绝申请` });

            // 重新加载当前页数据
            const currentPage = Math.floor(first / rows) + 1;
            const statusFilter = filters.status.value;
            loadApplications(currentPage, rows, statusFilter);
        } catch (error) {
            console.error('拒绝申请失败:', error);
            showToast({ severity: 'error', summary: '操作失败', detail: '无法拒绝申请' });
        } finally {
            setApplicationToReject(null);
        }
    };

    const approveApplication = async (id: string) => {
        try {
            await coachService.updateCoachApplication({
                id,
                status: 'approved'
            });

            showToast({ severity: 'success', summary: '操作成功', detail: `已批准申请` });

            // 重新加载当前页数据
            const currentPage = Math.floor(first / rows) + 1;
            const statusFilter = filters.status.value;
            loadApplications(currentPage, rows, statusFilter);
        } catch (error) {
            console.error('批准申请失败:', error);
            showToast({ severity: 'error', summary: '操作失败', detail: '无法批准申请' });
        }
    };

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
        const page = event.page + 1; // API使用1基索引
        const statusFilter = filters.status.value;
        loadApplications(page, event.rows, statusFilter);
    };

    const onFilter = (event: DataTableStateEvent) => {
        setFilters(event.filters);

        // 重置到第一页并加载数据
        setFirst(0);
        const statusFilter = event.filters?.status?.value;
        loadApplications(1, rows, statusFilter);
    };

    const handleBatchApprove = async () => {
        try {
            // 批量批准申请
            const updatePromises = selectedApplications.map(app =>
                coachService.updateCoachApplication({
                    id: app.id,
                    status: 'approved'
                })
            );

            await Promise.all(updatePromises);

            showToast({
                severity: 'success',
                summary: '成功',
                detail: `成功批准 ${selectedApplications.length} 个申请`
            });

            // 清空选择并重新加载数据
            setSelectedApplications([]);
            const currentPage = Math.floor(first / rows) + 1;
            const statusFilter = filters.status.value;
            loadApplications(currentPage, rows, statusFilter);
        } catch (error) {
            console.error('批量批准失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '批量批准失败，请稍后重试'
            });
        }
    };

    return (
        <div className="p-6">
            <div className="flex flex-column md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-surface-900 m-0">教练申请管理</h1>
                <div className="flex gap-2">
                    <Button
                        label="刷新"
                        icon="pi pi-refresh"
                        onClick={() => {
                            const currentPage = Math.floor(first / rows) + 1;
                            const statusFilter = filters.status.value;
                            loadApplications(currentPage, rows, statusFilter);
                        }}
                        disabled={loading}
                    />
                    {selectedApplications.length > 0 && (
                        <Button
                            label={`批量批准 (${selectedApplications.length})`}
                            icon="pi pi-check-circle"
                            severity="success"
                            onClick={handleBatchApprove}
                            disabled={loading}
                        />
                    )}
                </div>
            </div>

            <DataTable
                value={getCurrentData()}
                paginator
                rows={rows}
                totalRecords={totalRecords}
                first={first}
                onPage={onPage}
                loading={false}
                stripedRows
                tableStyle={{ minWidth: '70rem' }}
                selection={selectedApplications}
                onSelectionChange={(e) => !loading && setSelectedApplications(e.value as CoachApplicationRow[])}
                filters={filters}
                onFilter={onFilter}
                selectionMode="checkbox"
                filterDisplay="row"
            >
                <Column selectionMode="multiple" headerStyle={{ width: '3rem' }}></Column>
                <Column field="name" header="姓名" body={nameTemplate} sortable style={{ width: '15%' }}></Column>
                <Column field="contact_email" header="联系邮箱" body={emailTemplate} sortable style={{ width: '20%' }}></Column>
                <Column field="years_experience" header="教学经验(年)" body={experienceTemplate} sortable style={{ width: '10%' }}></Column>
                <Column
                    field="status"
                    header="状态"
                    body={statusTemplate}
                    sortable
                    filter
                    filterElement={
                        <MultiSelect
                            value={filters.status.value}
                            options={STATUS_OPTIONS}
                            onChange={(e) => {
                                const newFilters = { ...filters };
                                newFilters.status.value = e.value;
                                setFilters(newFilters);

                                // 触发过滤
                                const event: DataTableStateEvent = {
                                    filters: newFilters
                                } as DataTableStateEvent;
                                onFilter(event);
                            }}
                            placeholder="选择状态"
                            className="w-full"
                            maxSelectedLabels={1}
                            disabled={loading}
                        />
                    }
                    style={{ width: '15%' }}
                ></Column>
                <Column field="applied_at" header="申请时间" body={dateTemplate} sortable style={{ width: '20%' }}></Column>
                <Column header="操作" body={actionTemplate} style={{ width: '20%' }}></Column>
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
                onHide={() => {
                    setReviewNotesDialogVisible(false);
                    setApplicationToReject(null);
                }}
            />
        </div>
    );
}