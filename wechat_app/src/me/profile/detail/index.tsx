import { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider, Skeleton } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { subscriptionService } from '@/services/subscriptionService'
import { coachService } from '@/services/coach/coachService'
import { trainingService } from '@/services/trainingService'
import ProfileHeader from './components/ProfileHeader'
import PersonalInfoSection from './components/PersonalInfoSection'
import SportCardsDisplay from './components/SportCardsDisplay'
import CoachNotesSection from './components/CoachNotesSection'
import StrengthProgressSection from './components/StrengthProgressSection'
import ProgressTimeline from './components/ProgressTimeline'
import PlanPreferencesDisplay from './components/PlanPreferencesDisplay'
import VideoCollectionSection from './components/VideoCollectionSection'
import QuestionnaireForm from '@/components/QuestionnaireForm'
import BottomNav from '@/components/BottomNav'
import './index.scss'
import { Edit, Video, Clock } from '@nutui/icons-react-taro'

type ProfileTab = 'timeline' | 'questionnaire' | 'video'

interface ProfileData {
    user: any
    profile: any
    stats: {
        subscriptionCount: number
        activePlanCount: number
        completedWorkouts: number
        totalTrainingTime: number
    }
    subscriptionLevel: 'basic' | 'advanced' | 'premium'
    coachApplicationStatus: 'none' | 'draft' | 'pending' | 'rejected' | 'approved' | 'coach'
    progressData: { dates: string[]; weight: number[]; benchPress: number[]; squat: number[]; deadlift: number[] }
    timelineData: any[]
    coachesData: any[]
    notesData: any[]
}

