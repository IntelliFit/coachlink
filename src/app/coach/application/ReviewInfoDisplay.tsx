import React from 'react';
import { ReviewInfo } from './page';

interface ReviewInfoDisplayProps {
    reviewInfo: ReviewInfo;
}

const ReviewInfoDisplay: React.FC<ReviewInfoDisplayProps> = ({ reviewInfo }) => {
    const { reviewed_by, reviewed_at, review_notes, status } = reviewInfo;

    // 如果没有任何审核信息，则不渲染组件
    if (!reviewed_by && !reviewed_at && !review_notes && !status) {
        return null;
    }

    // 状态映射
    const statusLabels: Record<string, string> = {
        pending: '待审核',
        approved: '已通过',
        rejected: '已拒绝',
        reviewing: '审核中'
    };

    const statusLabel = statusLabels[status as keyof typeof statusLabels] || status;

    // 根据状态设置不同的样式
    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-800';
            case 'rejected':
                return 'bg-red-100 text-red-800';
            case 'reviewing':
                return 'bg-yellow-100 text-yellow-800';
            case 'pending':
            default:
                return 'bg-blue-100 text-blue-800';
        }
    };

    return (
        <div className="md:col-span-2 mt-6 pt-6 border-t border-surface-200">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-surface-800">审核信息</h2>
                {status && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(status)}`}>
                        {statusLabel}
                    </span>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {reviewed_by && (
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">审核人</label>
                        <div className="text-surface-900">{reviewed_by}</div>
                    </div>
                )}

                {reviewed_at && (
                    <div>
                        <label className="block text-sm font-medium text-surface-700 mb-1">审核时间</label>
                        <div className="text-surface-900">{new Date(reviewed_at).toLocaleString('zh-CN')}</div>
                    </div>
                )}

                {review_notes && (
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-surface-700 mb-1">审核意见</label>
                        <div className="text-surface-900 p-3 bg-surface-50 rounded-md border border-surface-200">
                            {review_notes}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReviewInfoDisplay;