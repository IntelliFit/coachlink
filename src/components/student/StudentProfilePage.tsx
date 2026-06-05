import React, { useEffect, useState } from 'react';
import { studentService } from '@/app/service/studentService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ProfileHeaderMerged } from './profile/ProfileHeaderMerged';
import { PersonalInfoSection } from './profile/PersonalInfoSection';
import { ProgressTimeline } from './profile/ProgressTimeline';
import { CoachNotesSection } from './profile/CoachNotesSection';
import { PlanPreferencesDisplay } from './profile/PlanPreferencesDisplay';
import { FitnessProfileCard } from './profile/FitnessProfileCard';
import { ProfileData } from './profile/types';
import { Skeleton } from 'primereact/skeleton';
import { VideoCollectionSection } from './profile/VideoCollectionSection';
import QuestionnaireForm from '@/app/coach/profile/[id]/QuestionnaireForm';
import { coachService } from '@/app/service/coachService';
import type { TrainingItem } from '@/types/questionnaires';
import { useToastContext } from '@/context/ToastContext';
import { ChevronDown, FileText, History, Video as VideoIcon } from 'lucide-react';
import { StrengthProgressSection } from './profile/StrengthProgressSection';
import type { QueryCoachSubscription } from '@/app/api/subscription/coach-subscriptions/entity';

