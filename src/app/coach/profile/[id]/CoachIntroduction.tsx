'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import {
    Award,
    BookOpen,
    ClipboardList,
    Edit3,
    MessageCircle,
    Star,
    Users,
    Zap,
} from 'lucide-react';
import type { CoachesRow } from '@/types';
import type { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';
import type { GetAggregatedInfoResponseDto } from '@/app/api/coach/get-aggregated-info/entity';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import type { TrainingItem } from '@/types/questionnaires';
import { chatService } from '@/app/service/chatService';
import { coachService } from '@/app/service/coachService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { useToastContext } from '@/context/ToastContext';
import ChatDialog from '@/components/chat/ChatDialog';
import EditCoachProfileDialog from './EditCoachProfileDialog';
import QuestionnaireForm from './QuestionnaireForm';
import {
    getCoachTrackLabel,
    getServiceModeLabel,
    getTargetStudentLevelLabel,
} from '@/lib/coachApplicationOptions';

interface CoachIntroductionProps {
    coach: CoachesRow;
    userSubscription: QueryCoachSubscription | null;
    aggregatedInfo: GetAggregatedInfoResponseDto | null;
    onGoToSubscribe?: () => void;
}

const CoachIntroduction: React.FC<CoachIntroductionProps> = ({
    coach,
    userSubscription,
    aggregatedInfo,
    onGoToSubscribe,
}) => {
    const { data: session } = useSession();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();

    const isOwnProfile = session?.user?.id === coach.user_id;

    const [editDialogVisible, setEditDialogVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [chatroom, setChatroom] = useState<ChatroomDetail>(null);
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);

    const profile = (coach.profile || {}) as Record<string, any>;
    const specialtiesToShow = aggregatedInfo?.specialties?.length
        ? aggregatedInfo.specialties
        : (coach.specialties || []);
    const coachTrack = (coach as any).coach_track;
    const serviceModes = Array.isArray((coach as any).service_modes) ? (coach as any).service_modes : [];
    const targetStudentLevels = Array.isArray((coach as any).target_student_levels)
        ? (coach as any).target_student_levels
        : [];
    const supportFocus = (coach as any).support_focus || profile.supportFocus;
    const caseStudyCount = Array.isArray(profile.caseStudies) ? profile.caseStudies.length : 0;

    useEffect(() => {
        const action = searchParams.get('action');
        if (action === 'questionnaire' && userSubscription) {
            setTimeout(() => {
                void openQuestionnaire();
            }, 500);
        }
    }, [searchParams, userSubscription]);

    const statusChip = useMemo(() => {
        if (userSubscription?.status === 'active') {
            return {
                label: '服务进行中',
                className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
            };
        }

        if (userSubscription?.status === 'waiting') {
            return {
                label: '等待确认',
                className: 'border-amber-200 bg-amber-50 text-amber-700',
            };
        }

        return null;
    }, [userSubscription?.status]);

    const statItems = useMemo(() => {
        return [
            {
                label: '教学内容',
                value: aggregatedInfo?.contentCount || 0,
                icon: BookOpen,
            },
            {
                label: '活跃学员',
                value: aggregatedInfo?.studentCount || 0,
                icon: Users,
            },
            {
                label: '综合评分',
                value: aggregatedInfo?.averageRating?.toFixed(1) || '0.0',
                icon: Star,
            },
            {
                label: '案例经验',
                value: caseStudyCount,
                icon: Award,
            },
        ];
    }, [aggregatedInfo?.averageRating, aggregatedInfo?.contentCount, aggregatedInfo?.studentCount, caseStudyCount]);

    const contactCoach = async () => {
        if (!session?.user?.id || session.user.id === coach.user_id) {
            return;
        }

        setLoading(true);
        try {
            const result = await chatService.getChatroom({ members: [session.user.id, coach.user_id] });
            if (!result) {
                showToast({ severity: 'error', summary: '创建聊天失败' });
                return;
            }

            setChatroom(null);
            setTimeout(() => {
                setChatroom(result.chatroom);
                setChatDialogVisible(true);
            }, 0);
        } finally {
            setLoading(false);
        }
    };

    const openQuestionnaire = async () => {
        setQuestionnaireLoading(true);
        try {
            const result = await coachService.getQuestionnaires({ coachId: coach.id });
            if (result?.questionnaires?.length) {
                setQuestionnaireQuestions(result.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                showToast({ severity: 'info', summary: '该教练暂未配置问卷' });
            }
        } catch (error) {
            console.error('获取问卷失败:', error);
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    const handleQuestionnaireSubmit = async (answers: TrainingItem[]) => {
        if (!userSubscription?.id) return;

        const result = await subscriptionService.updateSubscription({
            id: userSubscription.id,
            subscribe_data: answers as any,
        });

        if (result?.subscription) {
            showToast({ severity: 'success', summary: '问卷更新成功' });
            setQuestionnaireVisible(false);
        } else {
            showToast({ severity: 'error', summary: '问卷更新失败' });
        }
    };

    return (
        <div className="pb-8 pt-6 sm:pt-8">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                <div className="overflow-hidden rounded-[32px] border border-surface-200 bg-surface shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
                    <div className="border-b border-surface-100 bg-[radial-gradient(circle_at_top_left,rgba(207,109,78,0.16),transparent_42%),linear-gradient(180deg,rgba(255,248,244,0.9),rgba(255,255,255,0.98))] px-5 py-6 sm:px-8 sm:py-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                                <div className="relative">
                                    <div className="h-24 w-24 overflow-hidden rounded-[28px] border border-white/70 bg-[#F5E7E1] shadow-lg sm:h-28 sm:w-28">
                                        {coach.avatar_url ? (
                                            <img src={coach.avatar_url} alt={coach.name || 'coach'} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-3xl font-black text-[#CF6D4E]">
                                                {(coach.name || 'C').slice(0, 1).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    {coach.is_featured ? (
                                        <div className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-2xl border border-white bg-[#CF6D4E] text-white shadow-md">
                                            <Award size={18} />
                                        </div>
                                    ) : null}
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h1 className="text-2xl font-black tracking-tight text-surface-900 sm:text-3xl">
                                            {coach.name || '未命名教练'}
                                        </h1>
                                        <span className="rounded-full bg-surface-900 px-3 py-1 text-[11px] font-black tracking-[0.18em] text-white">
                                            教练
                                        </span>
                                        {coachTrack ? (
                                            <span className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-[11px] font-black text-primary-700">
                                                {getCoachTrackLabel(coachTrack)}
                                            </span>
                                        ) : null}
                                        {coach.title ? (
                                            <span className="rounded-full border border-surface-200 bg-surface px-3 py-1 text-[11px] font-bold text-surface-600">
                                                {coach.title}
                                            </span>
                                        ) : null}
                                    </div>

                                    <div className="mt-3 flex flex-wrap gap-2">
                                        {statusChip ? (
                                            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusChip.className}`}>
                                                {statusChip.label}
                                            </span>
                                        ) : null}
                                        <span className="rounded-full border border-surface-200 bg-white/80 px-3 py-1 text-xs font-medium text-surface-600">
                                            {coach.years_experience || 0} 年教练经验
                                        </span>
                                    </div>

                                    <p className="mt-4 max-w-3xl whitespace-pre-line text-sm leading-6 text-surface-600 sm:text-[15px]">
                                        {coach.bio || '这位教练还没有补充个人简介。'}
                                    </p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-3">
                                {['waiting', 'active'].includes(userSubscription?.status || '') ? (
                                    <button
                                        onClick={() => void openQuestionnaire()}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-surface-700 transition hover:border-primary-300 hover:text-primary-700"
                                    >
                                        <ClipboardList size={16} />
                                        查看问卷
                                    </button>
                                ) : null}

                                {!isOwnProfile ? (
                                    <button
                                        id="guide-subscribe-entry"
                                        onClick={() => onGoToSubscribe?.()}
                                        className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-white transition hover:opacity-90"
                                    >
                                        <Zap size={16} />
                                        {userSubscription?.status === 'active'
                                            ? '查看订阅'
                                            : userSubscription?.status === 'waiting'
                                                ? '查看进度'
                                                : '立即订阅'}
                                    </button>
                                ) : null}

                                <button
                                    onClick={() => void contactCoach()}
                                    disabled={loading || isOwnProfile}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-surface-700 transition hover:border-primary-300 hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <MessageCircle size={16} />
                                    联系教练
                                </button>

                                {isOwnProfile ? (
                                    <button
                                        onClick={() => setEditDialogVisible(true)}
                                        className="inline-flex items-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-bold text-surface-700 transition hover:border-primary-300 hover:text-primary-700"
                                    >
                                        <Edit3 size={16} />
                                        编辑资料
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <div className="border-b border-surface-100 px-5 py-5 sm:px-8">
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            {statItems.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.label}
                                        className="rounded-3xl border border-surface-200 bg-surface-50 px-4 py-4"
                                    >
                                        <div className="flex items-center gap-2 text-surface-400">
                                            <Icon size={15} />
                                            <span className="text-[11px] font-black tracking-[0.16em] text-surface-400">
                                                {item.label}
                                            </span>
                                        </div>
                                        <div className="mt-3 text-2xl font-black tracking-tight text-surface-900">
                                            {item.value}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1.2fr_0.8fr]">
                        <div className="space-y-6">
                            <section className="rounded-3xl border border-surface-200 bg-white p-5">
                                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-surface-400">
                                    擅长领域
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {specialtiesToShow.length ? specialtiesToShow.map((specialty, index) => (
                                        <span
                                            key={`${specialty}-${index}`}
                                            className="rounded-full border border-surface-200 bg-surface-50 px-3 py-2 text-xs font-bold text-surface-700"
                                        >
                                            {specialty}
                                        </span>
                                    )) : (
                                        <span className="text-sm text-surface-500">暂未填写擅长领域</span>
                                    )}
                                </div>
                            </section>

                            {(serviceModes.length > 0 || targetStudentLevels.length > 0 || supportFocus) ? (
                                <section className="rounded-3xl border border-surface-200 bg-white p-5">
                                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-surface-400">
                                        服务定位
                                    </div>
                                    {serviceModes.length > 0 ? (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {serviceModes.map((mode: string) => (
                                                <span
                                                    key={mode}
                                                    className="rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-bold text-primary-700"
                                                >
                                                    {getServiceModeLabel(mode)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    {targetStudentLevels.length > 0 ? (
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {targetStudentLevels.map((level: string) => (
                                                <span
                                                    key={level}
                                                    className="rounded-full border border-surface-200 bg-surface-50 px-3 py-2 text-xs font-bold text-surface-700"
                                                >
                                                    适合 {getTargetStudentLevelLabel(level)}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    {supportFocus ? (
                                        <p className="mt-4 whitespace-pre-line text-sm leading-6 text-surface-600">
                                            {supportFocus}
                                        </p>
                                    ) : null}
                                </section>
                            ) : null}
                        </div>

                        <div className="space-y-6">
                            <section className="rounded-3xl border border-surface-200 bg-surface-50 p-5">
                                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-surface-400">
                                    教练信息
                                </div>
                                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                                    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
                                        <div className="text-xs font-medium text-surface-500">从业经验</div>
                                        <div className="mt-2 text-lg font-black text-surface-900">
                                            {coach.years_experience || 0} 年
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
                                        <div className="text-xs font-medium text-surface-500">成功案例</div>
                                        <div className="mt-2 text-lg font-black text-surface-900">
                                            {caseStudyCount} 个
                                        </div>
                                    </div>
                                    <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
                                        <div className="text-xs font-medium text-surface-500">学员评价</div>
                                        <div className="mt-2 text-lg font-black text-surface-900">
                                            {aggregatedInfo?.reviewCount || 0} 条
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </div>

            <EditCoachProfileDialog
                visible={editDialogVisible}
                onHide={() => setEditDialogVisible(false)}
                coach={coach}
                onSave={() => {
                    window.location.reload();
                }}
            />

            {chatroom ? (
                <ChatDialog
                    visible={chatDialogVisible}
                    onHide={() => setChatDialogVisible(false)}
                    chatroom={chatroom}
                />
            ) : null}

            <QuestionnaireForm
                coach={coach}
                visible={questionnaireVisible}
                onHide={() => setQuestionnaireVisible(false)}
                questions={questionnaireQuestions}
                onSubmit={handleQuestionnaireSubmit}
                loading={questionnaireLoading}
                existingAnswers={userSubscription?.subscribe_data as unknown as TrainingItem[] | undefined}
            />
        </div>
    );
};

export default CoachIntroduction;
