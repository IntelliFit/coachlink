'use client';

import React, { useState, useEffect } from 'react';
import { Users, Video, Star, TrendingUp } from 'lucide-react';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { coachService } from '@/app/service/coachService';
import { CoachStudentItem, Student } from '@/types/coach';
import DashboardCard from './DashboardCard';
import CoachProgress from './CoachProgress';

const Overview = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    // 模拟待点评视频数量
    const [pendingVideosCount, setPendingVideosCount] = useState<number>(0);
    const [loadingVideos, setLoadingVideos] = useState<boolean>(true);
    const [coachRating, setCoachRating] = useState<number>(0);
    const [loadingRating, setLoadingRating] = useState<boolean>(true);
    const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
    const [loadingRevenue, setLoadingRevenue] = useState<boolean>(true);
    const [totalStudentCount, setTotalStudentCount] = useState<number>(0);
    const [loadingStudentsCount, setLoadingStudentsCount] = useState<boolean>(true);

    useEffect(() => {
        const loadOverviewData = async () => {
            if (coach?.id) {
                try {
                    const overviewData = await coachService.getOverviewData({ coachId: coach.id });
                    
                    if (overviewData) {
                        setPendingVideosCount(overviewData.pendingReviewCount);
                        setCoachRating(overviewData.averageRating);
                        setMonthlyRevenue(overviewData.monthlyRevenue);
                        setTotalStudentCount(overviewData.totalStudentCount);
                    }
                } catch (error) {
                    console.error('加载概览数据失败:', error);
                } finally {
                    setLoadingVideos(false);
                    setLoadingRating(false);
                    setLoadingRevenue(false);
                    setLoadingStudentsCount(false);
                }
            }
        };

        loadOverviewData();
    }, [coach?.id]);

    return (
        <div className="space-y-6">
            <CoachProgress />
            
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard 
                    title="总学员数"
                    value={totalStudentCount}
                    icon={<Users className="w-6 h-6 text-blue-600" />}
                    iconBg="bg-blue-100"
                    iconColor="text-blue-600"
                    loading={loadingStudentsCount}
                    href="/dashboard/students"
                />
                
                <DashboardCard 
                    title="待点评视频"
                    value={pendingVideosCount}
                    icon={<Video className="w-6 h-6 text-yellow-600" />}
                    iconBg="bg-yellow-100"
                    iconColor="text-yellow-600"
                    loading={loadingVideos}
                    href="/dashboard/videos"
                />
                
                <DashboardCard 
                    title="平均评分"
                    value={coachRating}
                    icon={<Star className="w-6 h-6 text-green-600" />}
                    iconBg="bg-green-100"
                    iconColor="text-green-600"
                    loading={loadingRating}
                />
                
                <DashboardCard 
                    title="本月收入"
                    value={`¥${monthlyRevenue}`}
                    icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
                    iconBg="bg-purple-100"
                    iconColor="text-purple-600"
                    loading={loadingRevenue}
                />
            </div>
        </div>
    );
};

export default Overview;