function ProfileDetail() {
    const [profileData, setProfileData] = useState<any>(null)
    const [subscription, setSubscription] = useState<any>(null)
    const [statsData, setStatsData] = useState<any>(null)
    const [planStatus, setPlanStatus] = useState<string | null>(null)
    const [data, setData] = useState<ProfileData | null>(null)
    const [error, setError] = useState<string | null>(null)

    const [loadingProfile, setLoadingProfile] = useState(true)
    const [loadingSubscription, setLoadingSubscription] = useState(true)
    const [loadingStats, setLoadingStats] = useState(true)
    const [loadingPlanStatus, setLoadingPlanStatus] = useState(false)

    const [activeTab, setActiveTab] = useState<ProfileTab>('timeline')
    const [personalInfoEditing, setPersonalInfoEditing] = useState(false)
    const [questionnaireVisible, setQuestionnaireVisible] = useState(false)
    const [questionnaireQuestions, setQuestionnaireQuestions] = useState<any[]>([])
    const [questionnaireLoading, setQuestionnaireLoading] = useState(false)

    const authSession = authService.getAuthSession({ normalize: true })
    const userId = authSession.user?.id

    const fetchData = useCallback(async () => {
        const uid = authService.getAuthSession({ normalize: true }).user?.id
        if (!uid) return
        try {
            const [profileRes, subsRes, statsRes] = await Promise.all([
                studentService.getStudentProfile(uid),
                subscriptionService.getCoachSubscriptions({ studentId: uid }),
                studentService.getStudentStats()
            ])

            if (profileRes) setProfileData(profileRes)
            if (statsRes) setStatsData(statsRes)

            if (subsRes?.subscriptions?.length) {
                const activeSub = subsRes.subscriptions[0]
                setSubscription(activeSub)
                setLoadingPlanStatus(true)
                try {
                    const instanceRes = await trainingService.getInstance({ subscriptionId: activeSub.id })
                    const status = instanceRes?.instance?.status
                    setPlanStatus(status ?? 'completed')
                } catch {
                    setPlanStatus('completed')
                } finally {
                    setLoadingPlanStatus(false)
                }
            }
        } catch (e: any) {
            console.error('刷新档案失败:', e)
        }
    }, [])

    useEffect(() => {
        const session = authService.getAuthSession({ normalize: true })
        const user = session.user
        if (!session.isAuthenticated || !user?.id) {
            // 未登录时直接跳转登录页，不显示「请先登录」提示
            Taro.redirectTo({
                url: authService.buildLoginUrl('/me/profile/detail/index')
            })
            return
        }

        const load = async () => {
            try {
                setLoadingProfile(true)
                setLoadingSubscription(true)
                setLoadingStats(true)
                setError(null)

                const [profileRes, subsRes, statsRes] = await Promise.all([
                    studentService.getStudentProfile(user.id),
                    subscriptionService.getCoachSubscriptions({ studentId: user.id }),
                    studentService.getStudentStats()
                ])

                if (profileRes) setProfileData(profileRes)
                if (statsRes) setStatsData(statsRes)

                if (subsRes?.subscriptions?.length) {
                    const activeSub = subsRes.subscriptions[0]
                    setSubscription(activeSub)
                    setLoadingPlanStatus(true)
                    try {
                        const instanceRes = await trainingService.getInstance({ subscriptionId: activeSub.id })
                        setPlanStatus(instanceRes?.instance?.status ?? 'completed')
                    } catch {
                        setPlanStatus('completed')
                    } finally {
                        setLoadingPlanStatus(false)
                    }
                }
            } catch (e: any) {
                setError(e?.message || '加载失败')
                Taro.showToast({ title: '加载失败', icon: 'none' })
            } finally {
                setLoadingProfile(false)
                setLoadingSubscription(false)
                setLoadingStats(false)
            }
        }

        load()
    }, [authSession.isAuthenticated, userId])

    useEffect(() => {
        if (!profileData || !userId) return
        const session = authService.getAuthSession({ normalize: true })
        const u = session.user
        if (!u?.id) return
        const payload: ProfileData = {
            user: u,
            profile: profileData.profile,
            stats: {
                subscriptionCount: statsData?.subscriptionCount ?? 0,
                activePlanCount: statsData?.activePlanCount ?? 0,
                completedWorkouts: statsData?.completedWorkouts ?? 0,
                totalTrainingTime: 0
            },
            subscriptionLevel: (u.subscription_level as any) ?? 'basic',
            coachApplicationStatus: u.is_coach ? 'coach' : ((u.coach_status as any) ?? 'none'),
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
        }
        setData((prev) => {
            if (
                prev &&
                prev.user?.id === payload.user?.id &&
                prev.profile === payload.profile &&
                prev.stats?.subscriptionCount === payload.stats.subscriptionCount &&
                prev.stats?.activePlanCount === payload.stats.activePlanCount &&
                prev.stats?.completedWorkouts === payload.stats.completedWorkouts &&
                prev.subscriptionLevel === payload.subscriptionLevel &&
                prev.coachApplicationStatus === payload.coachApplicationStatus
            ) {
                return prev
            }
            return payload
        })
    }, [profileData, statsData, userId])

    const handleEditQuestionnaire = async () => {
        if (!subscription?.coach_id) {
            Taro.showToast({ title: '暂无教练信息', icon: 'none' })
            return
        }

        setQuestionnaireLoading(true)
        try {
            const qRes = await coachService.getQuestionnaires({ coachId: subscription.coach_id })
            if (qRes?.questionnaires && qRes.questionnaires.length > 0) {
                setQuestionnaireQuestions(qRes.questionnaires)
                setQuestionnaireVisible(true)
            } else {
                Taro.showToast({ title: '暂无问卷配置', icon: 'none' })
            }
        } catch (error: any) {
            Taro.showToast({ title: error.message || '获取问卷失败', icon: 'none' })
        } finally {
            setQuestionnaireLoading(false)
        }
    }

    const handleSaveQuestionnaire = async (answers: any[]) => {
        if (!subscription?.id) return

        try {
            const res = await subscriptionService.updateSubscription({
                id: subscription.id,
                subscribe_data: answers
            })

            if (res?.subscription) {
                Taro.showToast({ title: '问卷更新成功', icon: 'success' })
                setQuestionnaireVisible(false)
                fetchData()
            } else {
                Taro.showToast({ title: '问卷更新失败', icon: 'none' })
            }
        } catch (error: any) {
            Taro.showToast({ title: error.message || '保存失败', icon: 'none' })
        }
    }

    const isInitialLoading = loadingProfile && loadingSubscription && loadingStats

    if (isInitialLoading) {
        return (
            <ConfigProvider locale={zhCN}>
                <View className="profile-detail-page page-with-float-nav">
                    <View className="skeleton-wrap">
                        <Skeleton animated rows={4} title avatar avatarSize="64px" visible={false} className="skeleton-header" />
                        <Skeleton animated rows={3} title={false} visible={false} className="skeleton-block" />
                        <Skeleton animated rows={2} title={false} visible={false} className="skeleton-block" />
                        <Skeleton animated rows={3} title={false} visible={false} className="skeleton-block" />
                    </View>
                    <BottomNav />
                </View>
            </ConfigProvider>
        )
    }

    if (error && !profileData) {
        return (
            <ConfigProvider locale={zhCN}>
                <View className="profile-detail-page">
                    <View className="error-container">
                        <Text className="error-text">{error}</Text>
                    </View>
                    <BottomNav />
                </View>
            </ConfigProvider>
        )
    }

    if (!data) {
        return (
            <ConfigProvider locale={zhCN}>
                <View className="profile-detail-page">
                    <BottomNav />
                </View>
            </ConfigProvider>
        )
    }

    return (
        <ConfigProvider locale={zhCN}>
            <View className="profile-detail-page page-with-float-nav">
                <ScrollView className="page-scroll" scrollY>
                    <ProfileHeader
                        data={data}
                        onUpdate={fetchData}
                        onEditClick={() => Taro.navigateTo({ url: '/me/profile/edit/index' })}
                    />

                    <PersonalInfoSection
                        data={data}
                        onUpdate={fetchData}
                        editingVisible={personalInfoEditing}
                        onEditingChange={setPersonalInfoEditing}
                        hideDisplay={true}
                    />

                    {loadingProfile ? (
                        <Skeleton animated rows={2} title={false} visible={false} className="skeleton-inline" />
                    ) : (
                        <SportCardsDisplay sportCards={data.profile?.sport_cards} />
                    )}

                    {userId ? <CoachNotesSection data={data} userId={userId} /> : null}

                    {loadingSubscription ? (
                        <Skeleton animated rows={2} title={false} visible={false} className="skeleton-inline" />
                    ) : (
                        <StrengthProgressSection user={data.user} subscription={subscription} />
                    )}

                    <View className="tab-section">
                        <View className="tab-bar">
                            <View
                                className={`tab-item ${activeTab === 'timeline' ? 'active' : ''}`}
                                onClick={() => setActiveTab('timeline')}
                            >
                                <View className="tab-icon"><Clock size={16} color={activeTab === 'timeline' ? '#CF6D4E' : '#9CA3AF'} /></View>
                                <Text className="tab-text">进步足迹</Text>
                            </View>
                            <View
                                className={`tab-item ${activeTab === 'questionnaire' ? 'active' : ''}`}
                                onClick={() => setActiveTab('questionnaire')}
                            >
                                <View className="tab-icon"><Edit /></View>
                                <Text className="tab-text">需求问卷</Text>
                            </View>
                            <View
                                className={`tab-item ${activeTab === 'video' ? 'active' : ''}`}
                                onClick={() => setActiveTab('video')}
                            >
                                <View className="tab-icon"><Video /></View>
                                <Text className="tab-text">训练视频</Text>
                            </View>
                        </View>

                        <View className="tab-content">
                            {activeTab === 'timeline' && <ProgressTimeline data={data} />}

                            {activeTab === 'questionnaire' && (
                                loadingSubscription || loadingPlanStatus ? (
                                    <Skeleton animated rows={3} title={false} visible={false} className="skeleton-inline" />
                                ) : subscription?.subscribe_data ? (
                                    <PlanPreferencesDisplay
                                        subscribeData={subscription.subscribe_data}
                                        coachId={subscription.coach?.user_id ?? subscription.coach_id}
                                        planStatus={planStatus}
                                        onEditQuestionnaire={handleEditQuestionnaire}
                                    />
                                ) : (
                                    <View className="empty-state">
                                        <View className="empty-icon"><Edit /></View>
                                        <Text className="empty-text">暂无训练需求问卷数据</Text>
                                    </View>
                                )
                            )}

                            {activeTab === 'video' && (
                                loadingProfile ? (
                                    <Skeleton animated rows={3} title={false} visible={false} className="skeleton-inline" />
                                ) : (
                                    <VideoCollectionSection videos={profileData?.videos} />
                                )
                            )}
                        </View>
                    </View>
                </ScrollView>
                <BottomNav />
            </View>

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
        </ConfigProvider>
    )
}

export default ProfileDetail
