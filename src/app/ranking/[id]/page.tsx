'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from 'primereact/skeleton';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardFormInput } from '@/types/leaderboard';

import ActivityInfo from './ActivityInfo';
import ActivityNotice from './ActivityNotice';
import RankingsTable from './RankingsTable';
import LeaderboardHeader from './LeaderboardHeader';
import SubmissionDialog from './SubmissionDialog';
import { GetLeaderboardResponseDto } from '@/app/api/ranking/get-leaderboard/entity';
import { Button } from 'primereact/button';
import { Trophy, XCircle } from 'lucide-react';

export default function RankingPage() {
    const params = useParams();
    const templateId = params.id as string;
    const router = useRouter();

    // 状态管理
    const [leaderboard, setLeaderboard] = useState<GetLeaderboardResponseDto['leaderboard']>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showDialog, setShowDialog] = useState(false);

    // 封装刷新逻辑，以便传递给 Header 和 Dialog 成功后调用
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [lbData, entriesData] = await Promise.all([
                rankingService.getLeaderboard({ id: templateId }),
                rankingService.listEntries({
                    template_id: templateId,
                    status: 'approved',
                    limit: 100,
                    sort_by: 'score'
                })
            ]);

            console.log(lbData.leaderboard);

            setLeaderboard(lbData.leaderboard);
            setEntries(entriesData?.entries || []);
            setTotal(entriesData?.total || 0)
        } catch (error) {
            console.error('加载排行榜失败:', error);
        } finally {
            setLoading(false);
        }
    }, [templateId]);

    useEffect(() => {
        if (templateId) {
            loadData();
        }
    }, [loadData]);

    if (loading) {
        return (
            <div className="max-w-7xl mx-auto p-4 space-y-8">
                {/* Header Skeleton */}
                <div className="relative w-full max-w-6xl mx-auto mb-10 group px-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-primary-500 to-primary-700 rounded-[2.5rem] shadow-[0_30px_60px_-15px_rgba(var(--primary-rgb),0.3)]" />
                    <div className="relative z-10 p-8 md:p-14 lg:p-16 flex flex-col items-center">
                        <div className="flex flex-col md:flex-row items-center justify-between w-full gap-8 mb-16">
                            <div className="flex flex-col items-center md:items-start text-center md:text-left space-y-5 flex-1">
                                <Skeleton width="120px" height="24px" borderRadius="12px" className="mb-4" />
                                <Skeleton width="100%" height="60px" borderRadius="0" className="mb-2" />
                                <Skeleton width="80%" height="24px" borderRadius="0" />
                            </div>
                            <Skeleton width="160px" height="60px" borderRadius="1rem" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-10 border-t border-surface/20">
                            {[1, 2, 3].map((item) => (
                                <div key={item} className="flex items-center space-x-5 rounded-2xl bg-surface/10 backdrop-blur-md p-6 border border-surface/10">
                                    <Skeleton shape="circle" size="48px" />
                                    <div className="text-left flex-1 min-w-0">
                                        <Skeleton width="80px" height="12px" borderRadius="0" className="mb-2" />
                                        <Skeleton width="120px" height="20px" borderRadius="0" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Activity Info Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="relative overflow-hidden bg-surface border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                        <div className="absolute top-0 left-10 right-10 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                        <div className="flex items-center gap-3 mb-5">
                            <Skeleton shape="circle" size="40px" />
                            <Skeleton width="120px" height="24px" borderRadius="0" />
                        </div>
                        <div className="relative pl-5">
                            <Skeleton width="100%" height="20px" className="mb-2" />
                            <Skeleton width="90%" height="20px" className="mb-2" />
                            <Skeleton width="80%" height="20px" />
                        </div>
                    </div>

                    <div className="relative overflow-hidden bg-surface border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                        <div className="absolute top-0 left-10 right-10 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                        <div className="flex items-center gap-3 mb-5">
                            <Skeleton shape="circle" size="40px" />
                            <Skeleton width="120px" height="24px" borderRadius="0" />
                        </div>
                        <div className="flex flex-col gap-2">
                            {[1, 2, 3, 4].map((item) => (
                                <div key={item} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 border border-transparent">
                                    <Skeleton shape="circle" size="16px" />
                                    <Skeleton width="100%" height="16px" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Rankings Table Skeleton */}
                <div className="bg-surface dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                    <div className="p-6 border-b border-gray-50 dark:border-gray-700 flex justify-between items-center">
                        <Skeleton width="120px" height="24px" borderRadius="0" />
                        <Skeleton width="100px" height="16px" borderRadius="0" />
                    </div>

                    <div className="p-4">
                        {[1, 2, 3, 4, 5].map((row) => (
                            <div key={row} className="flex items-center p-3 border-b border-gray-100 dark:border-gray-700">
                                <Skeleton shape="circle" size="32px" className="mr-4" />
                                <Skeleton width="80px" height="20px" className="mr-4" />
                                <Skeleton width="120px" height="20px" className="mr-4" />
                                <Skeleton width="60px" height="20px" className="mr-4" />
                                <Skeleton width="80px" height="20px" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Activity Notice Skeleton */}
                <div className="relative overflow-hidden rounded-[2rem] bg-surface border border-slate-100 dark:border-slate-500 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
                    <div className="absolute left-0 top-0 bottom-0 w-1 flex flex-col items-center justify-center py-8 z-20">
                        <div className="w-full h-full bg-gradient-to-b from-transparent via-primary/40 to-transparent rounded-full" />
                    </div>
                    <div className="relative z-10 p-7 md:p-9 flex items-start gap-6 ml-1">
                        <div className="flex-shrink-0">
                            <Skeleton shape="circle" size="48px" />
                        </div>
                        <div className="flex-grow">
                            <div className="flex items-center gap-2 mb-3">
                                <Skeleton width="120px" height="24px" borderRadius="0" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton width="100%" height="16px" className="mb-2" />
                                <Skeleton width="90%" height="16px" className="mb-2" />
                                <Skeleton width="80%" height="16px" />
                            </div>
                            <div className="flex flex-wrap gap-6 mt-8 pt-6 border-t border-slate-50">
                                <Skeleton width="120px" height="16px" />
                                <Skeleton width="120px" height="16px" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (!leaderboard) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
                <div className="relative w-full max-w-md">
                    {/* 背景装饰：延续 Header 的渐变光晕 */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />

                    {/* 图标容器 */}
                    <div className="relative z-10 mb-8 flex justify-center">
                        <div className="w-24 h-24 rounded-[2rem] bg-surface dark:bg-gray-800 shadow-2xl border border-slate-100 dark:border-gray-700 flex items-center justify-center rotate-3 group-hover:rotate-0 transition-transform duration-500">
                            <div className="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-gray-900 flex items-center justify-center">
                                <Trophy className="w-8 h-8 text-slate-300" />
                            </div>
                            {/* 警告小图标 */}
                            <div className="absolute -bottom-2 -right-2 w-10 h-10 rounded-full bg-rose-500 text-surface flex items-center justify-center shadow-lg border-4 border-surface dark:border-gray-900">
                                <XCircle className="w-5 h-5" />
                            </div>
                        </div>
                    </div>

                    {/* 文字内容 */}
                    <div className="relative z-10 space-y-4">
                        <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tighter uppercase italic">
                            Leaderboard Not Found
                        </h2>
                        <p className="text-slate-400 dark:text-slate-500 font-medium max-w-[280px] mx-auto leading-relaxed">
                            该排行榜不存在，或者已被发起人移动至其他星系。
                        </p>
                    </div>

                    {/* 行动按钮 */}
                    <div className="relative z-10 mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button
                            label="返回"
                            icon="pi pi-home"
                            className="p-button-rounded p-button-secondary p-button-outlined font-bold px-8 py-3"
                            onClick={() => router.push('/ranking')}
                        />
                        <Button
                            label="重新加载"
                            icon="pi pi-refresh"
                            className="p-button-rounded font-black px-8 py-3 bg-primary border-none shadow-lg shadow-primary/20"
                            onClick={() => router.refresh()}
                        />
                    </div>
                </div>

                {/* 底部点缀：细微的网格感 */}
                <div className="mt-20 opacity-20">
                    <div className="flex gap-2">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="w-1 h-1 bg-slate-400 rounded-full" />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto p-4 space-y-8">
            {/* 顶部 Header：传入数据和刷新回调 */}
            <LeaderboardHeader
                title={leaderboard.title}
                description={'月度排行榜挑战赛'}
                recordCount={total}
                ownerName={leaderboard.initiator || '教链'}
                startAt={leaderboard.start_at}
                endAt={leaderboard.end_at}
                templateId={templateId}
                formSchema={leaderboard.form_schema as LeaderboardFormInput[]}
                needReview={leaderboard.needReview}
                onJoinClick={() => setShowDialog(true)}
            />

            <div className="">
                <ActivityInfo
                    description={leaderboard.description}
                    rules={leaderboard.rules}
                />

            </div>

            <div className="lg:col-span-8">
                <RankingsTable
                    entries={entries}
                    formSchema={leaderboard.form_schema as LeaderboardFormInput[]}
                    rankByField={leaderboard.rank_by_field}
                />
            </div>

            <ActivityNotice
                notice={leaderboard.remarks}
            />

            {leaderboard && (
                <SubmissionDialog
                    visible={showDialog}
                    onHide={() => setShowDialog(false)}
                    templateId={templateId}
                    formSchema={leaderboard.form_schema as LeaderboardFormInput[]}
                    needReview={leaderboard.needReview}
                    rankByField={leaderboard.rank_by_field}
                    onSuccess={() => {
                        setShowDialog(false);
                        loadData();
                    }}
                />
            )}
        </div>
    );
}