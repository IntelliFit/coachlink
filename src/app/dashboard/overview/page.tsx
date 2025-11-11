'use client';

import React, { useState, useEffect } from 'react';
import { Users, Video, Star, TrendingUp } from 'lucide-react';
import { Card } from 'primereact/card';
import RecentActivities from '@/app/dashboard/components/RecentActivities';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/dashboard/service/coachService';
import { CoachStudentItem, Student } from '@/types/coach';

const Overview = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    // 加载学员数据
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState<boolean>(true);

    useEffect(() => {
        const loadStudents = async () => {
            setLoadingStudents(true);
            try {
                const items = await coachService.getStudents();
                
                const mapped: Student[] = (items || [] as CoachStudentItem[]).map((it) => ({
                    id: it.student?.id || it.student_id,
                    name: it.profile?.nickname || it.student?.phone || '学员',
                    email: undefined,
                    subscription_tier: it.tier,
                    subscription_start: it.start_date,
                    subscription_end: it.end_date,
                    total_videos: 0,
                    pending_videos: 0,
                    avatar_url: it.profile?.avatar_url || undefined,
                    last_active: it.student?.last_login_at || undefined,
                    progress_score: 0,
                }));
                setStudents(mapped);
            } catch (e) {
                console.error('加载学员失败', e);
                setStudents([]);
            } finally {
                setLoadingStudents(false);
            }
        };
        
        if (coach?.id) {
            loadStudents();
        }
    }, [coach?.id]);

    // 模拟待点评视频数量
    const pendingVideosCount = 3;

    return (
        <div className="space-y-6">
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-700">总学员数</p>
                            <p className="text-2xl font-bold">{students.length}</p>
                        </div>
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Users className="w-6 h-6 text-blue-600" />
                        </div>
                    </div>
                </Card>

                <Card className="shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-700">待点评视频</p>
                            <p className="text-2xl font-bold">{pendingVideosCount}</p>
                        </div>
                        <div className="p-3 bg-yellow-100 rounded-full">
                            <Video className="w-6 h-6 text-yellow-600" />
                        </div>
                    </div>
                </Card>

                <Card className="shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-700">平均评分</p>
                            <p className="text-2xl font-bold">{coach?.rating || 0}</p>
                        </div>
                        <div className="p-3 bg-green-100 rounded-full">
                            <Star className="w-6 h-6 text-green-600" />
                        </div>
                    </div>
                </Card>

                <Card className="shadow-sm">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-surface-700">本月收入</p>
                            <p className="text-2xl font-bold">¥2,580</p>
                        </div>
                        <div className="p-3 bg-purple-100 rounded-full">
                            <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                    </div>
                </Card>
            </div>

            {/* 最近活动 */}
            <RecentActivities />
        </div>
    );
};

export default Overview;