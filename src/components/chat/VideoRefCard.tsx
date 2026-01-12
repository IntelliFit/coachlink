'use client';

import React from 'react';
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity';
import { Trophy, Play, Calendar } from 'lucide-react';

interface VideoRefCardProps {
    videos: VideoReferenceItem[];
    isMine?: boolean;
}

export function VideoRefCard({ videos, isMine = false }: VideoRefCardProps) {
    if (!videos || videos.length === 0) return null;

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    const formatDayIndex = (dayIndex?: number | null) => {
        if (dayIndex === undefined || dayIndex === null) return null;
        const week = Math.floor((dayIndex - 1) / 7) + 1;
        const day = ((dayIndex - 1) % 7) + 1;
        return `W${week}·D${day}`;
    };

    const handleClick = (videoUrl: string) => {
        window.open(videoUrl, '_blank');
    };

    // 公用训练数据组件：体现“数值中心化”
    const TrainingStats = ({ video, light = false }: { video: VideoReferenceItem, light?: boolean }) => (
        <div className={`flex items-baseline gap-1 mt-1.5 ${light ? 'opacity-80' : ''}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">第 {video.setNumber} 组</span>
            <div className="flex items-baseline gap-0.5">
                <span className="text-sm font-black tracking-tight leading-none ml-1">
                    {video.weight ?? '--'}
                </span>
                <span className="text-[10px] font-bold opacity-40 italic ml-0.5">kg</span>
                <span className="mx-1 text-[10px] opacity-30">×</span>
                <span className="text-sm font-black tracking-tight leading-none">
                    {video.reps ?? '--'}
                </span>
                <span className="text-[10px] font-bold opacity-40 ml-0.5">次</span>
            </div>
        </div>
    );

    // --- 单个视频展示 ---
    if (videos.length === 1) {
        const video = videos[0];
        return (
            <div
                onClick={() => handleClick(video.videoUrl)}
                className={`
                    group relative max-w-[280px] rounded-[24px] overflow-hidden cursor-pointer
                    transition-all duration-300 active:scale-[0.98] border border-transparent
                    ${isMine
                        ? 'bg-primary-600 shadow-lg shadow-primary-600/20'
                        : 'bg-surface border-surface-100 shadow-sm hover:shadow-md'}
                `}
            >
                {/* 封面图：大圆角裁剪 */}
                <div className="relative aspect-[4/3] m-2 overflow-hidden rounded-[18px] bg-surface-900">
                    {video.thumbnailUrl ? (
                        <img src={video.thumbnailUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                    ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800"><Play size={24} className="text-slate-600" /></div>
                    )}

                    {/* 播放按钮悬浮层 */}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-10 h-10 rounded-full bg-surface/20 backdrop-blur-md flex items-center justify-center border border-surface/30">
                            <Play size={18} fill="surface" className="text-surface ml-0.5" />
                        </div>
                    </div>

                    {/* 进步标签：悬浮胶囊 */}
                    {video.isProgress && (
                        <div className="absolute top-2 left-2 bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm">
                            <Trophy size={10} /> ACHIEVEMENT
                        </div>
                    )}
                </div>

                {/* 文字信息 */}
                <div className={`px-4 pb-4 pt-1 ${isMine ? 'text-surface' : 'text-slate-900 dark:text-slate-200'}`}>
                    <div className="font-black text-sm tracking-tight truncate uppercase">
                        {video.actionName}
                    </div>
                    <TrainingStats video={video} light={isMine} />
                    <div className={`mt-3 flex items-center gap-2 text-[10px] font-bold ${isMine ? 'text-surface/60' : 'text-slate-400'}`}>
                        <Calendar size={10} />
                        <span>{formatDate(video.createdAt)} {formatDayIndex(video.dayIndex)}</span>
                    </div>
                </div>
            </div>
        );
    }

    // --- 多个视频滚动展示 ---
    return (
        <div className="w-full max-w-md">
            <div className="flex items-center justify-between px-1 mb-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {videos.length} Training Clips
                </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 snap-x scrollbar-hide">
                {videos.map((video) => (
                    <div
                        key={video.videoId}
                        onClick={() => handleClick(video.videoUrl)}
                        className={`
                            flex-shrink-0 w-40 rounded-[20px] overflow-hidden cursor-pointer snap-start
                            transition-all duration-300 active:scale-95 border
                            ${isMine
                                ? 'bg-primary-600 border-transparent shadow-md shadow-primary-600/10'
                                : 'bg-surface border-slate-100 shadow-sm'}
                        `}
                    >
                        <div className="relative aspect-video bg-slate-900">
                            {video.thumbnailUrl ? (
                                <img src={video.thumbnailUrl} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <Play size={16} className="text-slate-700" />
                            )}
                            {video.isProgress && (
                                <div className="absolute top-1.5 left-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center shadow-sm">
                                    <Trophy size={10} className="text-amber-900" />
                                </div>
                            )}
                        </div>
                        <div className={`p-3 ${isMine ? 'text-surface' : 'text-slate-900'}`}>
                            <div className="text-[11px] font-black truncate uppercase tracking-tighter leading-tight">
                                {video.actionName}
                            </div>
                            <TrainingStats video={video} light={isMine} />
                            <div className={`text-[9px] mt-2 font-bold opacity-50`}>
                                {formatDate(video.createdAt)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}