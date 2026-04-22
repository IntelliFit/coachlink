'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { friendService } from '@/app/service/friendService';
import { ActivityCard } from '@/components/social/ActivityCard';
import { ArrowLeft, Dumbbell, Clock, Trophy, Activity } from 'lucide-react';

const AERO_CONTAINER = "max-w-2xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900";

export default function FriendProfilePage() {
    const router = useRouter();
    const params = useParams();
    const userId = params?.userId as string;

    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<any>(null);
    const [records, setRecords] = useState<any[]>([]);

    useEffect(() => {
        if (userId) {
            loadData();
        }
    }, [userId]);

    const loadData = async () => {
        try {
            const res = await friendService.getFriendRecords(userId, 50);
            if (res.success) {
                setProfile(res.data.user);
                setRecords(res.data.records || []);
            }
        } finally {
            setLoading(false);
        }
    };

    // 计算统计数据
    const totalHours = Math.floor(records.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0) / 60);
    const totalVolume = records.reduce((acc, curr) => acc + (curr.totalVolume || 0), 0);

    // 骨架屏
    if (loading) {
        return (
            <div className="min-h-screen pb-20">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 to-transparent" />
                <div className="relative z-10">
                    <div className={`${AERO_CONTAINER} pt-6`}>
                        <div className="flex items-center gap-3 mb-8">
                            <Skeleton shape="circle" size="2.5rem" />
                            <Skeleton width="8rem" height="1.5rem" />
                        </div>
                        <Card className={AERO_CARD}>
                            <div className="p-6">
                                <div className="flex items-center gap-5">
                                    <Skeleton shape="circle" size="5rem" />
                                    <div className="flex-1 space-y-3">
                                        <Skeleton width="50%" height="1.5rem" />
                                        <Skeleton width="30%" height="1rem" />
                                    </div>
                                </div>
                            </div>
                        </Card>
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {[1, 2, 3].map(i => (
                                <Card key={i} className={AERO_CARD}>
                                    <div className="p-4 text-center">
                                        <Skeleton width="3rem" height="2rem" className="mx-auto mb-2" />
                                        <Skeleton width="4rem" height="0.75rem" className="mx-auto" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // 访问受限
    if (!profile) {
        return (
            <div className="min-h-screen">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-surface-200/50 to-transparent" />
                <div className="relative z-10">
                    <div className={`${AERO_CONTAINER} pt-6`}>
                        <Button 
                            icon={<ArrowLeft className="w-5 h-5" />} 
                            text 
                            rounded
                            className="!w-10 !h-10 text-surface-700 hover:bg-surface-100 active:scale-[0.98] transition-all mb-8"
                            onClick={() => router.back()} 
                        />
                        <Card className={AERO_CARD}>
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                                    <Activity className="w-8 h-8 text-surface-400" />
                                </div>
                                <div className="text-surface-900 font-bold text-lg mb-1">访问受限</div>
                                <div className="text-sm text-surface-500 mb-5">无法查看该用户的资料</div>
                                <Button 
                                    label="返回" 
                                    className="!rounded-2xl !h-10 !px-6 bg-surface-900 border-none text-surface-0 text-sm font-bold hover:bg-surface-800 active:scale-[0.98] transition-all"
                                    onClick={() => router.back()} 
                                />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-20">
            {/* 背景装饰 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 to-transparent" />

            <div className="relative z-10">
                {/* Header */}
                <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
                    <div className="flex items-center gap-3 mb-6">
                        <Button 
                            icon={<ArrowLeft className="w-5 h-5" />} 
                            text 
                            rounded
                            className="!w-10 !h-10 text-surface-700 hover:bg-surface-100 active:scale-[0.98] transition-all"
                            onClick={() => router.back()} 
                        />
                        <h1 className={AERO_TITLE}>好友主页</h1>
                    </div>
                </div>

                <div className={`${AERO_CONTAINER} space-y-4`}>
                    {/* Profile Card */}
                    <Card className={AERO_CARD}>
                        <div className="p-5">
                            <div className="flex items-center gap-5">
                                <Avatar 
                                    image={profile.avatarUrl} 
                                    label={!profile.avatarUrl ? profile.nickname?.[0]?.toUpperCase() : undefined}
                                    shape="circle" 
                                    className="!w-20 !h-20 bg-surface-100 text-surface-600 text-2xl font-bold border-4 border-surface-100 shrink-0"
                                />
                                <div className="min-w-0">
                                    <h2 className="text-2xl font-black text-surface-900 tracking-tight truncate">
                                        {profile.nickname}
                                    </h2>
                                    <p className="text-sm text-surface-500 mt-1">健身伙伴</p>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <Card className={AERO_CARD}>
                            <div className="p-4 text-center">
                                <div className="w-9 h-9 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-2">
                                    <Trophy className="w-4 h-4 text-surface-500" />
                                </div>
                                <div className="text-2xl font-black text-surface-900 tracking-tight">
                                    {records.length}
                                </div>
                                <div className="text-xs text-surface-500 font-medium mt-0.5">完成训练</div>
                            </div>
                        </Card>
                        <Card className={AERO_CARD}>
                            <div className="p-4 text-center">
                                <div className="w-9 h-9 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-2">
                                    <Clock className="w-4 h-4 text-surface-500" />
                                </div>
                                <div className="text-2xl font-black text-surface-900 tracking-tight">
                                    {totalHours}
                                </div>
                                <div className="text-xs text-surface-500 font-medium mt-0.5">累计小时</div>
                            </div>
                        </Card>
                        <Card className={AERO_CARD}>
                            <div className="p-4 text-center">
                                <div className="w-9 h-9 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-2">
                                    <Dumbbell className="w-4 h-4 text-surface-500" />
                                </div>
                                <div className="text-2xl font-black text-surface-900 tracking-tight">
                                    {totalVolume > 1000 ? `${(totalVolume / 1000).toFixed(0)}t` : `${totalVolume}kg`}
                                </div>
                                <div className="text-xs text-surface-500 font-medium mt-0.5">总容量</div>
                            </div>
                        </Card>
                    </div>

                    {/* Activity List */}
                    <Card className={AERO_CARD}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                <span className="text-xs font-bold tracking-widest text-surface-500 uppercase">最近训练</span>
                            </div>

                            {records.length > 0 ? (
                                <div className="space-y-3">
                                    {records.map(record => (
                                        <ActivityCard 
                                            key={record.executionId} 
                                            activity={{
                                                id: record.executionId,
                                                user: profile,
                                                execution: record
                                            }} 
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="py-8 text-center">
                                    <div className="w-12 h-12 rounded-2xl bg-surface-100 flex items-center justify-center mx-auto mb-3">
                                        <Dumbbell className="w-6 h-6 text-surface-400" />
                                    </div>
                                    <div className="text-sm text-surface-500">暂无训练记录</div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
