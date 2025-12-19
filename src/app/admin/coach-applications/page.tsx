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
import { useToastContext } from '@/context/ToastContext';

export default function AdminCoachApplicationsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);

    useEffect(() => {
        // 检查用户权限
        if (status === 'loading') return;
        
        if (!session?.user?.is_admin) {
            router.push('/');
            return;
        }
        
        loadApplications();
    }, [session, status]);

    const loadApplications = async () => {
        try {
            setLoading(true);
            // 这里应该调用实际的API获取教练申请数据
            // 暂时使用模拟数据
            const mockApplications = Array.from({ length: 15 }, (_, i) => ({
                id: i + 1,
                userId: `USER-${200 + i}`,
                name: `申请人${i + 1}`,
                email: `user${i + 1}@example.com`,
                status: ['pending', 'approved', 'rejected'][Math.floor(Math.random() * 3)],
                submittedAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
                experience: `${Math.floor(Math.random() * 10) + 1}年`
            }));
            
            setApplications(mockApplications);
            setTotalRecords(mockApplications.length);
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载教练申请数据' });
        } finally {
            setLoading(false);
        }
    };

    const statusTemplate = (rowData: any) => {
        const severity = rowData.status === 'approved' ? 'success' : 
                        rowData.status === 'pending' ? 'warning' : 'danger';
        const label = rowData.status === 'approved' ? '已批准' : 
                     rowData.status === 'pending' ? '待审核' : '已拒绝';
        
        return <Tag severity={severity} value={label} />;
    };

    const dateTemplate = (rowData: any) => {
        return new Date(rowData.submittedAt).toLocaleDateString('zh-CN');
    };

    const actionTemplate = (rowData: any) => {
        return (
            <div className="flex gap-2">
                <Button 
                    icon="pi pi-eye" 
                    rounded 
                    text 
                    onClick={() => router.push(`/admin/coach-applications/${rowData.id}`)}
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
                            onClick={() => rejectApplication(rowData.id)}
                        />
                    </>
                )}
            </div>
        );
    };

    const approveApplication = (id: number) => {
        showToast({ severity: 'success', summary: '操作成功', detail: `已批准申请 #${id}` });
        // 这里应该调用实际的API来批准申请
    };

    const rejectApplication = (id: number) => {
        showToast({ severity: 'info', summary: '操作成功', detail: `已拒绝申请 #${id}` });
        // 这里应该调用实际的API来拒绝申请
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
                <h1 className="text-2xl font-bold text-surface-900">教练申请管理</h1>
                <Button 
                    label="刷新" 
                    icon="pi pi-refresh" 
                    onClick={loadApplications}
                />
            </div>

            <Card>
                <DataTable 
                    value={applications} 
                    paginator 
                    rows={rows}
                    totalRecords={totalRecords}
                    first={first}
                    onPage={onPage}
                    loading={loading}
                    stripedRows
                    tableStyle={{ minWidth: '50rem' }}
                >
                    <Column field="id" header="ID" sortable></Column>
                    <Column field="name" header="姓名" sortable></Column>
                    <Column field="email" header="邮箱" sortable></Column>
                    <Column field="experience" header="经验" sortable></Column>
                    <Column field="status" header="状态" body={statusTemplate} sortable></Column>
                    <Column field="submittedAt" header="提交时间" body={dateTemplate} sortable></Column>
                    <Column header="操作" body={actionTemplate}></Column>
                </DataTable>
            </Card>
        </div>
    );
}