interface StudentProfilePageProps {
    onBack?: () => void;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ onBack }) => {
    // 独立的数据状态
    const [profileData, setProfileData] = useState<any>(null);
    const [subscriptions, setSubscriptions] = useState<QueryCoachSubscription[]>([]);
    const [statsData, setStatsData] = useState<any>(null);
    const [planStatusMap, setPlanStatusMap] = useState<Record<string, string>>({});

    // 独立的 loading 状态
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingSubscription, setLoadingSubscription] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingPlanStatus, setLoadingPlanStatus] = useState(false);

    const [error, setError] = useState<string | null>(null);

    const { data: session, update: updateSession } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToastContext();
    const [openArchiveSection, setOpenArchiveSection] = useState<'progress' | 'questionnaire' | 'videos' | null>(null);

    const checkWechatBindStatus = async () => {
        const wechatBind = searchParams.get('wechatBind');
        const message = searchParams.get('message');

        if (wechatBind) {
            // 刷新 session 以获取最新的微信绑定状态
            await updateSession();

            // 显示提示
            if (wechatBind === 'success') {
                // showToast({
                //     severity: 'success',
                //     summary: '微信绑定成功',
                // });
            } else if (wechatBind === 'error') {
                showToast({
                    severity: 'error',
                    summary: '微信绑定失败',
                    detail: message || '请重试',
                });
            }

            // 清除 URL 参数，避免刷新页面时重复提示
            const url = new URL(window.location.href);
            url.searchParams.delete('wechatBind');
            url.searchParams.delete('message');
            router.replace(url.pathname + (url.search ? url.search : ''));
        }
    }

    // 检测微信绑定完成状态并刷新 session
    useEffect(() => {
        checkWechatBindStatus();
    }, [searchParams, updateSession, showToast, router]);

    // 问卷编辑状态
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
    const [selectedSubscription, setSelectedSubscription] = useState<QueryCoachSubscription | null>(null);

    // 个人信息编辑状态
    const [personalInfoEditing, setPersonalInfoEditing] = useState(false);

    const getCoachDisplayName = React.useCallback((sub: QueryCoachSubscription) => {
        if (sub.coach?.name) {
            return sub.coach.name;
        }
        const profile = sub.coach?.profile as Record<string, any> | null;
        return profile?.nickname || '未命名教练';
    }, []);

    // 计算组合后的 data（用于向后兼容）
    const data: ProfileData | null = profileData && session?.user ? {
        user: session.user as any,
        profile: profileData.profile,
        stats: {
            subscriptionCount: statsData?.subscriptionCount || 0,
            activePlanCount: statsData?.activePlanCount || 0,
            completedWorkouts: statsData?.completedWorkouts || 0,
            totalTrainingTime: 0
        },
        subscriptionLevel: (session.user.subscription_level as any) || 'basic',
        coachApplicationStatus: session.user.is_coach
            ? 'coach'
            : ((session.user.coach_status as any) || 'none'),
        progressData: {
            dates: [],
            weight: [],
            benchPress: [],
            squat: [],
            deadlift: []
        },
        timelineData: [],
        coachesData: [],
        notesData: []
    } : null;

    const loadPlanStatuses = React.useCallback(async (subs: QueryCoachSubscription[]) => {
        if (!subs || subs.length === 0) {
            setPlanStatusMap({});
            return;
        }

        setLoadingPlanStatus(true);
        try {
            const statusEntries = await Promise.all(
                subs.map(async (sub) => {
                    try {
                        const instanceRes = await planLibService.getInstance({ subscriptionId: sub.id });
                        return [sub.id, instanceRes?.instance?.status || 'completed'] as const;
                    } catch {
                        return [sub.id, 'completed'] as const;
                    }
                }),
            );
            setPlanStatusMap(Object.fromEntries(statusEntries));
        } finally {
            setLoadingPlanStatus(false);
        }
    }, []);

    // 刷新数据的函数（用于更新后刷新）
    const fetchData = React.useCallback(async () => {
        if (!session?.user.id) return;

        try {
            const [profileRes, subsRes, statsRes] = await Promise.all([
                studentService.getStudentProfile(session.user.id),
                subscriptionService.getCoachSubscriptions({ studentId: session.user.id }),
                studentService.getStudentStats()
            ]);

            if (profileRes) setProfileData(profileRes);
            if (statsRes) setStatsData(statsRes);

            if (subsRes && subsRes.subscriptions && subsRes.subscriptions.length > 0) {
                setSubscriptions(subsRes.subscriptions);
                await loadPlanStatuses(subsRes.subscriptions);
            } else {
                setSubscriptions([]);
                setPlanStatusMap({});
            }
        } catch (e: any) {
            console.error('刷新数据失败:', e);
        }
    }, [session?.user.id, loadPlanStatuses]);

    // 并行获取基础数据
    useEffect(() => {
        if (!session?.user.id) return;

        // 1. 获取学生档案（独立）
        const fetchProfile = async () => {
            try {
                setLoadingProfile(true);
                const res = await studentService.getStudentProfile(session.user.id);
                if (res) {
                    setProfileData(res);
                }
            } catch (e: any) {
                console.error('获取学生档案失败:', e);
                setError(e?.message || '加载失败');
            } finally {
                setLoadingProfile(false);
            }
        };

        // 2. 获取订阅列表（独立）
        const fetchSubscription = async () => {
            try {
                setLoadingSubscription(true);
                const res = await subscriptionService.getCoachSubscriptions({ studentId: session.user.id });
                if (res && res.subscriptions && res.subscriptions.length > 0) {
                    setSubscriptions(res.subscriptions);
                    await loadPlanStatuses(res.subscriptions);
                } else {
                    setSubscriptions([]);
                    setPlanStatusMap({});
                }
            } catch (e: any) {
                console.error('获取订阅列表失败:', e);
            } finally {
                setLoadingSubscription(false);
            }
        };

        // 3. 获取统计数据（独立）
        const fetchStats = async () => {
            try {
                setLoadingStats(true);
                const res = await studentService.getStudentStats();
                if (res) {
                    setStatsData(res);
                }
            } catch (e: any) {
                console.error('获取统计数据失败:', e);
            } finally {
                setLoadingStats(false);
            }
        };

        // 并行执行所有独立请求
        Promise.all([
            fetchProfile(),
            fetchSubscription(),
            fetchStats()
        ]);
    }, [session?.user.id, loadPlanStatuses]);

    // 打开问卷编辑对话框（不跳转）
    const handleEditQuestionnaire = async (subscriptionItem: QueryCoachSubscription) => {
        if (!subscriptionItem?.coach_id) return;

        setSelectedSubscription(subscriptionItem);
        setQuestionnaireLoading(true);
        try {
            const qRes = await coachService.getQuestionnaires({ coachId: subscriptionItem.coach_id });
            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                setSelectedSubscription(null);
                showToast({ severity: 'info', summary: '暂无问卷配置' });
            }
        } catch (error) {
            setSelectedSubscription(null);
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    // 保存问卷
    const handleSaveQuestionnaire = async (answers: TrainingItem[]) => {
        if (!selectedSubscription?.id) return;

        try {
            const res = await subscriptionService.updateSubscription({
                id: selectedSubscription.id,
                subscribe_data: answers as any
            });

            if (res?.subscription) {
                showToast({ severity: 'success', summary: '问卷更新成功' });
                setQuestionnaireVisible(false);
                setSelectedSubscription(null);
                // 刷新数据
                fetchData();
            } else {
                showToast({ severity: 'error', summary: '问卷更新失败' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '保存失败' });
        }
    };

    // 判断是否所有关键数据都已加载（至少要有 profile 才能显示页面）
    const isInitialLoading = loadingProfile && loadingSubscription && loadingStats;
    const archiveSections: Array<{
        key: 'progress' | 'questionnaire' | 'videos';
        title: string;
        description: string;
        meta: string;
        icon: typeof History;
    }> = [
        {
            key: 'progress',
            title: '进步足迹',
            description: '训练中的 PR、突破和重要记录',
            meta: '突破记录',
            icon: History,
        },
        {
            key: 'questionnaire',
            title: '需求问卷',
            description: '与教练服务相关的训练需求',
            meta: loadingSubscription || loadingPlanStatus ? '加载中' : subscriptions.length > 0 ? `${subscriptions.length} 份` : '暂无',
            icon: FileText,
        },
        {
            key: 'videos',
            title: '训练视频',
            description: '技术参考、反馈素材和精选视频',
            meta: '视频集',
            icon: VideoIcon,
        },
    ];

    if (isInitialLoading) {
        return (
            <div className="p-6 space-y-6 max-w-5xl mx-auto">
                <Skeleton height="300px" className="rounded-2xl" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2 space-y-6">
                        <Skeleton height="150px" className="rounded-2xl" />
                        <Skeleton height="300px" className="rounded-2xl" />
                    </div>
                    <div className="space-y-6">
                        <Skeleton height="200px" className="rounded-2xl" />
                        <Skeleton height="400px" className="rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    if (error && !profileData) return <div className="p-6 text-red-600 text-center">{error}</div>;

    return (
        <>
            <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
                {/* 合并后的头像和个人信息板块 - 小红书风格 */}
                {loadingProfile ? (
                    <Skeleton height="300px" className="rounded-2xl" />
                ) : data ? (
                    <>
                        <ProfileHeaderMerged
                            data={data}
                            onUpdate={fetchData}
                            onEditClick={() => setPersonalInfoEditing(true)}
                        />

                        {/* 个人信息编辑对话框（通过合并组件触发） */}
                        <PersonalInfoSection
                            data={data}
                            onUpdate={fetchData}
                            editingVisible={personalInfoEditing}
                            onEditingChange={setPersonalInfoEditing}
                            hideDisplay={true}
                            basicOnly={true}
                        />

                        <FitnessProfileCard
                            profile={profileData?.profile || null}
                            questionnaire={profileData?.questionnaire || null}
                            onUpdate={fetchData}
                        />
                    </>
                ) : null}

                {/* 首屏：高频信息尽量上移 */}
                <div className="space-y-3 sm:space-y-4">
                    {/* 教练评语 - 独立组件，自己管理 loading */}
                    {data && session?.user.id && (
                        <CoachNotesSection data={data} userId={session.user.id} />
                    )}

                    {/* 力量进步曲线 - 依赖 subscription */}
                    {loadingSubscription ? (
                        <Skeleton height="200px" className="rounded-2xl" />
                    ) : (
                        <StrengthProgressSection session={session} subscription={subscriptions[0] || null} />
                    )}
                </div>

                <div className="space-y-3">
                    <section className="rounded-2xl border border-surface-200 bg-surface p-4 shadow-sm sm:p-5">
                        <div className="mb-3">
                            <h2 className="text-base font-black text-surface-900">训练档案</h2>
                            <p className="mt-1 text-sm text-surface-500">
                                低频查看的记录已收纳，需要时再展开。
                            </p>
                        </div>
                        <div className="space-y-2">
                            {archiveSections.map((section) => {
                                const Icon = section.icon;
                                const active = openArchiveSection === section.key;
                                return (
                                    <button
                                        key={section.key}
                                        type="button"
                                        onClick={() => setOpenArchiveSection(active ? null : section.key)}
                                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
                                            active
                                                ? 'border-primary-200 bg-primary-50/40'
                                                : 'border-surface-100 bg-surface-50 hover:border-primary-100 hover:bg-primary-50/20'
                                        }`}
                                        aria-expanded={active}
                                    >
                                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                                            active ? 'bg-primary-500 text-white' : 'bg-surface text-surface-500'
                                        }`}>
                                            <Icon size={18} />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm font-black text-surface-900">{section.title}</span>
                                            <span className="mt-0.5 block truncate text-xs text-surface-500">{section.description}</span>
                                        </span>
                                        <span className="shrink-0 text-xs font-bold text-surface-500">{section.meta}</span>
                                        <ChevronDown
                                            size={16}
                                            className={`shrink-0 text-surface-400 transition-transform ${active ? 'rotate-180 text-primary-500' : ''}`}
                                        />
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {openArchiveSection === 'progress' ? (
                        <ProgressTimeline data={data} />
                    ) : null}

                    {openArchiveSection === 'questionnaire' ? (
                        <section className="rounded-2xl border border-surface-200 bg-surface p-4 shadow-sm sm:p-5">
                            {loadingSubscription || loadingPlanStatus ? (
                                <Skeleton height="200px" className="rounded-2xl" />
                            ) : subscriptions.length > 0 ? (
                                <div className="space-y-4">
                                    {subscriptions.map((sub, index) => (
                                        <div key={sub.id} className="space-y-2">
                                            <div className="text-sm font-medium text-surface-600">
                                                教练 {index + 1}：{getCoachDisplayName(sub)}
                                            </div>
                                            <PlanPreferencesDisplay
                                                subscribeData={Array.isArray(sub.subscribe_data) ? sub.subscribe_data : []}
                                                coachId={sub.coach?.user_id || sub.coach_id}
                                                planStatus={planStatusMap[sub.id]}
                                                onEditQuestionnaire={() => handleEditQuestionnaire(sub)}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center text-sm text-surface-500">
                                    暂无训练需求问卷数据
                                </div>
                            )}
                        </section>
                    ) : null}

                    {openArchiveSection === 'videos' ? (
                        <VideoCollectionSection />
                    ) : null}
                </div>
            </div>

            {/* 问卷编辑对话框 */}
            {selectedSubscription?.coach && (
                <QuestionnaireForm
                    visible={questionnaireVisible}
                    onHide={() => {
                        setQuestionnaireVisible(false);
                        setSelectedSubscription(null);
                    }}
                    questions={questionnaireQuestions}
                    coach={selectedSubscription.coach}
                    onSubmit={handleSaveQuestionnaire}
                    loading={questionnaireLoading}
                    existingAnswers={selectedSubscription.subscribe_data as any}
                />
            )}
        </>
    );
};

export default StudentProfilePage;
