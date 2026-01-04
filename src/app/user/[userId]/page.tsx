'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { ProgressSpinner } from 'primereact/progressspinner';
import { friendService } from '@/app/service/friendService';
import { ActivityCard } from '@/components/social/ActivityCard';
import { ArrowLeft, Calendar } from 'lucide-react';

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
            const res = await friendService.getFriendRecords(userId, 50); // Get last 50 for now
            if (res.success) {
                setProfile(res.data.user);
                setRecords(res.data.records || []);
            } else {
                // If permission denied or not friends, redirect or show error
                if (res.message === '你们还不是好友') {
                    // TODO: Show non-friend profile view (Add Friend button)
                    // For now, MVP assumes you click from friends list
                }
            }
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-surface-50">
            <ProgressSpinner style={{width: '30px'}}/>
        </div>;
    }

    if (!profile) {
        return <div className="min-h-screen bg-surface-50 p-4 text-center pt-20">
            <h2 className="text-xl font-bold mb-2">访问受限</h2>
            <p className="text-surface-500 mb-4">无法查看该用户的资料</p>
            <Button label="返回" onClick={() => router.back()} />
        </div>;
    }

    return (
        <div className="min-h-screen bg-surface-50 pb-20">
             {/* Header */}
             <div className="bg-white sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center gap-3">
                <Button 
                    icon={<ArrowLeft className="w-5 h-5" />} 
                    text 
                    rounded 
                    onClick={() => router.back()} 
                />
                <h1 className="text-lg font-bold">好友资料</h1>
            </div>

            {/* Profile Info */}
            <div className="bg-white p-6 mb-4 flex flex-col items-center border-b border-surface-100">
                <Avatar 
                    image={profile.avatarUrl} 
                    label={!profile.avatarUrl ? profile.nickname?.[0]?.toUpperCase() : undefined}
                    shape="circle" 
                    size="xlarge"
                    className="bg-primary-100 text-primary-600 w-24 h-24 text-3xl mb-4 shadow-lg"
                />
                <h2 className="text-2xl font-bold text-surface-900 mb-1">{profile.nickname}</h2>
                <p className="text-sm text-surface-500 flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>健身伙伴</span>
                </p>
            </div>

            {/* Stats Summary (MVP) */}
            <div className="grid grid-cols-2 gap-4 px-4 mb-6">
                <div className="bg-white p-4 rounded-xl text-center shadow-sm">
                    <div className="text-2xl font-bold text-primary-600">{records.length}</div>
                    <div className="text-xs text-surface-500">完成训练</div>
                </div>
                <div className="bg-white p-4 rounded-xl text-center shadow-sm">
                    <div className="text-2xl font-bold text-orange-500">
                        {Math.floor(records.reduce((acc, curr) => acc + curr.durationMinutes, 0) / 60)}
                    </div>
                    <div className="text-xs text-surface-500">累计小时</div>
                </div>
            </div>

            {/* Activity List */}
            <div className="px-4">
                <h3 className="font-bold text-surface-900 mb-3 px-1">最近训练</h3>
                {records.length > 0 ? (
                    records.map(record => (
                        <ActivityCard 
                            key={record.executionId} 
                            activity={{
                                id: record.executionId,
                                user: profile,
                                execution: record
                            }} 
                        />
                    ))
                ) : (
                    <div className="text-center py-8 text-surface-400">
                        暂无训练记录
                    </div>
                )}
            </div>
        </div>
    );
}
