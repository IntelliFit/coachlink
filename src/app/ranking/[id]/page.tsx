'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Skeleton } from 'primereact/skeleton';
import { rankingService } from '@/app/service/rankingService';
import { LeaderboardFormInput } from '@/types/leaderboard';

import ActivityInfo from './ActivityInfo';
import ActivityNotice from './ActivityNotice';
import RankingsTable from './RankingsTable';
import LeaderboardHeader from './LeaderboardHeader';
import SubmissionDialog from './SubmissionDialog';
import { GetLeaderboardResponseDto } from '@/app/api/ranking/get-leaderboard/entity';

export default function RankingPage() {
    const params = useParams();
    const templateId = params.id as string;

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

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full pt-10 border-t border-white/20">
                            {[1, 2, 3].map((item) => (
                                <div key={item} className="flex items-center space-x-5 rounded-2xl bg-white/10 backdrop-blur-md p-6 border border-white/10">
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
                    <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
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

                    <div className="relative overflow-hidden bg-white border border-slate-100 rounded-[2rem] p-6 md:p-8 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
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
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
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
                <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-100 shadow-[0_15px_40px_rgba(0,0,0,0.03)]">
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
            <div className="flex justify-center items-center h-64 text-gray-500">
                <p>排行榜不存在或已被删除</p>
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
                />
            </div>

            <ActivityNotice
                notice={leaderboard.remarks}
            />

            {/* 提交弹窗 */}
            <SubmissionDialog
                visible={showDialog}
                onHide={() => setShowDialog(false)}
                templateId={templateId}
                formSchema={leaderboard.form_schema as LeaderboardFormInput[]}
                onSuccess={() => {
                    setShowDialog(false);
                    loadData(); // 提交成功后自动刷新数据
                }}
            />
        </div>
    );
}