'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ProgressSpinner } from 'primereact/progressspinner';
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
                rankingService.listEntries({ template_id: templateId })
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
            <div className="flex justify-center items-center h-screen">
                <ProgressSpinner />
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
                ownerName={leaderboard.initiator}
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