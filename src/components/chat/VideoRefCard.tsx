'use client';

import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Trophy, Play, Calendar } from 'lucide-react';
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity';
import { formatBeijingDate } from '@/lib/beijingTime';

interface VideoRefCardProps {
    videos: VideoReferenceItem[];
    isMine?: boolean;
}

function canPlayInlineVideo(url?: string | null) {
    if (!url) return false;
    if (url.startsWith('blob:')) return true;

    const lower = url.toLowerCase();
    if (
        lower.endsWith('.mp4') ||
        lower.endsWith('.webm') ||
        lower.endsWith('.mov') ||
        lower.endsWith('.m4v') ||
        lower.endsWith('.ogg') ||
        lower.includes('.mp4?') ||
        lower.includes('.webm?') ||
        lower.includes('.mov?') ||
        lower.includes('.m4v?') ||
        lower.includes('.ogg?')
    ) {
        return true;
    }

    return url.includes('/storage/v1/object/');
}

function VideoCover({
    video,
    className,
}: {
    video: VideoReferenceItem;
    className?: string;
}) {
    const [showFallback, setShowFallback] = useState(false);

    if (video.thumbnailUrl && !showFallback) {
        return (
            <img
                src={video.thumbnailUrl}
                className={className}
                alt=""
                onError={() => setShowFallback(true)}
            />
        );
    }

    if (canPlayInlineVideo(video.videoUrl) && !showFallback) {
        return (
            <video
                src={video.videoUrl}
                className={className}
                preload="metadata"
                muted
                playsInline
                onLoadedMetadata={(event) => {
                    try {
                        event.currentTarget.currentTime = 0.1;
                    } catch {
                        // ignore
                    }
                }}
                onError={() => setShowFallback(true)}
            />
        );
    }

    return (
        <div className={`flex items-center justify-center bg-slate-800 ${className || ''}`}>
            <Play size={24} className="text-slate-600" />
        </div>
    );
}

