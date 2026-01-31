'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { Dialog } from 'primereact/dialog'; // 引入 Dialog
import { User, FileText, Calendar, Users, Clock, ChevronRight } from 'lucide-react';
import { PersonalInfoDisplay } from '@/components/student/profile/PersonalInfoDisplay';
import { SportCardsDisplay } from '@/components/student/profile/SportCardsDisplay';
import { CoachViewProgressTimeline } from '@/components/student/profile/CoachViewProgressTimeline';
import { CoachSubscriptionRow } from '@/types';
import { GetStudentResponseDto } from '@/app/api/coach/get-student/entity';
import { RadioButton } from 'primereact/radiobutton';
import { actionLibService } from '@/app/service/actionLibService';
import { CoachActionRow } from '@/types';
import { useSession } from 'next-auth/react';
import { PersonalInfo } from './PersonalInfo';
import { SportCard } from './SportsCard';
import { StudentSubscribeDataView } from './StudentSubscribeDataView';

interface StudentProfilePanelProps {
    studentData: GetStudentResponseDto['student'] | null;
    subscription: CoachSubscriptionRow | null;
    loading: boolean;
    onEditQuestionnaire?: () => void;
}

export const StudentProfilePanel: React.FC<StudentProfilePanelProps> = ({
    studentData,
    loading,
    onEditQuestionnaire
}) => {
    const [visible, setVisible] = useState(false); // 控制 Dialog 显示
    const [autoComputeActions, setAutoComputeActions] = useState<CoachActionRow[]>([]);
    const [loadingActions, setLoadingActions] = useState<boolean>(true);
    const { data: session } = useSession();

    useEffect(() => {
        if (!session?.user?.id || !visible) return; // 只有当对话框打开时才尝试加载动作库（可选优化）

        const fetchAutoComputeActions = async () => {
            setLoadingActions(true);
            try {
                const res = await actionLibService.listAutoComputeActions({
                    coachId: session.user.id
                });
                if (res && res.actions) {
                    setAutoComputeActions(res.actions);
                }
            } catch (error) {
                console.error("获取自动计算动作失败:", error);
            } finally {
                setLoadingActions(false);
            }
        };

        fetchAutoComputeActions();
    }, [session?.user?.id, visible]);

    const formatDate = (dateString: string) => {
        if (!dateString) return '未设置';
        return new Date(dateString).toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const calculateStartedDays = (startDate?: string | null) => {
        if (!startDate) return null;
        const start = new Date(startDate);
        const now = new Date();
        const diffTime = now.getTime() - start.getTime();
        const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
        return { days: diffDays };
    };

    const profile = studentData?.profile;
    const duration = studentData ? calculateStartedDays(studentData.start_date) : null;

    return (
        <>
            {/* 学员档案入口 - 严格对齐 Aero 风格 */}
            <div
                className="group relative bg-surface rounded-[24px] p-5 cursor-pointer transition-all duration-500 ease-out border border-surface-200/70 hover:bg-surface hover:border-primary-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] active:scale-[0.98] mb-6"
                onClick={() => setVisible(true)}
            >
                {/* 背景光晕装饰：对齐计划卡片的渐变逻辑 */}
                <div className="absolute inset-0 bg-gradient-to-r from-primary-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 rounded-[24px] transition-opacity duration-500" />

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        {/* 头像容器：间距与图标容器对齐 */}
                        <div className="relative">
                            <Avatar
                                image={profile?.avatar_url}
                                label={!profile?.avatar_url ? (profile?.nickname?.charAt(0) || 'U') : undefined}
                                size="large"
                                shape="circle"
                                className="bg-primary-600 text-surface font-black shadow-lg shadow-primary-500/10 transition-all duration-500 group-hover:scale-105"
                            />
                            {/* 动态光环：对齐物理反馈感 */}
                            <div className="absolute inset-0 rounded-full ring-2 ring-primary-500/0 group-hover:ring-primary-500/20 group-hover:scale-125 transition-all duration-700 ease-out" />
                        </div>

                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="font-black text-surface-900 tracking-tighter group-hover:text-primary-700 transition-colors truncate">
                                    {profile?.nickname || '学员档案'}
                                </h3>
                                {/* 状态标注：保持与“已完成”标签一致的视觉逻辑 */}
                                <span className="flex items-center gap-1 px-2 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-black uppercase tracking-tight rounded-full border border-primary-100/30 transition-colors group-hover:bg-primary-100/50">
                                    正式学员
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-xs font-medium text-surface-500 opacity-80 flex items-center gap-1 min-w-0">
                                    <Users size={12} strokeWidth={2} />
                                    <span className="truncate">查看详细资料与体能档案</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 右侧交互提示：完全对齐计划卡片的间距与动效 */}
                    <div className="flex items-center gap-1">
                        <span className="text-[11px] font-black text-primary-600 opacity-0 translate-x-4 transition-all duration-500 ease-out group-hover:opacity-100 group-hover:translate-x-0">
                            查看详情
                        </span>
                        <div className="w-8 h-8 flex items-center justify-center rounded-full text-primary-600 transition-all duration-500 group-hover:bg-primary-500 group-hover:text-surface group-hover:rotate-[-45deg]">
                            <ChevronRight size={18} strokeWidth={3} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 弹出对话框 */}
            <Dialog
                header={<span className="tracking-tight font-bold text-surface-900 text-lg">学员详细档案</span>}
                visible={visible}
                style={{ width: '95vw', maxWidth: '600px' }}
                onHide={() => setVisible(false)}
                className="aero-dialog"
                pt={{
                    root: { className: 'rounded-[24px] border-none shadow-2xl bg-surface overflow-hidden' },
                    header: { className: 'p-6 pb-0 border-none' },
                    content: { className: 'p-6 pt-4' }
                }}
                blockScroll={true}
            >
                {loading ? (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                            <Skeleton height="80px" className="rounded-[20px] bg-surface-50/50" />
                            <Skeleton height="80px" className="rounded-[20px] bg-surface-50/50" />
                        </div>
                        <Skeleton height="240px" className="rounded-[20px] bg-surface-50/50" />
                    </div>
                ) : studentData ? (
                    <div className="space-y-8 pt-2">
                        {/* 1. 订阅概览 - 数值中心化设计 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-5 bg-surface-50/50 rounded-[20px] border border-surface-100/50 transition-all hover:bg-surface-50">
                                <div className="flex items-center gap-1.5 text-surface-400 font-bold text-[10px] tracking-widest uppercase mb-2">
                                    <Calendar size={12} strokeWidth={2.5} />
                                    订阅开始
                                </div>
                                <div className="text-xl font-black text-surface-900 tracking-tight">
                                    {formatDate(studentData.start_date)}
                                </div>
                            </div>
                            <div className="p-5 bg-surface-50/50 rounded-[20px] border border-surface-100/50 transition-all hover:bg-surface-50">
                                <div className="flex items-center gap-1.5 text-surface-400 font-bold text-[10px] tracking-widest uppercase mb-2">
                                    <Clock size={12} strokeWidth={2.5} />
                                    已开始
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-primary-600 tracking-tight">{duration?.days ?? 0}</span>
                                    <span className="text-xs font-bold text-primary-400">Days</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. 本期需求 - 模块化问卷布局 (已除噪) */}
                        {studentData?.subscribe_data && studentData.subscribe_data.length > 0 && (
                            <StudentSubscribeDataView
                                data={studentData.subscribe_data}
                                loading={loading}
                                autoComputeActions={autoComputeActions}
                                onEdit={onEditQuestionnaire}
                            />
                        )}

                        {/* 3. 公共档案 - 分割线轻量化 */}
                        <div className="space-y-8 pt-4 border-t border-surface-100/60">
                            <PersonalInfo profile={profile || null} phone={profile?.phone} />
                            <SportCard sportCards={profile?.sport_cards as any} />

                            {studentData.student_id && (
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold tracking-tight text-surface-900 px-1">进步足迹</h4>
                                    <div className="px-1">
                                        <CoachViewProgressTimeline studentId={studentData.student_id} limit={5} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 opacity-40">
                        <User className="w-16 h-16 text-surface-300 mb-3 stroke-[1.5]" />
                        <p className="text-sm font-medium tracking-tight">无法加载学员信息</p>
                    </div>
                )}
            </Dialog>
        </>
    );
};