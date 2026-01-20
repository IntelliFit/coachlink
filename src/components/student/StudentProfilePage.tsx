import React, { useEffect, useState } from 'react';
import { studentService } from '@/app/service/studentService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProfileHeaderMerged } from './profile/ProfileHeaderMerged';
import { PersonalInfoSection } from './profile/PersonalInfoSection';
import { ProgressTimeline } from './profile/ProgressTimeline';
import { CoachNotesSection } from './profile/CoachNotesSection';
import { SportCardsDisplay } from './profile/SportCardsDisplay';
import { PlanPreferencesDisplay } from './profile/PlanPreferencesDisplay';
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

interface StudentProfilePageProps {
    onBack?: () => void;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ onBack }) => {
    // 独立的数据状态
    const [profileData, setProfileData] = useState<any>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [statsData, setStatsData] = useState<any>(null);
    const [planStatus, setPlanStatus] = useState<string | null>(null);
    
    // 独立的 loading 状态
    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingSubscription, setLoadingSubscription] = useState(true);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingPlanStatus, setLoadingPlanStatus] = useState(false);
    
    const [error, setError] = useState<string | null>(null);

    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();
    const [activeTab, setActiveTab] = useState(0);

    // 问卷编辑状态
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);
    
    // 个人信息编辑状态
    const [personalInfoEditing, setPersonalInfoEditing] = useState(false);

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
                const activeSub = subsRes.subscriptions[0];
                setSubscription(activeSub);
                
                try {
                    const instanceRes = await planLibService.getInstance({ subscriptionId: activeSub.id });
                    if (instanceRes?.instance?.status) {
                        setPlanStatus(instanceRes.instance.status);
                    } else {
                        setPlanStatus('completed');
                    }
                } catch (e) {
                    setPlanStatus('completed');
                }
            }
        } catch (e: any) {
            console.error('刷新数据失败:', e);
        }
    }, [session?.user.id]);

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
                    const activeSub = res.subscriptions[0];
                    setSubscription(activeSub);
                    
                    // 获取计划实例状态（依赖订阅数据，但不阻塞其他数据）
                    setLoadingPlanStatus(true);
                    try {
                        const instanceRes = await planLibService.getInstance({ subscriptionId: activeSub.id });
                        if (instanceRes?.instance?.status) {
                            setPlanStatus(instanceRes.instance.status);
                        } else {
                            setPlanStatus('completed');
                        }
                    } catch (e) {
                        // 没有计划实例，允许编辑
                        setPlanStatus('completed');
                    } finally {
                        setLoadingPlanStatus(false);
                    }
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
    }, [session?.user.id]);

    // 打开问卷编辑对话框（不跳转）
    const handleEditQuestionnaire = async () => {
        if (!subscription?.coach_id) return;

        setQuestionnaireLoading(true);
        try {
            const qRes = await coachService.getQuestionnaires({ coachId: subscription.coach_id });
            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires);
                setQuestionnaireVisible(true);
            } else {
                showToast({ severity: 'info', summary: '暂无问卷配置' });
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '获取问卷失败' });
        } finally {
            setQuestionnaireLoading(false);
        }
    };

    // 保存问卷
    const handleSaveQuestionnaire = async (answers: TrainingItem[]) => {
        if (!subscription?.id) return;

        try {
            const res = await subscriptionService.updateSubscription({
                id: subscription.id,
                subscribe_data: answers as any
            });

            if (res?.subscription) {
                showToast({ severity: 'success', summary: '问卷更新成功' });
                setQuestionnaireVisible(false);
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
                        <StrengthProgressSection session={session} subscription={subscription} />
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
                                ) : subscription && subscription.subscribe_data ? (
                                    <PlanPreferencesDisplay
                                        subscribeData={subscription.subscribe_data}
                                        coachId={subscription.coach?.user_id || subscription.coach_id}
                                        planStatus={planStatus}
                                        onEditQuestionnaire={handleEditQuestionnaire}
                                    />
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
            {subscription && (
                <QuestionnaireForm
                    visible={questionnaireVisible}
                    onHide={() => setQuestionnaireVisible(false)}
                    questions={questionnaireQuestions}
                    coach={subscription.coach}
                    onSubmit={handleSaveQuestionnaire}
                    loading={questionnaireLoading}
                    existingAnswers={subscription.subscribe_data as any}
                />
            )}
        </>
    );
};

export default StudentProfilePage;
