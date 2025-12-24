import React, { useState } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { OverlayPanel } from 'primereact/overlaypanel';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { LeaderboardTemplateRow } from '@/types';
import { rankingService } from '@/app/service/rankingService';
import EditLeaderboardForm from './EditLeaderboardForm';

interface LeaderboardCardProps {
    ranking: LeaderboardTemplateRow;
    onRefresh: () => void;
}

const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ ranking, onRefresh }) => {
    const { showToast } = useToastContext();
    const [overlayVisible, setOverlayVisible] = useState(false);
    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const overlayRef = React.useRef<OverlayPanel>(null);

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '未设置';
        return new Date(dateString).toLocaleDateString('zh-CN');
    };

    const statusTemplate = (rowData: LeaderboardTemplateRow) => {
        const now = new Date();
        const startAt = rowData.start_at ? new Date(rowData.start_at) : null;
        const endAt = rowData.end_at ? new Date(rowData.end_at) : null;

        let status = '未开始';
        let severity: 'success' | 'warning' | 'info' | 'danger' = 'info';

        if (startAt && now >= startAt) {
            if (endAt && now > endAt) {
                status = '已结束';
                severity = 'danger';
            } else {
                status = '进行中';
                severity = 'success';
            }
        }

        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium 
        ${severity === 'success' ? 'bg-green-100 text-green-800' :
                    severity === 'danger' ? 'bg-red-100 text-red-800' :
                        'bg-blue-100 text-blue-800'}`}>
                {status}
            </span>
        );
    };

    const handleDelete = async () => {
        try {
            const result = await rankingService.deleteLeaderboard({ id: ranking.id });

            if (result?.success) {
                showToast({
                    severity: 'success',
                    summary: '成功',
                    detail: '排行榜删除成功'
                });
                onRefresh();
            } else {
                showToast({
                    severity: 'error',
                    summary: '失败',
                    detail: '排行榜删除失败'
                });
            }
        } catch (error) {
            console.error('删除排行榜失败:', error);
            showToast({
                severity: 'error',
                summary: '失败',
                detail: '排行榜删除失败'
            });
        }
    };

    const confirmDelete = () => {
        confirmDialog({
            message: '确定要删除这个排行榜吗？此操作不可撤销。',
            header: '确认删除',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '是',
            rejectLabel: '否',
            accept: handleDelete,
            reject: () => { }
        });
    };

    const toggleMenu = (event: React.MouseEvent) => {
        if (overlayRef.current) {
            overlayRef.current.toggle(event);
            setOverlayVisible(!overlayVisible);
        }
    };

    return (
        <Card className="border border-surface-200 shadow-none flex flex-col h-full">
            <div>
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-surface-800">{ranking.title}</h3>
                    {statusTemplate(ranking)}
                </div>

                <p className="text-surface-600 text-sm mb-3 line-clamp-2">
                    {ranking.description || '暂无描述'}
                </p>

                <div className="text-xs text-surface-500 mb-3">
                    <div>排名字段: <span className="font-medium">{ranking.rank_by_field}</span></div>
                    <div>类型: <span className="font-medium">{ranking.type || '未设置'}</span></div>
                    <div>开始时间: <span className="font-medium">{formatDate(ranking.start_at)}</span></div>
                    <div>结束时间: <span className="font-medium">{formatDate(ranking.end_at)}</span></div>
                </div>

                {ranking.remarks && (
                    <div className="text-xs text-surface-500 mb-3">
                        备注: {ranking.remarks}
                    </div>
                )}
            </div>

            <div className="mt-auto pt-4 flex justify-between">
                <div></div> {/* 用于对齐 */}
                <div className="flex flex-row gap-4">
                    <Button
                        label="编辑"
                        icon="pi pi-pencil"
                        className="p-2 text-left mb-1"
                        text
                        onClick={() => {
                            setEditDialogVisible(true);
                            if (overlayRef.current) {
                                overlayRef.current.hide();
                            }
                        }}
                    />
                    <Button
                        label="删除"
                        icon="pi pi-trash"
                        className="p-2 text-left"
                        severity="danger"
                        text
                        onClick={() => {
                            confirmDelete();
                            if (overlayRef.current) {
                                overlayRef.current.hide();
                            }
                        }}
                    />
                </div>
            </div>



            <EditLeaderboardForm
                leaderboardId={ranking?.id}
                visible={editDialogVisible}
                onHide={() => setEditDialogVisible(false)}
                onSuccess={() => {
                    setEditDialogVisible(false);
                    onRefresh();
                }}
            />
        </Card>
    );
};

export default LeaderboardCard;