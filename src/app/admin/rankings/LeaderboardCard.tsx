import React, { useState, useRef } from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { rankingService } from '@/app/service/rankingService';
import EditLeaderboardForm from './EditLeaderboardForm';
import { ListLeaderboardItem } from '@/app/api/ranking/list-leaderboard/entity';
import { formatBeijingDate } from '@/lib/beijingTime';

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
        return formatBeijingDate(dateString, 'zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' });
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
            <div className="group h-full flex flex-col bg-surface rounded-[24px] border border-surface-100 p-5 transition-all duration-300 hover:shadow-[0_12px_40px_rgb(0,0,0,0.06)] active:scale-[0.99] md:active:scale-100 relative overflow-hidden">
                {/* 状态背景微弱装饰 - 可选，增加呼吸感 */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/5 rounded-full -mr-12 -mt-12 blur-2xl pointer-events-none" />

                {/* Header: 标题与状态 */}
                <div className="flex justify-between items-start gap-4 mb-3">
                    <h3 className="text-base md:text-lg font-black text-surface-900 leading-tight tracking-tight line-clamp-1">
                        {ranking.title}
                    </h3>
                    <div className="shrink-0 scale-90 origin-right">
                        {renderStatus(ranking)}
                    </div>
                </div>

                {/* Description: 限制行数，保持整洁 */}
                <p className="text-xs md:text-sm text-surface-400 font-medium mb-5 line-clamp-2 min-h-[2.5rem] leading-relaxed">
                    {ranking.description || '暂无描述信息'}
                </p>

                {/* Meta Info: 属性磁贴化 */}
                <div className="grid grid-cols-2 gap-2 mb-5">
                    {[
                        { label: '排名字段', value: ranking.rank_by_field, icon: 'pi pi-sort-amount-down' },
                        { label: '活动类型', value: ranking.type || '未设置', icon: 'pi pi-tag' },
                        { label: '开始日期', value: formatDate(ranking.start_at), icon: 'pi pi-calendar' },
                        { label: '截止日期', value: formatDate(ranking.end_at), icon: 'pi pi-calendar-times' }
                    ].map((item, i) => (
                        <div key={i} className="flex flex-col gap-1 p-2.5 bg-surface-50/50 rounded-xl border border-surface-100/30">
                            <span className="text-[9px] font-black text-surface-300 uppercase tracking-widest flex items-center gap-1">
                                <i className={`${item.icon} text-[8px]`} /> {item.label}
                            </span>
                            <span className="text-xs font-bold text-surface-700 truncate">
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Remarks: 气泡化备注 */}
                {ranking.remarks && (
                    <div className="mb-6 p-2 px-3 bg-amber-50/50 border border-amber-100/50 rounded-lg">
                        <p className="text-[10px] text-amber-700 font-medium italic">
                            <span className="font-black not-italic mr-1">NOTE:</span> {ranking.remarks}
                        </p>
                    </div>
                )}

                {/* Footer: 按钮组布局优化 */}
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-50">
                    <div className="flex items-center gap-1">
                        <Button
                            icon="pi pi-trash"
                            severity="danger"
                            text
                            className="p-button-rounded w-8 h-8 opacity-20 hover:opacity-100 transition-opacity"
                            onClick={confirmDelete}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            label="编辑"
                            icon="pi pi-pencil"
                            text
                            size="small"
                            className="text-surface-500 font-bold hover:bg-surface-100 rounded-xl"
                            onClick={() => setEditDialogVisible(true)}
                        />
                        <Button
                            label="审核"
                            icon="pi pi-eye"
                            size="small"
                            badge={ranking.statusCount.toString()}
                            className="bg-primary-500 border-none rounded-xl font-black px-4 shadow-sm shadow-primary-200 active:scale-95 transition-all"
                            onClick={() => window.location.href = `/admin/rankings/review/${ranking.id}`}
                        />
                    </div>
                </div>
            </div>

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
