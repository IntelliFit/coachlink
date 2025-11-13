'use client';

import React, { useState, useEffect } from 'react';
import { Toast } from 'primereact/toast';
import { useSession } from 'next-auth/react';
import { rankingService } from '@/app/service/rankingService';
import { useParams } from 'next/navigation';
import { Card } from 'primereact/card';

import LeaderboardHeader from './LeaderboardHeader';
import ActivityInfo from './ActivityInfo';
import RankingsTable from './RankingsTable';
import ActivityNotice from './ActivityNotice';
import SubmissionDialog from './SubmissionDialog';

export default function PullupLeaderboardPage() {
    const params = useParams();
    const action = params.action || '';
    
    // 如果action不是pullup，显示敬请期待信息
    if (action !== 'pullup') {
        return (
            <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 p-4 sm:p-6 md:p-10">
                <div className="max-w-6xl mx-auto flex flex-col gap-10">
                    <Card className="text-center p-8">
                        <h1 className="text-2xl font-bold mb-4">活动尚未开始</h1>
                        <p className="text-lg">敬请期待更多精彩的活动内容！</p>
                    </Card>
                </div>
            </div>
        );
    }
    
    const { data: session } = useSession();
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showSubmissionDialog, setShowSubmissionDialog] = useState(false);
    const [formData, setFormData] = useState({
        name: session?.profile.nickname || '',
        gender: session?.profile.gender || '',
        weight_kg: 0,
        video_url: '',
        notes: '',
    });
    const toast = React.useRef<Toast>(null);

    useEffect(() => {
        loadLeaderboard();
    }, []);

    async function loadLeaderboard() {
        try {
            setLoading(true);
            const res = await rankingService.getLeaderboard({ leaderboardType: 'pullup' });
            if (res) setRecords(res.records || []);
        } catch {
            toast.current?.show({
                severity: 'error',
                summary: '加载失败',
                detail: '请稍后重试',
            });
        } finally {
            setLoading(false);
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await rankingService.submitRecord('pullup', {});
            if (res) {
                toast.current?.show({
                    severity: 'success',
                    summary: '提交成功',
                    life: 3000,
                });
                setShowSubmissionDialog(false);
                loadLeaderboard();
            }
        } catch {
            toast.current?.show({
                severity: 'error',
                summary: '提交失败',
                detail: '请检查表单或稍后重试',
            });
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 text-gray-900 dark:text-gray-100 p-4 sm:p-6 md:p-10">
            <Toast ref={toast} />

            <div className="max-w-6xl mx-auto flex flex-col gap-10">
                {/* 标题区域 */}
                <LeaderboardHeader 
                    recordCount={records.length}
                    onShowSubmissionDialog={() => setShowSubmissionDialog(true)}
                    onRefreshLeaderboard={loadLeaderboard}
                />

                {/* 活动介绍 & 评判标准 */}
                <ActivityInfo />

                {/* 排行榜 */}
                <RankingsTable records={records} loading={loading} />

                {/* 活动说明 */}
                <ActivityNotice />

                {/* 提交弹窗 */}
                <SubmissionDialog
                    visible={showSubmissionDialog}
                    onHide={() => setShowSubmissionDialog(false)}
                    formData={formData}
                    setFormData={setFormData}
                    onSubmit={handleSubmit}
                />
            </div>
        </div>
    );
}