import React from 'react';
import { ClipboardCheck, Edit3, Eye, RotateCcw, Repeat, ArrowRight } from 'lucide-react';
import { Button } from 'primereact/button';
import { useRouter } from 'next/navigation';
import { ProfileData } from './types';
import { useSession } from 'next-auth/react';

interface CoachApplicationCardProps {
    status: ProfileData['coachApplicationStatus'];
    rejectionReason?: string;
}

export const CoachApplicationCard: React.FC<CoachApplicationCardProps> = ({ status, rejectionReason }) => {
    const router = useRouter();
    const { update: updateSession } = useSession();

    const getStatusConfig = () => {
        switch (status) {
            case 'coach':
                return {
                    badge: '已获得教练权限',
                    badgeColor: 'bg-green-100 text-green-700',
                    hint: '恭喜！您已获得教练权限，点击按钮即可进入教练端。',
                    actionLabel: '进入教练端',
                    actionIcon: <Repeat size={16} />,
                    action: async () => {
                        try {
                            const res = await fetch('/api/user/switch-role', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ role: 'coach' })
                            });
                            if (res.ok) {
                                try {
                                    await updateSession();
                                } catch (e) {
                                    console.warn('刷新 session 失败:', e);
                                }
                                window.location.href = '/dashboard';
                            }
                        } catch (e) {
                            console.error('切换角色失败', e);
                        }
                    },
                    btnSeverity: 'success' as const
                };
            case 'approved':
                return {
                    badge: '已通过',
                    badgeColor: 'bg-green-100 text-green-700',
                    hint: '系统正在为您开通教练端功能，请点击进入完成初始化。',
                    actionLabel: '进入教练端',
                    actionIcon: <Repeat size={16} />,
                    action: async () => {
                        try {
                            const res = await fetch('/api/user/switch-role', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ role: 'coach' })
                            });
                            if (res.ok) {
                                try {
                                    await updateSession();
                                } catch (e) {
                                    console.warn('刷新 session 失败:', e);
                                }
                                window.location.href = '/dashboard';
                            }
                        } catch (e) {
                            console.error('切换角色失败', e);
                        }
                    },
                    btnSeverity: 'success' as const
                };
            case 'pending':
                return {
                    badge: '审核中',
                    badgeColor: 'bg-yellow-100 text-yellow-700',
                    hint: '教练团队正在审核您的资料，通常会在2个工作日内给出结果。',
                    actionLabel: '查看申请详情',
                    actionIcon: <Eye size={16} />,
                    action: () => router.push('/apply/status'),
                    btnSeverity: 'warning' as const
                };
            case 'rejected':
                return {
                    badge: '已驳回',
                    badgeColor: 'bg-red-100 text-red-700',
                    hint: rejectionReason ? `驳回原因：${rejectionReason}。请修改后重新提交。` : '申请未通过，请根据提示修改后再次提交。',
                    actionLabel: '重新提交申请',
                    actionIcon: <RotateCcw size={16} />,
                    action: () => router.push('/apply/edit'),
                    btnSeverity: 'danger' as const
                };
            case 'draft':
                return {
                    badge: '草稿未提交',
                    badgeColor: 'bg-surface-100 text-surface-700',
                    hint: '您已保存申请草稿，点击继续完善并提交审核。',
                    actionLabel: '继续编辑申请',
                    actionIcon: <Edit3 size={16} />,
                    action: () => router.push('/apply/edit'),
                    btnSeverity: 'secondary' as const
                };
            default:
                return {
                    badge: '未申请',
                    badgeColor: 'bg-surface-100 text-surface-600',
                    hint: '完成认证后即可在同一账号内自由切换学员/教练身份。',
                    actionLabel: '申请成为教练',
                    actionIcon: <ClipboardCheck size={16} />,
                    action: () => router.push('/apply'),
                    btnSeverity: 'common' as const
                };
        }
    };

    const config = getStatusConfig();

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-2">
                        <ClipboardCheck className="text-primary" size={20} />
                        教练申请进度
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-surface-600">
                        当前状态：
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.badgeColor}`}>
                            {config.badge}
                        </span>
                    </div>
                </div>
                <Button 
                    label={config.actionLabel}
                    icon={config.actionIcon}
                    onClick={config.action}
                    className="w-full sm:w-auto"
                    size="small"
                    outlined
                />
            </div>
            <p className="text-sm text-surface-500 mt-4 bg-surface-50 p-3 rounded-lg border border-surface-100">
                {config.hint}
            </p>
        </div>
    );
};
