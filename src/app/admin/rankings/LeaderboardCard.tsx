import React, { useState, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import EditLeaderboardForm from './EditLeaderboardForm';
import { ListLeaderboardItem } from '@/app/api/ranking/list-leaderboard/entity';

interface LeaderboardCardProps {
    ranking: ListLeaderboardItem;
    onRefresh: () => void;
}

const LeaderboardCard: React.FC<LeaderboardCardProps> = ({ ranking, onRefresh }) => {
    const { showToast } = useToastContext();
    const [editDialogVisible, setEditDialogVisible] = useState(false);

    /* ================= Utils ================= */

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '未设置';
        return new Date(dateString).toLocaleDateString('zh-CN');
    };

    const renderStatus = (row: ListLeaderboardItem) => {
        const now = new Date();
        const startAt = row.start_at ? new Date(row.start_at) : null;
        const endAt = row.end_at ? new Date(row.end_at) : null;

        let text = '未开始';
        let cls = 'bg-blue-100 text-blue-700';

        if (startAt && now >= startAt) {
            if (endAt && now > endAt) {
                text = '已结束';
                cls = 'bg-red-100 text-red-700';
            } else {
                text = '进行中';
                cls = 'bg-green-100 text-green-700';
            }
        }

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${cls}`}>
                {text}
            </span>
        );
    };

    /* ================= Actions ================= */

    const handleDelete = async () => {
        try {
            const res = await rankingService.deleteLeaderboard({ id: ranking.id });
            if (res?.success) {
                showToast({ severity: 'success', summary: '成功', detail: '排行榜已删除' });
                onRefresh();
            } else {
                throw new Error();
            }
        } catch {
            showToast({ severity: 'error', summary: '失败', detail: '删除失败' });
        }
    };

    const confirmDelete = () => {
        confirmDialog({
            header: '确认删除',
            message: '确定要删除这个排行榜吗？此操作不可撤销。',
            icon: 'pi pi-exclamation-triangle',
            acceptLabel: '删除',
            rejectLabel: '取消',
            acceptClassName: 'p-button-danger',
            accept: handleDelete
        });
    };

    /* ================= Render ================= */

    return (
        <>
            <Card className="h-full flex flex-col border border-surface-200 rounded-xl shadow-sm hover:shadow-md transition-shadow p-0">
                {/* Header */}
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-surface-800 leading-tight">
                        {ranking.title}
                    </h3>
                    {renderStatus(ranking)}
                </div>

                {/* Description */}
                <p className="text-sm text-surface-600 mb-4 line-clamp-2">
                    {ranking.description || '暂无描述'}
                </p>

                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-y-2 text-xs text-surface-500 mb-4">
                    <div className="flex items-center gap-2">
                        <i className="pi pi-sort-amount-down text-surface-400" />
                        <span>排名字段：</span>
                        <span className="font-medium text-surface-700">
                            {ranking.rank_by_field}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <i className="pi pi-tag text-surface-400" />
                        <span>类型：</span>
                        <span className="font-medium text-surface-700">
                            {ranking.type || '未设置'}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <i className="pi pi-calendar text-surface-400" />
                        <span>开始：</span>
                        <span className="font-medium text-surface-700">
                            {formatDate(ranking.start_at)}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <i className="pi pi-calendar-times text-surface-400" />
                        <span>结束：</span>
                        <span className="font-medium text-surface-700">
                            {formatDate(ranking.end_at)}
                        </span>
                    </div>
                </div>

                {/* Remarks */}
                {ranking.remarks && (
                    <div className="text-xs text-surface-500 mb-4 italic">
                        备注：{ranking.remarks}
                    </div>
                )}

                {/* Footer */}
                <div className="mt-auto pt-3 flex justify-end gap-2 border-t border-surface-100">
                    <Button
                        icon="pi pi-pencil"
                        label="编辑"
                        text
                        size="small"
                        onClick={() => setEditDialogVisible(true)}
                    />
                    <Button
                        icon="pi pi-trash"
                        label="删除"
                        severity="danger"
                        text
                        size="small"
                        onClick={confirmDelete}
                    />
                </div>
            </Card>

            {/* Edit Dialog */}
            <EditLeaderboardForm
                leaderboardId={ranking.id}
                visible={editDialogVisible}
                onHide={() => setEditDialogVisible(false)}
                onSuccess={() => {
                    setEditDialogVisible(false);
                    onRefresh();
                }}
            />
        </>
    );
};

export default LeaderboardCard;
