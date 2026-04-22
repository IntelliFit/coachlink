'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { Skeleton } from 'primereact/skeleton';
import { useToastContext } from '@/context/ToastContext';
import CreateLeaderboardForm from './CreateLeaderboardForm';
import LeaderboardCard from './LeaderboardCard';
import { rankingService } from '@/app/service/rankingService';
import { ListLeaderboardItem } from '@/app/api/ranking/list-leaderboard/entity';

export default function AdminRankingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [rankings, setRankings] = useState<ListLeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // 统一权限检查
    useEffect(() => {
        if (status === 'unauthenticated' || (status === 'authenticated' && !session?.user?.is_admin)) {
            router.push('/');
        }
    }, [status, session, router]);

    // 统一数据加载
    useEffect(() => {
        if (session?.user?.is_admin) {
            loadRankings();
        }
    }, [refreshTrigger, session?.user?.is_admin]);

    const loadRankings = async () => {
        try {
            setLoading(true);
            const result = await rankingService.listLeaderboard({ countStatus: 'pending' });
            if (result) {
                const boards = result.leaderboards || [];
                boards.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                setRankings(boards);
            }
        } catch (error) {
            console.error('加载排行榜失败:', error);
            showToast({
                severity: 'error',
                summary: '加载失败',
                detail: '无法加载排行榜数据'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateSuccess = () => {
        setShowCreateDialog(false);
        setRefreshTrigger(prev => prev + 1);
    };

    // 骨架屏加载状态 (一行一个)
    const renderSkeleton = () => (
        <div className="flex flex-col gap-4">
            {[...Array(3)].map((_, idx) => (
                <div
                    key={idx}
                    className="bg-surface rounded-[24px] border border-surface-100 p-5 shadow-none flex flex-col"
                >
                    {/* Header: 模拟标题与状态 */}
                    <div className="flex justify-between items-start mb-4">
                        <Skeleton width="45%" height="1.5rem" borderRadius="12px" />
                        <Skeleton width="60px" height="1.2rem" borderRadius="20px" />
                    </div>

                    {/* Description: 模拟多行文本 */}
                    <div className="space-y-2 mb-6">
                        <Skeleton width="90%" height="0.8rem" borderRadius="6px" />
                        <Skeleton width="65%" height="0.8rem" borderRadius="6px" />
                    </div>

                    {/* Meta Info: 模拟 2x2 磁贴属性 */}
                    <div className="grid grid-cols-2 gap-2 mb-6">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-2.5 bg-surface-50/50 rounded-xl border border-surface-100/30">
                                <Skeleton width="40%" height="0.6rem" className="mb-2" borderRadius="4px" />
                                <Skeleton width="70%" height="0.9rem" borderRadius="4px" />
                            </div>
                        ))}
                    </div>

                    {/* Footer: 模拟底部操作栏 */}
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-surface-50">
                        <Skeleton shape="circle" size="2rem" /> {/* 模拟删除按钮 */}
                        <div className="flex gap-2">
                            <Skeleton width="4rem" height="2rem" borderRadius="12px" />
                            <Skeleton width="4rem" height="2rem" borderRadius="12px" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    // 避免渲染时的闪烁
    if (status === 'loading' || (status === 'authenticated' && !session?.user?.is_admin)) {
        return null;
    }

    return (
        <div className="min-h-screen py-10 px-4">
            <div className="max-w-5xl mx-auto">
                {/* 顶部标题栏 */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-surface-900 tracking-tight">排行榜管理</h1>
                        <p className="text-surface-500 mt-1">管理和配置当前系统的所有排行榜规则</p>
                    </div>
                    <Button
                        label="创建新排行榜"
                        icon="pi pi-plus"
                        className="py-4 bg-primary-500 border-none rounded-2xl shadow-xl shadow-primary-500/20 hover:bg-primary-600 transition-all transform active:scale-[0.98] p-button p-component"
                        onClick={() => setShowCreateDialog(true)}
                    />
                </div>

                {/* 主体列表区域 */}
                {loading && rankings.length === 0 ? (
                    renderSkeleton()
                ) : rankings.length > 0 ? (
                    <div className="flex flex-col gap-5">
                        {rankings.map((ranking) => (
                            <div key={ranking.id} className="w-full">
                                <LeaderboardCard
                                    ranking={ranking}
                                    onRefresh={() => setRefreshTrigger(prev => prev + 1)}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-surface border border-dashed border-surface-300 rounded-xl">
                        <i className="pi pi-inbox text-5xl text-surface-300 mb-4"></i>
                        <p className="text-surface-500 text-lg">暂无数据，点击上方按钮创建</p>
                    </div>
                )}
            </div>

            <CreateLeaderboardForm
                visible={showCreateDialog}
                onHide={() => setShowCreateDialog(false)}
                onSuccess={handleCreateSuccess}
            />

            <ConfirmDialog />
        </div>
    );
}