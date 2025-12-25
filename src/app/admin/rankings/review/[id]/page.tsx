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
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardEntriesRow } from '@/types';

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

    // 状态管理
    const [entries, setEntries] = useState<LeaderboardEntryWithProfile[]>([]);
    const [totalRecords, setTotalRecords] = useState(0);
    const [loading, setLoading] = useState(true);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);
    const [selectedEntry, setSelectedEntry] = useState<LeaderboardEntryWithProfile | null>(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);

    // 加载数据
    const loadData = async (page: number = 1, limit: number = 10) => {
        try {
            setLoading(true);

            // 获取待审核的条目，通过status参数过滤
            const response = await rankingService.listEntries({
                template_id: templateId,
                status: 'pending',  // 添加状态过滤参数
                page,
                limit,
            });

            if (response) {
                setEntries(response.entries);
                setTotalRecords(response.total);
            }
        } catch (error) {
            console.error('加载条目失败:', error);
            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: '获取待审核条目失败，请稍后重试'
            });
        } finally {
            setLoading(false);
        }
    };

    // 更新条目状态
    const updateEntryStatus = async (entryId: string, newStatus: string) => {
        try {
            const result = await rankingService.updateEntry({
                id: entryId,
                status: newStatus
            });

            if (result) {
                // 更新本地状态
                setEntries(prevEntries =>
                    prevEntries.map(entry =>
                        entry.id === entryId ? { ...entry, status: newStatus } : entry
                    )
                );

                showToast({
                    severity: 'success',
                    summary: '操作成功',
                    detail: `条目状态已更新为${newStatus === 'approved' ? '已通过' : '已拒绝'}`
                });
            } else {
                throw new Error('更新失败');
            }
        } catch (error) {
            console.error('更新条目状态失败:', error);
            showToast({
                severity: 'error',
                summary: '更新失败',
                detail: '更新条目状态失败，请稍后重试'
            });
        }
    };

    // 审核通过
    const approveEntry = (entry: LeaderboardEntryWithProfile) => {
        updateEntryStatus(entry.id, 'approved');
    };

    // 拒绝审核
    const rejectEntry = (entry: LeaderboardEntryWithProfile) => {
        updateEntryStatus(entry.id, 'rejected');
    };

    // 显示详情
    const showEntryDetail = (entry: LeaderboardEntryWithProfile) => {
        setSelectedEntry(entry);
        setShowDetailDialog(true);
    };

    // 分页处理
    const onPageChange = (event: { first: number; rows: number }) => {
        setFirst(event.first);
        setRows(event.rows);
        const page = Math.floor(event.first / event.rows) + 1;
        loadData(page, event.rows);
    };

    // 初始化加载
    useEffect(() => {
        if (templateId) {
            loadData();
        }
    }, [templateId]);

    // 状态徽章模板
    const statusBodyTemplate = (rowData: LeaderboardEntryWithProfile) => {
        let badgeSeverity: 'success' | 'warn' | 'danger' | 'info' | 'secondary' = 'secondary';
        let statusText = '未知';

        switch (rowData.status) {
            case 'pending':
                badgeSeverity = 'warn';
                statusText = '待审核';
                break;
            case 'approved':
                badgeSeverity = 'success';
                statusText = '已通过';
                break;
            case 'rejected':
                badgeSeverity = 'danger';
                statusText = '已拒绝';
                break;
            default:
                badgeSeverity = 'secondary';
                statusText = rowData.status || '未知';
        }

        return <Badge value={statusText} />;
    };

    // 用户信息模板
    const userInfoBodyTemplate = (rowData: LeaderboardEntryWithProfile) => {
        let { name, avatar } = rowData.userProfile;

        if (!name) {
            name = rowData.extra_data['douyin_nickname'] || '';
        }
        
        return (
            <div className="flex items-center gap-3">
                <Avatar 
                    image={avatar} 
                    className="bg-primary-200"
                    size="large" 
                    shape="circle" 
                    pt={{ label: { className: "text-sm" } }}
                >
                    {!avatar && (name?.charAt(0).toUpperCase() || '?')}
                </Avatar>
                <div>
                    <div className="font-medium">{name}</div>
                </div>
            </div>
        );
    };

    // 操作按钮模板
    const actionBodyTemplate = (rowData: LeaderboardEntryWithProfile) => {
        return (
            <div className="flex gap-2">
                <Button
                    label="查看详情"
                    icon="pi pi-eye"
                    className="p-button-sm p-button-outlined"
                    onClick={() => showEntryDetail(rowData)}
                />
                <Button
                    label="通过"
                    icon="pi pi-check"
                    className="p-button-sm p-button-success"
                    onClick={() => approveEntry(rowData)}
                />
                <Button
                    label="拒绝"
                    icon="pi pi-times"
                    className="p-button-sm p-button-danger"
                    onClick={() => rejectEntry(rowData)}
                />
            </div>
        );
    };

    // 表单数据模板
    const formDataBodyTemplate = (rowData: LeaderboardEntryWithProfile) => {
        try {
            // 假设 form_data 是一个数组，包含用户输入的字段
            const formData = Array.isArray(rowData.form_data) ? rowData.form_data : [];
            if (formData.length === 0) return <span>无数据</span>;

            // 取前三个字段显示，更多用省略号表示
            const displayFields = formData.slice(0, 3).map((field: any, idx: number) => {
                const value = field.userInput || field.default || '无';
                return `${field.name || field.label || `字段${idx + 1}`}: ${value}`;
            }).join(', ');

            const moreCount = formData.length > 3 ? `...等${formData.length}项` : '';

            return (
                <span>
                    {displayFields}
                    {moreCount}
                </span>
            );
        } catch (error) {
            return <span>数据格式错误</span>;
        }
    };

    if (loading && entries.length === 0) {
        return (
            <div className="flex justify-center items-center h-64">
                <ProgressSpinner />
            </div>
        );
    }

    return (
        <div className="card p-6">
            <h2 className="text-2xl font-bold mb-6">审核排行榜提交 - ID: {templateId}</h2>

            <DataTable
                value={entries}
                paginator
                first={first}
                rows={rows}
                totalRecords={totalRecords}
                onPage={onPageChange}
                loading={loading}
                tableStyle={{ minWidth: '50rem' }}
                emptyMessage="暂无待审核条目"
            >
                <Column header="用户信息" body={userInfoBodyTemplate} />
                <Column field="score" header="分数" />
                <Column field="status" header="状态" body={statusBodyTemplate} />
                <Column field="created_at" header="提交时间" body={(rowData) => new Date(rowData.created_at || '').toLocaleString()} />
                <Column header="操作" body={actionBodyTemplate} />
            </DataTable>

            {/* 详情对话框 */}
            <Dialog
                header="提交详情"
                visible={showDetailDialog}
                onHide={() => setShowDetailDialog(false)}
                style={{ width: '90%', maxWidth: '800px' }}
                breakpoints={{ '960px': '75vw', '641px': '100vw' }}
            >
                {selectedEntry && (
                    <div className="p-4">
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold">基本信息</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <p><strong>用户ID:</strong> {selectedEntry.user_id}</p>
                                    <p><strong>模板ID:</strong> {selectedEntry.template_id}</p>
                                    <p><strong>分数:</strong> {selectedEntry.score}</p>
                                </div>
                                <div>
                                    <p><strong>状态:</strong> {statusBodyTemplate(selectedEntry)}</p>
                                    <p><strong>提交时间:</strong> {new Date(selectedEntry.created_at || '').toLocaleString()}</p>
                                    <p><strong>证据链接:</strong> {selectedEntry.evidence_url || '无'}</p>
                                </div>
                            </div>
                            
                            {/* 用户信息区域 */}
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                <h4 className="font-semibold mb-2">用户信息</h4>
                                <div className="flex items-center gap-3">
                                    <Avatar 
                                        image={selectedEntry.userProfile.avatar} 
                                        className="bg-gray-200"
                                        size="large" 
                                        shape="circle" 
                                        pt={{ label: { className: "text-sm" } }}
                                    >
                                        {!selectedEntry.userProfile.avatar && (
                                            selectedEntry.userProfile.name?.charAt(0).toUpperCase() || '?'
                                        )}
                                    </Avatar>
                                    <div>
                                        <div className="font-medium">
                                            {selectedEntry.userProfile.name}
                                        </div>
                                        <div className="text-sm text-gray-500">ID: {selectedEntry.user_id}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-lg font-semibold">提交内容</h3>
                            <div className="mt-2">
                                {Array.isArray(selectedEntry.form_data) && selectedEntry.form_data.length > 0 ? (
                                    <div className="grid grid-cols-1 gap-3">
                                        {selectedEntry.form_data.map((field: any, index: number) => (
                                            <div key={index} className="p-3 bg-gray-50 rounded border">
                                                <p><strong>字段名:</strong> {field.name || field.label || `字段${index + 1}`}</p>
                                                <p><strong>类型:</strong> {field.type}</p>
                                                <p><strong>值:</strong> {field.userInput || field.default || '未填写'}</p>
                                                {field.options && (
                                                    <p><strong>选项:</strong> {Array.isArray(field.options) ? field.options.join(', ') : JSON.stringify(field.options)}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p>无提交内容</p>
                                )}
                            </div>
                        </div>

                        <div className="mb-4">
                            <h3 className="text-lg font-semibold">附加信息</h3>
                            <div className="mt-2">
                                {selectedEntry.extra_data ? (
                                    <pre className="p-3 bg-gray-50 rounded overflow-auto">
                                        {JSON.stringify(selectedEntry.extra_data, null, 2)}
                                    </pre>
                                ) : (
                                    <p>无附加信息</p>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <Button
                                label="通过"
                                icon="pi pi-check"
                                className="p-button-success"
                                onClick={() => {
                                    approveEntry(selectedEntry);
                                    setShowDetailDialog(false);
                                }}
                            />
                            <Button
                                label="拒绝"
                                icon="pi pi-times"
                                className="p-button-danger"
                                onClick={() => {
                                    rejectEntry(selectedEntry);
                                    setShowDetailDialog(false);
                                }}
                            />
                            <Button
                                label="关闭"
                                icon="pi pi-times"
                                className="p-button-secondary"
                                onClick={() => setShowDetailDialog(false)}
                            />
                        </div>
                    </div>
                )}
            </Dialog>
        </div>
    );
};

export default ReviewPage;