'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';
import Tilt from 'react-parallax-tilt';
import { useToastContext } from '@/context/ToastContext';

interface InvitationPosterCardProps {
    coach: GetCoachResponseDto | null;
}

export const InvitationPosterCard: React.FC<InvitationPosterCardProps> = ({
    coach,
}) => {
    const themeColor = '#F28631';
    const { showToast } = useToastContext();

    type PosterStatus = 'queued' | 'generating' | 'ready' | 'failed';
    const [status, setStatus] = useState<PosterStatus>('queued');
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [polling, setPolling] = useState(true);
    const [forcePolling, setForcePolling] = useState(false);
    const [refreshBaseUpdatedAt, setRefreshBaseUpdatedAt] = useState<string | null>(null);

    const pollOnce = useCallback(async () => {
        if (!coach?.coach?.id) return;
        try {
            const res = await fetch(`/api/coach/poster/status?posterType=invitation_hd`, {
                method: 'GET',
                cache: 'no-store',
            });
            const json = await res.json();
            if (!json?.success || !json?.data) return;
            setStatus(json.data.status);
            const nextImageUrl = json.data.imageUrl || null;
            const nextUpdatedAt = json.data.updatedAt || null;
            setImageUrl(nextImageUrl);
            setUpdatedAt(nextUpdatedAt);
            setLastError(json.data.lastError || null);

            // 需求：一旦已经拿到图片（imageUrl），就停止轮询
            // 但如果是手动触发“更新海报”，则继续轮询直到新一轮 ready（updatedAt 有变化）
            if (nextImageUrl) {
                if (!forcePolling) {
                    setPolling(false);
                } else if (json.data.status === 'ready') {
                    if (refreshBaseUpdatedAt && nextUpdatedAt && nextUpdatedAt !== refreshBaseUpdatedAt) {
                        setForcePolling(false);
                        setPolling(false);
                        setRefreshBaseUpdatedAt(null);
                    }
                }
            }
        } catch (e) {
            // 轮询不打扰用户，只在“手动触发”时提示
            console.error('[poster] poll error:', e);
        }
    }, [coach?.coach?.id, forcePolling, refreshBaseUpdatedAt]);

    useEffect(() => {
        if (!coach?.coach?.id) return;
        if (!polling) return;
        let timer: any = null;
        // 首次立即拉取
        void pollOnce();
        timer = setInterval(() => void pollOnce(), 1000);
        return () => {
            if (timer) clearInterval(timer);
        };
    }, [coach?.coach?.id, pollOnce, polling]);

    const displayUrl = useMemo(() => {
        if (!imageUrl) return null;
        const v = updatedAt ? encodeURIComponent(updatedAt) : String(Date.now());
        return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}v=${v}`;
    }, [imageUrl, updatedAt]);

    const badgeText = useMemo(() => {
        if (status === 'ready') return '高清海报已就绪';
        if (status === 'failed') return '生成失败';
        if (status === 'generating') return '生成中...';
        return '排队中...';
    }, [status]);

    // 下载逻辑：直接使用现成的 URL
    const handleDownload = () => {
        if (!displayUrl) {
            showToast({ severity: 'warn', summary: '请稍候', detail: '海报尚未就绪' });
            return;
        }

        const link = document.createElement('a');
        link.href = displayUrl;
        link.download = `CoachLink_${coach?.coach?.name || 'Poster'}_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast({ severity: 'success', summary: '保存成功', detail: '海报已开始下载' });
    };

    const handleRefresh = useCallback(async () => {
        if (!coach?.coach?.id) return;
        setRefreshing(true);
        // 手动触发更新：强制开启轮询直到新一轮生成完成
        setForcePolling(true);
        setPolling(true);
        setRefreshBaseUpdatedAt(updatedAt);
        setLastError(null);
        try {
            const res = await fetch('/api/coach/poster/trigger', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ posterType: 'invitation_hd' }),
            });
            const json = await res.json();
            if (!json?.success) {
                showToast({ severity: 'error', summary: '更新失败', detail: json?.message || '请稍后再试' });
                return;
            }
            // 触发后立刻拉一次，避免等待 1s
            await pollOnce();
        } catch (e) {
            console.error('[poster] trigger error:', e);
            showToast({ severity: 'error', summary: '更新失败', detail: '网络异常' });
        } finally {
            setRefreshing(false);
        }
    }, [coach?.coach?.id, pollOnce, showToast, updatedAt]);

    return (
        <div className="bg-surface rounded-[24px] border border-surface-100 p-8 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex flex-col lg:flex-row gap-10 items-center">
                
                {/* 左侧：海报展示区 */}
                <div className="relative group">
                    <Tilt
                        tiltMaxAngleX={8}
                        tiltMaxAngleY={8}
                        perspective={1000}
                        glareEnable={true}
                        glareMaxOpacity={0.25}
                        glareColor="#ffffff"
                        glarePosition="all"
                        scale={1.02}
                        transitionSpeed={1500}
                    >
                        <div
                            className="shadow-2xl"
                        >
                            {!displayUrl ? (
                                // 骨架屏：模拟海报比例和大致结构
                                <div className="p-8 h-full w-[320px] flex flex-col space-y-6">
                                    <div className="flex justify-between">
                                        <Skeleton width="60%" height="20px" />
                                        <Skeleton width="40px" height="30px" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <Skeleton shape="circle" size="5rem" className="mb-4" />
                                        <Skeleton width="80%" height="40px" className="mb-2" />
                                        <Skeleton width="40%" height="20px" />
                                    </div>
                                    <Skeleton width="100%" height="80px" borderRadius="16px" />
                                </div>
                            ) : (
                                // 渲染请求回来的真实海报图片
                                <img
                                    src={displayUrl}
                                    alt="Coach Poster"
                                    className="w-[320px] animate-in fade-in duration-500"
                                />
                            )}
                        </div>
                    </Tilt>
                </div>

                {/* 右侧：状态 + 操作 */}
                <div className="flex-1 w-full space-y-5">
                    <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div className="text-lg font-black text-surface-900 tracking-tight">
                                邀请高清海报
                            </div>
                            <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full border border-orange-100">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: themeColor }} />
                                <span className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: themeColor }}>
                                    {badgeText}
                                </span>
                            </div>
                            {status === 'failed' && lastError && (
                                <div className="mt-2 text-xs font-bold text-red-600/90 break-words">
                                    {lastError}
                                </div>
                            )}
                        </div>

                        <Button
                            icon={refreshing ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                            rounded
                            text
                            aria-label="更新海报"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="shrink-0"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <Button
                            label="更新海报"
                            icon={refreshing ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                            className="w-full p-4 rounded-xl font-black tracking-tight active:scale-[0.98] transition-all"
                            onClick={handleRefresh}
                            disabled={refreshing}
                            outlined
                        />
                        <Button
                            label={status === 'ready' ? '保存高清海报' : '等待生成...'}
                            icon={status === 'ready' ? 'pi pi-download' : 'pi pi-spin pi-spinner'}
                            style={{ background: themeColor, borderColor: themeColor }}
                            className="w-full p-4 shadow-xl rounded-xl font-black tracking-tight active:scale-[0.98] transition-all border-none"
                            onClick={handleDownload}
                            disabled={status !== 'ready'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};