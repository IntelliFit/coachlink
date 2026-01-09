'use client';

import React, { useState, useEffect } from 'react';
import { Avatar } from 'primereact/avatar';
import { Tag } from 'primereact/tag';
import { useSession } from 'next-auth/react';
import { CoachesRow } from '@/types';
import { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';
import { Button } from 'primereact/button';
import EditCoachProfileDialog from './EditCoachProfileDialog';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import ChatDialog from '@/components/chat/ChatDialog';
import { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import QuestionnaireForm from './QuestionnaireForm';
import { coachService } from '@/app/service/coachService';
import type { TrainingItem } from '@/types/questionnaires';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useSearchParams } from 'next/navigation';
import { MessageCircle, Edit3, ClipboardList, Star, Users, BookOpen, Award } from 'lucide-react';

interface CoachIntroductionProps {
    coach: CoachesRow;
    userSubscription: QueryCoachSubscription | null;
    aggregatedInfo: GetAggregatedInfoResponseDto | null;
}

const CoachIntroduction: React.FC<CoachIntroductionProps> = ({ coach, userSubscription, aggregatedInfo }) => {
    const { data: session } = useSession();
    const isOwnProfile = session?.user?.id === coach.user_id;
    const searchParams = useSearchParams();

    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [chatroom, setChatroom] = useState<ChatroomDetail>(null);

    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);

    const { showToast } = useToastContext();

    // 检查URL参数，如果 action=questionnaire 则自动打开问卷
    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'questionnaire' && userSubscription) {
            // 延迟打开，确保组件完全渲染
            setTimeout(() => {
                openQuestionnaire();
            }, 500);
        }
    }, [searchParams, userSubscription]);

    const specialtiesToShow = (aggregatedInfo?.specialties?.length
        ? aggregatedInfo.specialties
        : (coach.specialties || []));

    const aboutProfile = (coach.profile || {}) as Record<string, any>;
    const caseStudyCount = Array.isArray(aboutProfile.caseStudies) ? aboutProfile.caseStudies.length : 0;

    const contactCoach = async () => {
        if (!session?.user?.id) {
            return;
        }

        if (session.user.id === coach.user_id) {
            return;
        }

        setLoading(true);

        try {
            const res = await chatService.getChatroom({ members: [session.user.id, coach.user_id] });

            if (res) {
                setChatroom(null);
                setTimeout(() => {
                    setChatroom(res.chatroom);
                    setChatDialogVisible(true);
                }, 0);
            } else {
                showToast({ severity: 'error', summary: '创建聊天室出错' });
            }
        } finally {
            setLoading(false);
        }
    }

    const openQuestionnaire = async () => {
        setQuestionnaireLoading(true);
        try {
            // 获取问卷问题
            const qRes = await coachService.getQuestionnaires({
                coachId: coach.id
            });

            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                showToast({ severity: 'info', summary: '该教练暂无问卷' });
            }
        } catch (error) {
            console.error('获取问卷失败:', error);
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    const handleQuestionnaireSubmit = async (answers: TrainingItem[]) => {
        const res = await subscriptionService.updateSubscription({
            id: userSubscription.id,
            subscribe_data: answers as any
        });

        if (res?.subscription) {
            showToast({ severity: 'success', summary: '问卷更新成功' });
            setQuestionnaireVisible(false);
        } else {
            showToast({ severity: 'error', summary: '问卷更新失败' });
        }
    }

    return (
        <div className="bg-surface pb-12">
            {/* 背景装饰：淡淡的径向渐变，增加层次感 */}
            <div className="absolute inset-0 h-64 bg-gradient-to-b from-primary-100/50 to-transparent dark:from-primary-800/50 pointer-events-none" />

            <div className="max-w-7xl mx-auto px-6 sm:px-8 relative">
                <div className="flex flex-col md:flex-row gap-10 items-start pt-10">

                    {/* 左侧：精简头像与状态 */}
                    <div className="flex-shrink-0 relative group">
                        <div className="w-32 h-32 md:w-40 md:h-40 rounded-[32px] overflow-hidden shadow-2xl shadow-primary-100 dark:shadow-primary-800 ring-4 ring-surface transition-transform duration-500 group-hover:scale-[1.02]">
                            {coach.avatar_url ? (
                                <img src={coach.avatar_url} alt={coach.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-gradient-to-br from-surface-200 to-surface-100 flex items-center justify-center text-3xl font-black text-surface-400">
                                    {coach.name?.substring(0, 1)}
                                </div>
                            )}
                        </div>
                        {coach.is_featured && (
                            <div className="absolute -bottom-2 -right-2 bg-yellow-400 text-surface rounded-2xl p-2 shadow-xl border-2 border-surface">
                                <Award size={20} strokeWidth={2.5} />
                            </div>
                        )}
                    </div>

                    {/* 右侧：数值中心化的核心内容 */}
                    <div className="flex-1 w-full">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                            <div>
                                <div className="flex flex-wrap items-center gap-3 mb-2">
                                    <h1 className="text-3xl font-black text-surface-900 tracking-tighter">{coach.name}</h1>
                                    {coach.title && (
                                        <span className="px-3 py-1 bg-surface-100 text-surface-600 text-[11px] font-black uppercase tracking-widest rounded-lg">
                                            {coach.title}
                                        </span>
                                    )}
                                </div>

                                {/* 订阅状态：低调的 Aero 标签 */}
                                <div className="flex gap-2">
                                    {userSubscription?.status === 'active' && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100">
                                            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                            服务进行中
                                        </span>
                                    )}
                                    {userSubscription?.status === 'waiting' && (
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-surface-500 bg-surface-50 px-2.5 py-1 rounded-full border border-surface-100">
                                            等待确认
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* 动作按钮：扁平化、强质感 */}
                            <div className="flex flex-wrap gap-3">
                                {['waiting', 'active'].includes(userSubscription?.status) && (
                                    <button
                                        onClick={openQuestionnaire}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-surface border border-surface-200 rounded-[14px] text-xs font-black text-surface-700 hover:border-primary-300 hover:text-primary-600 transition-all active:scale-95 shadow-sm"
                                    >
                                        <ClipboardList size={16} />
                                        查看问卷
                                    </button>
                                )}
                                <button
                                    onClick={contactCoach}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-surface rounded-[16px] text-xs font-black shadow-lg shadow-primary-200 dark:shadow-primary-700 hover:bg-primary-700 transition-all active:scale-95"
                                >
                                    <MessageCircle size={16} />
                                    联系教练
                                </button>
                                {isOwnProfile && (
                                    <button
                                        onClick={() => setEditDialogVisible(true)}
                                        className="p-2.5 bg-surface-50 text-surface-400 rounded-[14px] hover:bg-surface-100 hover:text-surface-900 transition-all"
                                    >
                                        <Edit3 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 核心统计：数值中心化布局 */}
                        <div className="grid grid-cols-3 gap-4 mb-10">
                            {[
                                { label: '教学内容', value: aggregatedInfo?.contentCount || 0, icon: <BookOpen size={16} /> },
                                { label: '活跃学员', value: aggregatedInfo?.studentCount || 0, icon: <Users size={16} /> },
                                { label: '综合评分', value: aggregatedInfo?.averageRating?.toFixed(1) || '0.0', icon: <Star size={16} /> },
                            ].map((stat, i) => (
                                <div key={i} className="bg-surface-50/50 border border-surface-100 p-4 rounded-[24px] flex flex-col gap-1 hover:bg-surface hover:shadow-md transition-all">
                                    <div className="text-surface-400">{stat.icon}</div>
                                    <div className="text-xl font-black text-surface-900 tracking-tighter">{stat.value}</div>
                                    <div className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">{stat.label}</div>
                                </div>
                            ))}
                        </div>
                        <div className="flex flex-col gap-10">
                            {/* 上部分：擅长领域 */}
                            <div className="flex flex-col">
                                <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-4">
                                    擅长领域
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {specialtiesToShow.map((specialty, index) => (
                                        <span
                                            key={index}
                                            className="px-3 py-1.5 bg-surface border border-surface-100 rounded-xl text-[12px] font-bold text-surface-700 shadow-sm"
                                        >
                                            {specialty}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {/* 下部分：简介与核心指标 */}
                            <div className="flex flex-col gap-8">
                                <div>
                                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-4">
                                        教练简介
                                    </h3>
                                    <p className="text-surface-600 text-sm leading-relaxed whitespace-pre-line max-w-2xl px-1">
                                        {coach.bio || '这位教练很神秘，还没有填写简介。'}
                                    </p>
                                </div>

                                {/* 经验值容器：保持与上方简介的左对齐，并统一圆角风格 */}
                                <div className="grid grid-cols-2 gap-6 p-6 bg-surface-50/30 rounded-[24px] border border-dashed border-surface-200">
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-[10px] font-black text-surface-400 uppercase tracking-wider">
                                            从业经验
                                        </h3>
                                        <p className="text-sm font-bold text-surface-900">
                                            {coach.years_experience || 0} 年专业沉淀
                                        </p>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <h3 className="text-[10px] font-black text-surface-400 uppercase tracking-wider">
                                            成功案例
                                        </h3>
                                        <p className="text-sm font-bold text-surface-900">
                                            {caseStudyCount} 个学员蜕变
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Dialog 组件保持不变 */}
        </div>
    );
};

export default CoachIntroduction;