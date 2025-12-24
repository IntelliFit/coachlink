'use client';

import React, { useState, useEffect } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { Tag } from 'primereact/tag';
import { Skeleton } from 'primereact/skeleton';
import { Tooltip } from 'primereact/tooltip'; // 引入 Tooltip 增强体验
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardTemplateRow } from '@/types';

interface LeaderboardListProps {
    refreshTrigger: boolean | number;
    onEdit: (leaderboard: LeaderboardTemplateRow) => void;
    onDelete: (id: string) => void;
}

export default function LeaderboardList({ refreshTrigger, onEdit, onDelete }: LeaderboardListProps) {
    const { showToast } = useToastContext();
    const [rankings, setRankings] = useState<LeaderboardTemplateRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [totalRecords, setTotalRecords] = useState(0);

    useEffect(() => {
        loadRankings();
    }, [refreshTrigger, first, rows]); // 增加分页依赖，确保翻页触发加载

    const loadRankings = async () => {
        try {
            setLoading(true);
            const reqData = {
                page: Math.floor(first / rows) + 1,
                limit: rows
            };
            const result = await rankingService.listLeaderboard(reqData);
            if (result) {
                setRankings(result.leaderboards || []);
                setTotalRecords(result.total || 0);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法加载数据' });
        } finally {
            setLoading(false);
        }
    };

    const onPage = (event: any) => {
        setFirst(event.first);
        setRows(event.rows);
    };

    // 时间格式化：增加具体时间点，更有仪式感
    const formatDate = (dateString: string | null) => {
        if (!dateString) return <span className="text-surface-400">未设置</span>;
        const d = new Date(dateString);
        return (
            <div className="flex flex-col">
                <span className="font-medium text-surface-900">{d.toLocaleDateString('zh-CN')}</span>
                <span className="text-xs text-surface-500">{d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        );
    };

    const statusTemplate = (rowData: LeaderboardTemplateRow) => {
        const now = new Date();
        const startAt = rowData.start_at ? new Date(rowData.start_at) : null;
        const endAt = rowAt = rowData.end_at ? new Date(rowData.end_at) : null;

        let status = { label: '未开始', severity: 'info' as any };
        if (startAt && now >= startAt) {
            if (endAt && now > endAt) {
                status = { label: '已结束', severity: 'danger' };
            } else {
                status = { label: '进行中', severity: 'success' };
            }
        }
        return <Tag value={status.label} severity={status.severity} className="px-3 py-1 rounded-full shadow-sm" />;
    };

    const actionTemplate = (rowData: LeaderboardTemplateRow) => (
        <div className="flex justify-end gap-1">
            <Button
                icon="pi pi-file-edit"
                rounded
                text
                severity="info"
                onClick={() => onEdit(rowData)}
                tooltip="编辑详情"
                tooltipOptions={{ position: 'top' }}
                className="hover:bg-blue-50"
            />
            <Button
                icon="pi pi-trash"
                rounded
                text
                severity="danger"
                onClick={() => onDelete(rowData.id)}
                tooltip="删除排行榜"
                tooltipOptions={{ position: 'top' }}
                className="hover:bg-red-50"
            />
        </div>
    );

    // 标题模板：加粗突出
    const titleTemplate = (rowData: LeaderboardTemplateRow) => (
        <span className="font-bold text-surface-900">{rowData.title}</span>
    );

    // 描述模板：自动截断并提供 Tooltip
    const descriptionTemplate = (rowData: LeaderboardTemplateRow) => (
        <div 
            className="text-surface-600 truncate max-w-[200px]" 
            title={rowData.description || ''}
        >
            {rowData.description || <span className="text-surface-300 italic">暂无描述</span>}
        </div>
    );

    if (loading && rankings.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-surface-200">
                <Skeleton width="100%" height="2rem" className="mb-4" />
                <Skeleton width="100%" height="15rem" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-surface-200 overflow-hidden">
            <DataTable
                value={rankings}
                paginator
                rows={rows}
                totalRecords={totalRecords}
                first={first}
                onPage={onPage}
                loading={loading}
                stripedRows
                rowHover
                responsiveLayout="scroll"
                className="p-datatable-sm" // 紧凑模式
                tableStyle={{ minWidth: '60rem' }}
                pt={{
                    header: { className: 'bg-white border-b border-surface-200 p-4' },
                    thead: { className: 'bg-surface-50 text-xs uppercase tracking-wider' },
                }}
            >
                <Column body={titleTemplate} header="排行榜名称" style={{ width: '20%' }} />
                <Column body={descriptionTemplate} header="描述" style={{ width: '20%' }} />
                <Column field="rank_by_field" header="排序依据" body={(r) => <code className="bg-surface-100 px-2 py-1 rounded text-primary text-xs font-mono">{r.rank_by_field}</code>} />
                <Column header="开始时间" body={(rowData) => formatDate(rowData.start_at)} />
                <Column header="结束时间" body={(rowData) => formatDate(rowData.end_at)} />
                <Column header="状态" body={statusTemplate} style={{ width: '100px' }} />
                <Column header="操作" body={actionTemplate} style={{ width: '130px' }} />
            </DataTable>
        </div>
    );
}