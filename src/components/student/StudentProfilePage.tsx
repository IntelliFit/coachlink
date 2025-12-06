import React, { useEffect, useState } from 'react';
import { studentService } from '@/app/service/studentService';
import { useSession } from 'next-auth/react';
import { ProfileHeader } from './profile/ProfileHeader';
import { CoachApplicationCard } from './profile/CoachApplicationCard';
import { PersonalInfoSection } from './profile/PersonalInfoSection';
import { ProgressChartSection } from './profile/ProgressChartSection';
import { ProgressTimeline } from './profile/ProgressTimeline';
import { MyCoachesList } from './profile/MyCoachesList';
import { CoachNotesSection } from './profile/CoachNotesSection';
import { SportCardsDisplay } from './profile/SportCardsDisplay';
import { ProfileData } from './profile/types';
import { Skeleton } from 'primereact/skeleton';

interface StudentProfilePageProps {
    onBack?: () => void;
}

const StudentProfilePage: React.FC<StudentProfilePageProps> = ({ onBack }) => {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ProfileData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const { data: session } = useSession();

    const fetchData = async () => {
        try {
            setLoading(true);
            const profileRes = await studentService.getStudentProfile(session?.user.id);
            
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
                    coachApplicationStatus: (session.user.coach_status as any) || 'none',
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
        <div className="p-6 max-w-6xl mx-auto space-y-6">
            {onBack && (
                <button className="mb-4 text-surface-500 hover:text-surface-900 flex items-center gap-1" onClick={onBack}>
                    <i className="pi pi-arrow-left"></i> 返回
                </button>
            )}

            <ProfileHeader data={data} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (Main Content) */}
                <div className="lg:col-span-2 space-y-6">
                    <CoachApplicationCard 
                        status={data.coachApplicationStatus} 
                        rejectionReason={data.coachRejectionReason} 
                    />
                    <SportCardsDisplay sportCards={data.profile?.sport_cards as any} />
                    <ProgressChartSection data={data} />
                    <ProgressTimeline data={data} />
                    <CoachNotesSection data={data} userId={session?.user.id} />
                </div>

                {/* Right Column (Sidebar) */}
                <div className="space-y-6">
                    <PersonalInfoSection data={data} onUpdate={fetchData} />
                    <MyCoachesList />
                </div>
            </div>
        </div>
    );
};

export default StudentProfilePage;
