'use client';

import React, { useEffect, useState } from 'react';
import { Button } from 'primereact/button';
import { ProgressBar } from 'primereact/progressbar';
import { Tag } from 'primereact/tag';
import { studentMembershipService, StudentMembership, StudentQuota } from '@/app/service/studentMembershipService';
import { useRouter } from 'next/navigation';
import { Crown, Share2, Database, Sparkles } from 'lucide-react';

export default function MembershipDashboard() {
    const router = useRouter();
    const [membership, setMembership] = useState<StudentMembership | null>(null);
    const [quota, setQuota] = useState<StudentQuota | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [memData, quotaData] = await Promise.all([
                    studentMembershipService.getMembership(),
                    studentMembershipService.getQuota()
                ]);
                setMembership(memData);
                setQuota(quotaData);
            } catch (err) {
                console.error("Failed to fetch membership data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <div className="flex justify-center items-center h-96"><i className="pi pi-spin pi-spinner text-4xl text-primary-500"></i></div>;
    }

    const isFree = membership?.tier === 'free';
    const tierName = {
        'free': '免费用户',
        'basic': '基础会员',
        'premium': '高级会员',
        'trial': '试用会员'
    }[membership?.tier || 'free'];

    const getTierSeverity = (tier: string) => {
        switch (tier) {
            case 'premium': return 'warning'; // Gold/Orange
            case 'basic': return 'info';    // Blue
            case 'trial': return 'danger';  // Red/Orange
            default: return 'secondary';  // Gray
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-4xl space-y-6">
            <h1 className="text-2xl font-bold text-surface-900">我的会员</h1>

            {/* Current Status Card */}
            <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-row items-center justify-between pb-4">
                    <div className="space-y-1">
                        <h3 className="text-xl font-semibold text-surface-900">当前等级</h3>
                        <p className="text-sm text-surface-500">您的会员权益状态</p>
                    </div>
                    <Crown className={membership?.tier === 'premium' ? "text-purple-500 w-8 h-8" : "text-slate-400 w-8 h-8"} />
                </div>
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <Tag value={tierName} severity={getTierSeverity(membership?.tier || 'free')} className="text-base px-3 py-1" rounded></Tag>
                        {membership?.status === 'active' && membership.end_date && (
                            <span className="text-sm text-surface-500">
                                有效期至：{new Date(membership.end_date).toLocaleDateString()}
                            </span>
                        )}
                    </div>

                    {isFree ? (
                        <div className="bg-surface-50 p-4 rounded-lg border border-surface-200">
                            <p className="text-sm text-surface-600 mb-3">升级会员解锁更多智能生成次数和存储空间，提升训练效率！</p>
                            <Button label="立即升级" onClick={() => router.push('/me/membership/subscribe')} className="w-full sm:w-auto" severity="help" />
                        </div>
                    ) : (
                        <div className="flex gap-2">
                             <Button label="续费/升级" outlined onClick={() => router.push('/me/membership/subscribe')} severity="secondary" />
                        </div>
                    )}
                </div>
            </div>

            {/* Quota Usage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                    <div className="flex flex-row items-center justify-between pb-4">
                        <h3 className="text-base font-medium text-surface-900">智能导入次数</h3>
                        <Sparkles className="h-4 w-4 text-surface-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-surface-900">{quota?.ai_import_balance || 0} <span className="text-sm font-normal text-surface-500">次</span></div>
                        <p className="text-xs text-surface-500 mt-1">
                            {membership?.tier === 'premium' ? '高级会员无限量使用' : '用于生成个性化训练计划'}
                        </p>
                        {membership?.tier !== 'premium' && (
                             <Button label="购买加油包" link className="p-0 h-auto text-xs mt-2" onClick={() => router.push('/me/membership/subscribe?tab=addon')} />
                        )}
                    </div>
                </div>

                <div className="bg-surface-0 border border-surface-200 rounded-xl p-6 shadow-sm">
                    <div className="flex flex-row items-center justify-between pb-4">
                        <h3 className="text-base font-medium text-surface-900">云存储空间</h3>
                        <Database className="h-4 w-4 text-surface-500" />
                    </div>
                    <div>
                        <div className="text-2xl font-bold text-surface-900">
                            {(quota?.storage_used_mb || 0).toFixed(1)} / {quota?.storage_total_mb || 0}
                            <span className="text-sm font-normal text-surface-500"> MB</span>
                        </div>
                        <ProgressBar
                            value={quota?.storage_total_mb ? ((quota.storage_used_mb / quota.storage_total_mb) * 100) : 0}
                            className="mt-2 h-2"
                            showValue={false}
                        />
                        <p className="text-xs text-surface-500 mt-2">
                            用于存储训练视频和动态
                        </p>
                         <Button label="扩容空间" link className="p-0 h-auto text-xs mt-1" onClick={() => router.push('/me/membership/subscribe?tab=addon')} />
                    </div>
                </div>
            </div>

            {/* Referral Banner */}
            <div className="bg-gradient-to-r from-orange-100 to-amber-50 border border-orange-200 rounded-xl p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-lg text-orange-900">邀请好友，免费领会员</h3>
                        <p className="text-sm text-orange-800">每邀请一位好友注册，双方各获 AI 导入 +2 次 & 存储 +200MB 奖励！</p>
                    </div>
                    <Button label="去邀请" icon={<Share2 className="w-4 h-4 mr-2" />} className="bg-white text-orange-600 hover:bg-orange-50 border-orange-200" onClick={() => router.push('/me/membership/referral')} severity="warning" outlined />
                </div>
            </div>
        </div>
    );
}
