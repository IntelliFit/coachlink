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
import { SportCardsDisplay } from './profile/SportCardsDisplay';
import { PlanPreferencesDisplay } from './profile/PlanPreferencesDisplay';
import { FitnessProfileCard } from './profile/FitnessProfileCard';
import { ProfileData } from './profile/types';
import { Skeleton } from 'primereact/skeleton';
import { VideoCollectionSection } from './profile/VideoCollectionSection';
import { E1RMProgressChart } from './profile/E1RMProgressChart';
import QuestionnaireForm from '@/app/coach/profile/[id]/QuestionnaireForm';
import { coachService } from '@/app/service/coachService';
import type { TrainingItem } from '@/types/questionnaires';
import { useToastContext } from '@/context/ToastContext';
import { TabView, TabPanel } from 'primereact/tabview';
import { BarChart3, FileText, History, Video as VideoIcon } from 'lucide-react';
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
    const [activeTab, setActiveTab] = useState(0);

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
                        />

                        <FitnessProfileCard
                            profile={profileData?.profile || null}
                            questionnaire={profileData?.questionnaire || null}
                            onUpdate={fetchData}
                        />
                    </>
                ) : null}

                {/* 首屏：高频信息尽量上移（运动数据 + 教练评语） */}
                <div className="space-y-3 sm:space-y-4">
                    {/* 运动卡片 - 依赖 profile */}
                    {loadingProfile ? (
                        <Skeleton height="150px" className="rounded-2xl" />
                    ) : profileData?.profile?.sport_cards ? (
                        <SportCardsDisplay sportCards={profileData.profile.sport_cards as any} />
                    ) : null}

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

                {/* 方案B：Tab 分页，避免无限下滑 */}
                <div className="bg-surface rounded-2xl shadow-sm border border-surface-200 overflow-hidden">
                    <TabView
                        activeIndex={activeTab}
                        onTabChange={(e) => setActiveTab(e.index)}
                        scrollable
                        className="transparent-tabs"
                    >
                        <TabPanel
                            header={
                                <div className="flex items-center gap-2">
                                    <History className="w-4 h-4" />
                                    <span>进步足迹</span>
                                </div>
                            }
                        >
                            <div className="p-4 sm:p-6">
                                <ProgressTimeline data={data} />
                            </div>
                        </TabPanel>

                        <TabPanel
                            header={
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    <span>需求问卷</span>
                                </div>
                            }
                        >
                            <div className="p-4 sm:p-6">
                                {loadingSubscription || loadingPlanStatus ? (
                                    <Skeleton height="200px" className="rounded-2xl" />
                                ) : subscriptions.length > 0 ? (
                                    <div className="space-y-4">
                                        {subscriptions.map((sub, index) => (
                                            <div key={sub.id} className="space-y-2">
                                                <div className="text-sm text-surface-600 font-medium px-1">
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
                                    <div className="text-center py-10 text-surface-500">
                                        暂无训练需求问卷数据
                                    </div>
                                )}
                            </div>
                        </TabPanel>

                        <TabPanel
                            header={
                                <div className="flex items-center gap-2">
                                    <VideoIcon className="w-4 h-4" />
                                    <span>训练视频</span>
                                </div>
                            }
                        >
                            <div className="p-4 sm:p-6">
                                <VideoCollectionSection />
                            </div>
                        </TabPanel>
                    </TabView>
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
