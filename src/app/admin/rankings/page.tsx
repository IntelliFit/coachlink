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

export default function AdminRankingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    
    const [rankings, setRankings] = useState<any[]>([]);
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
        
        loadRankings();
    }, [session, status]);

    const loadRankings = async () => {
        try {
            setLoading(true);
            // 这里应该调用实际的API获取排行榜数据
            // 暂时使用模拟数据
            const mockRankings = Array.from({ length: 25 }, (_, i) => ({
                id: i + 1,
                userId: `USER-${300 + i}`,
                userName: `用户${i + 1}`,
                score: Math.floor(Math.random() * 10000) + 1000,
                rank: i + 1,
                submissions: Math.floor(Math.random() * 50) + 1,
                lastSubmission: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000).toISOString()
            }));
            
            setRankings(mockRankings);
            setTotalRecords(mockRankings.length);
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载排行榜数据' });
        } finally {
            setLoading(false);
        }
    };

    const rankTemplate = (rowData: any) => {
        const isTopThree = rowData.rank <= 3;
        const rankColor = rowData.rank === 1 ? 'text-yellow-500' : 
                         rowData.rank === 2 ? 'text-gray-400' : 
                         rowData.rank === 3 ? 'text-amber-700' : '';
        
        return (
            <div className={`flex items-center ${isTopThree ? 'font-bold ' + rankColor : ''}`}>
                {rowData.rank}
                {isTopThree && <i className="pi pi-crown ml-2"></i>}
            </div>
        );
    };

    const dateTemplate = (rowData: any) => {
        return new Date(rowData.lastSubmission).toLocaleDateString('zh-CN');
    };

    const actionTemplate = (rowData: any) => {
        return (
            <div className="flex gap-2">
                <Button 
                    icon="pi pi-eye" 
                    rounded 
                    text 
                    onClick={() => router.push(`/admin/rankings/${rowData.id}`)}
                />
            </div>
        );
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
                <h1 className="text-2xl font-bold text-surface-900">排行榜管理</h1>
                <div className="flex gap-2">
                    <Button 
                        label="刷新" 
                        icon="pi pi-refresh" 
                        onClick={loadRankings}
                    />
                    <Button 
                        label="导出数据" 
                        icon="pi pi-download" 
                        onClick={() => showToast({ severity: 'info', summary: '功能提示', detail: '导出功能将在后续版本中实现' })}
                    />
                </div>
            </div>

            <Card>
                <DataTable 
                    value={rankings} 
                    paginator 
                    rows={rows}
                    totalRecords={totalRecords}
                    first={first}
                    onPage={onPage}
                    loading={loading}
                    stripedRows
                    tableStyle={{ minWidth: '50rem' }}
                >
                    <Column field="rank" header="排名" body={rankTemplate} sortable></Column>
                    <Column field="userName" header="用户名" sortable></Column>
                    <Column field="score" header="分数" sortable></Column>
                    <Column field="submissions" header="提交次数" sortable></Column>
                    <Column field="lastSubmission" header="最后提交" body={dateTemplate} sortable></Column>
                    <Column header="操作" body={actionTemplate}></Column>
                </DataTable>
            </Card>
        </div>
    );
}