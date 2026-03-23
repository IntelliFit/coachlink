'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Dialog } from 'primereact/dialog';
import { Badge } from 'primereact/badge';
import { Avatar } from 'primereact/avatar';
import { Tag } from 'primereact/tag';
import { InputTextarea } from 'primereact/inputtextarea';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardEntriesRow } from '@/types';
import { GetLeaderboardResponseDto } from '@/app/api/ranking/get-leaderboard/entity';
import { formatBeijingDate } from '@/lib/beijingTime';

interface LeaderboardEntryWithProfile extends LeaderboardEntriesRow {
    userProfile: {
        name: string;
        avatar: string;
    };
}

const ReviewPage = () => {
    const params = useParams();
    const templateId = params.id as string;
    const { showToast } = useToastContext();

    const [entries, setEntries] = useState<LeaderboardEntryWithProfile[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    const [leaderboard, setLeaderboard] = useState<GetLeaderboardResponseDto['leaderboard']>(null);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntryWithProfile | null>(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);
    const [adminNote, setAdminNote] = useState('');

    const loadData = async (page: number = 1, limit: number = 10) => {
        try {
            setLoading(true);
            const response = await rankingService.listEntries({
                template_id: templateId,
                status: 'pending',
                page,
                limit,
                sort_by: 'created_at'
            });
            if (response) {
                setEntries(response.entries);
                setTotalRecords(response.total);
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '加载失败', detail: '无法获取审核列表' });
        } finally {
            setLoading(false);
        }
    };

    const loadTemplate = async () => { 
        const res = await rankingService.getLeaderboard({ id: templateId });
        if (res) setLeaderboard(res.leaderboard);
    };

    useEffect(() => {
        if (templateId) {
            loadData();
            loadTemplate();
        }
    }, [templateId]);

    const updateEntryStatus = async (entryId: string, newStatus: string, note?: string) => {
        try {
            const result = await rankingService.updateEntry({
                id: entryId,
                status: newStatus,
                ...(note && { note })
            });

            if (result) {
                // 审核后直接从列表中移除该项（因为当前是“待审核”视图）
                setEntries(prev => prev.filter(entry => entry.id !== entryId));
                setTotalRecords(prev => prev - 1);
                showToast({
                    severity: 'success',
                    summary: '处理完成',
                    detail: `已${newStatus === 'approved' ? '通过' : '拒绝'}该申请`
                });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '操作失败', detail: '系统错误' });
        }
    };

    // --- 模板部分 ---

    const userInfoTemplate = (rowData: LeaderboardEntryWithProfile) => (
        <div className="flex items-center gap-3">
            <Avatar image={rowData.userProfile.avatar} shape="circle" size="normal" 
                    icon={!rowData.userProfile.avatar ? "pi pi-user" : undefined} />
            <div className="flex flex-col">
                <span className="font-bold text-gray-800">{rowData.userProfile.name || '匿名用户'}</span>
                <small className="text-gray-400">Score: {rowData.score}</small>
            </div>
        </div>
    );

    const actionTemplate = (rowData: LeaderboardEntryWithProfile) => (
        <div className="flex gap-2">
            <Button icon="pi pi-search" tooltip="查看详情" className="p-button-text p-button-rounded" 
                    onClick={() => { setSelectedEntry(rowData); setAdminNote(rowData.note || ''); setShowDetailDialog(true); }} />
            <Button icon="pi pi-check" tooltip="快速通过" className="p-button-text p-button-success p-button-rounded" 
                    onClick={() => updateEntryStatus(rowData.id, 'approved')} />
            <Button icon="pi pi-times" tooltip="直接拒绝" className="p-button-text p-button-danger p-button-rounded" 
                    onClick={() => updateEntryStatus(rowData.id, 'rejected')} />
        </div>
    );

    if (loading && entries.length === 0) {
        return <div className="flex justify-center items-center h-screen"><ProgressSpinner strokeWidth="3" /></div>;
    }

    return (
        <div className="p-4 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">{leaderboard?.title || '条目审核'}</h1>
                    <p className="text-gray-500 text-sm">当前共有 {totalRecords} 个待处理申请</p>
                </div>
            </div>

            <DataTable
                value={entries}
                paginator
                rows={rows}
                totalRecords={totalRecords}
                lazy
                first={first}
                onPage={(e) => { setFirst(e.first); setRows(e.rows); loadData(Math.floor(e.first/e.rows)+1, e.rows); }}
                className="shadow-sm border-round-xl overflow-hidden"
                responsiveLayout="stack"
                emptyMessage={<div className="p-8 text-center text-gray-400">所有申请已处理完毕 ✨</div>}
            >
                <Column header="申请人" body={userInfoTemplate} />
                <Column field="score" header={leaderboard?.rank_by_field || '数值'} sortable />
                <Column header="提交时间" body={(d) => <span className="text-sm text-gray-600">{formatBeijingDate(d.created_at, 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>} />
                <Column header="操作" body={actionTemplate} />
            </DataTable>

            {/* 详情对话框 - 优化布局 */}
            <Dialog
                header="申请审核详情"
                visible={showDetailDialog}
                onHide={() => setShowDetailDialog(false)}
                style={{ width: '500px' }}
                closable
                draggable={false}
                modal
            >
                {selectedEntry && (
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-4 p-3 bg-gray-50 border-round-lg">
                            <Avatar image={selectedEntry.userProfile.avatar} size="large" shape="circle" />
                            <div>
                                <div className="text-xl font-bold">{selectedEntry.userProfile.name}</div>
                                <div className="text-primary font-medium text-lg">{leaderboard?.rank_by_field}: {selectedEntry.score}</div>
                            </div>
                        </div>

                        <section>
                            <label className="block text-sm font-semibold text-gray-500 mb-2">提交证据</label>
                            {selectedEntry.evidence_url ? (
                                <div className="border-round overflow-hidden border-1 border-gray-200">
                                    {selectedEntry.evidence_url.match(/\.(jpeg|jpg|gif|png)$/) ? (
                                        <img src={selectedEntry.evidence_url} alt="Evidence" className="w-full h-auto" />
                                    ) : (
                                        <a href={selectedEntry.evidence_url} target="_blank" className="p-3 block text-blue-600 underline">
                                            查看外部证据链接 <i className="pi pi-external-link ml-1" />
                                        </a>
                                    )}
                                </div>
                            ) : <span className="text-gray-400 italic">未提供证据</span>}
                        </section>

                        <section>
                            <label className="block text-sm font-semibold text-gray-500 mb-2">审核备注</label>
                            <InputTextarea
                                value={adminNote}
                                onChange={(e) => setAdminNote(e.target.value)}
                                rows={3}
                                className="w-full"
                                placeholder="输入拒绝原因或审核批注..."
                            />
                        </section>

                        <div className="flex gap-2 mt-4">
                            <Button label="拒绝" icon="pi pi-times" className="p-button-danger flex-1"
                                    onClick={() => { updateEntryStatus(selectedEntry.id, 'rejected', adminNote); setShowDetailDialog(false); }} />
                            <Button label="通过审核" icon="pi pi-check" className="p-button-success flex-1"
                                    onClick={() => { updateEntryStatus(selectedEntry.id, 'approved', adminNote); setShowDetailDialog(false); }} />
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default ReviewPage;
