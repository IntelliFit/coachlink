import React, { useEffect, useState } from 'react';
import { studentService } from '@/app/service/studentService';
import { subscriptionService } from '@/app/service/subscriptionService';
import { planLibService } from '@/app/service/planLibService';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProfileHeader } from './profile/ProfileHeader';
import { PersonalInfoSection } from './profile/PersonalInfoSection';
import { ProgressTimeline } from './profile/ProgressTimeline';
import { CoachNotesSection } from './profile/CoachNotesSection';
import { SportCardsDisplay } from './profile/SportCardsDisplay';
import { MyCoachesList } from './profile/MyCoachesList';
import { PlanPreferencesDisplay } from './profile/PlanPreferencesDisplay';
import { ProfileData } from './profile/types';
import { Skeleton } from 'primereact/skeleton';
import { VideoCollectionSection } from './profile/VideoCollectionSection';
import { E1RMProgressChart } from './profile/E1RMProgressChart';
import QuestionnaireForm from '@/app/coach/profile/[id]/QuestionnaireForm';
import { coachService } from '@/app/service/coachService';
import type { TrainingItem } from '@/types/questionnaires';
import { useToastContext } from '@/context/ToastContext';

interface StudentProfilePageProps {
    onBack?: () => void;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProfileData | null>(null);
    const [subscription, setSubscription] = useState<any>(null);
    const [planStatus, setPlanStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { data: session } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    // 问卷编辑状态
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false);
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<TrainingItem[]>([]);
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false);

    const fetchData = async () => {
        try {
            setLoading(true);
            
            const [profileRes, subsRes] = await Promise.all([
                studentService.getStudentProfile(session?.user.id),
                subscriptionService.getCoachSubscriptions({ studentId: session?.user.id })
            ]);
            
            let activeSub = null;
            if (subsRes && subsRes.subscriptions && subsRes.subscriptions.length > 0) {
                activeSub = subsRes.subscriptions[0];
                setSubscription(activeSub);
                
                // 获取计划实例以检查状态
                try {
                    const instanceRes = await planLibService.getInstance({ subscriptionId: activeSub.id });
                    if (instanceRes?.instance?.status) {
                        setPlanStatus(instanceRes.instance.status);
                    }
                } catch (e) {
                    // 没有计划实例，允许编辑
                    setPlanStatus('completed');
                }
            }
            
            if (profileRes && session?.user) {
                // Real data (no mock timeline data - ProgressTimeline fetches from API)
                const mockData: ProfileData = {
                    user: session.user as any, // Type assertion needed as session user might differ slightly
                    profile: profileRes.profile,
                    stats: {
                        subscriptionCount: 1,
                        activePlanCount: 2,
                        completedWorkouts: 48,
                        totalTrainingTime: 2880 // 48 * 60
                    },
                    subscriptionLevel: (session.user.subscription_level as any) || 'basic',
                    // 如果 is_coach=true，状态应该是 'coach'（已完成教练身份认证）
                    // 否则使用数据库中的 coach_status 值
                    coachApplicationStatus: session.user.is_coach 
                        ? 'coach' 
                        : ((session.user.coach_status as any) || 'none'),
                    progressData: {
                        dates: ['1月', '2月', '3月', '4月', '5月', '6月'],
                        weight: [75, 74.5, 74, 73.5, 73, 72.5],
                        benchPress: [60, 65, 70, 72.5, 75, 80],
                        squat: [80, 90, 100, 105, 110, 120],
                        deadlift: [100, 110, 120, 130, 140, 150]
                    },
                    timelineData: [], // Empty - ProgressTimeline fetches real PR data from API
                    coachesData: [
                        {
                            id: 'c1',
                            name: '张教练',
                            avatarUrl: null,
                            title: '力量举专家',
                            subscriptionStatus: 'active',
                            subscriptionTier: 2,
                            subscriptionEndDate: '2023-12-31'
                        }
                    ],
                    notesData: [
                        {
                            id: 'n1',
                            coachId: 'c1',
                            coachName: '张教练',
                            coachAvatar: null,
                            date: '2023-06-15',
                            content: '最近进步很明显，特别是深蹲的稳定性提高了很多。建议下周开始增加辅助训练的容量，重点加强核心力量。饮食方面要注意蛋白质的摄入量。',
                            tags: ['深蹲', '核心', '饮食建议']
                        }
                    ]
                };
                setData(mockData);
            }
        } catch (e: any) {
            setError(e?.message || '加载失败');
        } finally {
            setLoading(false);
        }
    };

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

    useEffect(() => {
        if (session?.user.id) {
            fetchData();
        }
    }, [session?.user.id]);

    if (loading) {
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

    if (error) return <div className="p-6 text-red-600 text-center">{error}</div>;
    if (!data) return null;

    return (
        <>
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {onBack && (
                <button className="mb-4 text-surface-500 hover:text-surface-900 flex items-center gap-1" onClick={onBack}>
                    <i className="pi pi-arrow-left"></i> 返回
                </button>
            )}

            <ProfileHeader data={data} />

            {/* Two-column layout on large screens, single column on small screens */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Left column - slightly wider */}
                <div className="lg:w-7/12 space-y-6">
                    <SportCardsDisplay sportCards={data.profile?.sport_cards as any} />
                    
                    {/* Strength Progress Curve */}
                    <div className="bg-surface rounded-2xl shadow-sm overflow-hidden border border-surface-200 p-5">
                         <E1RMProgressChart studentId={session?.user.id as string} coachId={subscription?.coach_id} />
                    </div>

                    <ProgressTimeline data={data} />
                    
                    {/* 训练偏好/问卷展示 */}
                    {subscription && subscription.subscribe_data && (
                        <PlanPreferencesDisplay 
                            subscribeData={subscription.subscribe_data} 
                            coachId={subscription.coach?.user_id || subscription.coach_id}
                            planStatus={planStatus}
                            onEditQuestionnaire={handleEditQuestionnaire}
                        />
                    )}
                    
                    <VideoCollectionSection />
                    <CoachNotesSection data={data} userId={session?.user.id} />
                </div>
                
                {/* Right column */}
                <div className="lg:w-5/12 space-y-6">
                    <PersonalInfoSection data={data} onUpdate={fetchData} />
                    <MyCoachesList />
                </div>
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