export function VideoRefCard({ videos, isMine = false }: VideoRefCardProps) {
    const [previewVideo, setPreviewVideo] = useState<VideoReferenceItem | null>(null);

    if (!videos || videos.length === 0) return null;

    const formatDate = (dateStr: string) =>
        formatBeijingDate(dateStr, 'zh-CN', { month: 'short', day: 'numeric' });

    const formatDayIndex = (dayIndex?: number | null) => {
        if (dayIndex === undefined || dayIndex === null) return null;
        const week = Math.floor((dayIndex - 1) / 7) + 1;
        const day = ((dayIndex - 1) % 7) + 1;
        return `W${week} / D${day}`;
    };

    const hasTrainingStats = (video: VideoReferenceItem) => {
        return !(video.weight === null && video.reps === null);
    };

    const handleClick = (video: VideoReferenceItem) => {
        if (canPlayInlineVideo(video.videoUrl)) {
            setPreviewVideo(video);
            return;
        }

        window.open(video.videoUrl, '_blank', 'noopener,noreferrer');
    };

    const TrainingStats = ({ video, light = false }: { video: VideoReferenceItem; light?: boolean }) => (
        <div className={`mt-1.5 flex items-baseline gap-1 ${light ? 'opacity-80' : ''}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">第 {video.setNumber} 组</span>
            <div className="flex items-baseline gap-0.5">
                <span className="ml-1 text-sm font-black leading-none tracking-tight">{video.weight ?? '--'}</span>
                <span className="ml-0.5 text-[10px] font-bold italic opacity-40">kg</span>
                <span className="mx-1 text-[10px] opacity-30">×</span>
                <span className="text-sm font-black leading-none tracking-tight">{video.reps ?? '--'}</span>
                <span className="ml-0.5 text-[10px] font-bold opacity-40">次</span>
            </div>
        </div>
    );

    const previewDialog = (
        <Dialog
            visible={!!previewVideo}
            onHide={() => setPreviewVideo(null)}
            header={previewVideo ? previewVideo.actionName : '视频预览'}
            modal
            dismissableMask
            draggable={false}
            resizable={false}
            style={{ width: 'min(960px, 92vw)' }}
            className="overflow-hidden"
        >
            {previewVideo ? (
                <div className="space-y-4">
                    <div className="overflow-hidden rounded-2xl bg-black">
                        <video
                            src={previewVideo.videoUrl}
                            poster={previewVideo.thumbnailUrl || undefined}
                            controls
                            autoPlay
                            playsInline
                            preload="metadata"
                            className="w-full max-h-[72vh]"
                        >
                            您的浏览器不支持视频播放
                        </video>
                    </div>
                    {previewVideo.description && previewVideo.description !== previewVideo.actionName ? (
                        <p className="text-sm text-surface-600">{previewVideo.description}</p>
                    ) : null}
                </div>
            ) : null}
        </Dialog>
    );

    if (videos.length === 1) {
        const video = videos[0];

        return (
            <>
                <div
                    onClick={() => handleClick(video)}
                    className={`
                        group relative w-[min(360px,calc(100vw-120px))] max-w-full cursor-pointer overflow-hidden rounded-[24px]
                        border border-transparent transition-all duration-300 active:scale-[0.98]
                        ${isMine
                            ? 'bg-primary-600 shadow-lg shadow-primary-600/20'
                            : 'bg-surface border-surface-100 shadow-sm hover:shadow-md'}
                    `}
                >
                    <div className="relative m-2 aspect-[4/3] overflow-hidden rounded-[18px] bg-surface-900">
                        <VideoCover
                            video={video}
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />

                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-surface/30 bg-surface/20 backdrop-blur-md">
                                <Play size={18} fill="surface" className="ml-0.5 text-surface" />
                            </div>
                        </div>

                        {video.isProgress ? (
                            <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950 shadow-sm">
                                <Trophy size={10} /> PR
                            </div>
                        ) : null}
                    </div>

                    <div className={`px-4 pb-4 pt-1 ${isMine ? 'text-surface' : 'text-surface-900 dark:text-surface-0'}`}>
                        <div className="line-clamp-2 text-sm font-black leading-snug tracking-tight">{video.actionName}</div>
                        {video.description && video.description !== video.actionName ? (
                            <div className={`mt-1 text-[11px] font-bold leading-snug ${isMine ? 'text-surface/80' : 'text-surface-600'}`}>
                                {video.description}
                            </div>
                        ) : null}
                        {Array.isArray(video.tags) && video.tags.length > 0 ? (
                            <div className={`mt-2 flex flex-wrap gap-1 ${isMine ? 'text-surface/70' : 'text-surface-500'}`}>
                                {video.tags.slice(0, 4).map((tag) => (
                                    <span
                                        key={tag}
                                        className={`rounded-full px-2 py-0.5 text-[9px] font-black ${isMine ? 'bg-surface/15' : 'bg-surface-100'}`}
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {hasTrainingStats(video) ? <TrainingStats video={video} light={isMine} /> : null}
                        <div className={`mt-3 flex items-center gap-2 text-[10px] font-bold ${isMine ? 'text-surface/60' : 'text-slate-400'}`}>
                            <Calendar size={10} />
                            <span>
                                {formatDate(video.createdAt)} {formatDayIndex(video.dayIndex)}
                            </span>
                        </div>
                    </div>
                </div>
                {previewDialog}
            </>
        );
    }

    return (
        <div className="w-[min(448px,calc(100vw-120px))] max-w-full">
            <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {videos.length} 个训练视频
                </span>
            </div>
            <div className="-mx-2 flex snap-x gap-3 overflow-x-auto px-2 pb-4 scrollbar-hide">
                {videos.map((video) => (
                    <div
                        key={video.videoId}
                        onClick={() => handleClick(video)}
                        className={`
                            w-36 flex-shrink-0 cursor-pointer snap-start overflow-hidden rounded-[20px] border transition-all duration-300 active:scale-95 sm:w-40
                            ${isMine
                                ? 'border-transparent bg-primary-600 shadow-md shadow-primary-600/10'
                                : 'border-slate-100 bg-surface shadow-sm'}
                        `}
                    >
                        <div className="relative aspect-video overflow-hidden bg-slate-900">
                            <VideoCover
                                video={video}
                                className="h-full w-full object-cover"
                            />
                            {video.isProgress ? (
                                <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 shadow-sm">
                                    <Trophy size={10} className="text-amber-900" />
                                </div>
                            ) : null}
                        </div>
                        <div className={`p-3 ${isMine ? 'text-surface' : 'text-surface-900 dark:text-surface-0'}`}>
                            <div className="line-clamp-2 text-[11px] font-black leading-tight tracking-tighter">
                                {video.actionName}
                            </div>
                            {hasTrainingStats(video) ? <TrainingStats video={video} light={isMine} /> : null}
                            <div className="mt-2 text-[9px] font-bold opacity-50">{formatDate(video.createdAt)}</div>
                        </div>
                    </div>
                ))}
            </div>
            {previewDialog}
        </div>
    );
}
