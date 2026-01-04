'use client';

import React from 'react';
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity';
import { Trophy, Play } from 'lucide-react';

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
        return `W${week} · D${day}`;
    };

    const handleClick = (videoUrl: string) => {
        // Open video in a new tab or modal
        window.open(videoUrl, '_blank');
    };

    // Single video card
    if (videos.length === 1) {
        const video = videos[0];
        return (
            <div
                onClick={() => handleClick(video.videoUrl)}
                className={`
                    max-w-xs rounded-xl overflow-hidden cursor-pointer
                    transition-all hover:shadow-lg
                    ${isMine ? 'bg-primary-600' : 'bg-surface-100'}
                `}
            >
                {/* Video thumbnail / placeholder */}
                <div className="relative aspect-video bg-surface-800 flex items-center justify-center">
                    {video.thumbnailUrl ? (
                        <img 
                            src={video.thumbnailUrl} 
                            alt={video.actionName}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="text-surface-400">
                            <Play size={32} />
                        </div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                            <Play size={24} className="text-surface-800 ml-1" fill="currentColor" />
                        </div>
                    </div>
                    {/* Progress badge */}
                    {video.isProgress && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
                            <Trophy size={12} />
                            进步
                        </div>
                    )}
                </div>
                {/* Info */}
                <div className={`p-3 ${isMine ? 'text-white' : 'text-surface-900'}`}>
                    <div className="flex items-center gap-2">
                        <span className="font-bold">{video.actionName}</span>
                    </div>
                    <div className={`text-xs mt-1 space-y-0.5 ${isMine ? 'text-white/70' : 'text-surface-500'}`}>
                        <div>
                            第{video.setNumber}组
                            {video.weight !== undefined && video.weight !== null && ` @ ${video.weight}kg`}
                            {video.reps !== undefined && video.reps !== null && ` × ${video.reps}次`}
                        </div>
                        <div className="flex items-center gap-2">
                            <span>{formatDate(video.createdAt)}</span>
                            {formatDayIndex(video.dayIndex) && (
                                <span>· {formatDayIndex(video.dayIndex)}</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Multiple videos - horizontal scroll
    return (
        <div className="max-w-md">
            <div className={`
                text-xs font-medium mb-2 px-1
                ${isMine ? 'text-white/70' : 'text-surface-500'}
            `}>
                {videos.length} 个视频
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
                {videos.map((video) => (
                    <div
                        key={video.videoId}
                        onClick={() => handleClick(video.videoUrl)}
                        className={`
                            flex-shrink-0 w-36 rounded-lg overflow-hidden cursor-pointer snap-start
                            transition-all hover:shadow-md
                            ${isMine ? 'bg-primary-600' : 'bg-surface-100'}
                        `}
                    >
                        {/* Thumbnail */}
                        <div className="relative aspect-video bg-surface-800 flex items-center justify-center">
                            {video.thumbnailUrl ? (
                                <img 
                                    src={video.thumbnailUrl} 
                                    alt={video.actionName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <Play size={20} className="text-surface-400" />
                            )}
                            {video.isProgress && (
                                <Trophy size={12} className="absolute top-1 right-1 text-amber-400" />
                            )}
                        </div>
                        {/* Info */}
                        <div className={`p-2 ${isMine ? 'text-white' : 'text-surface-900'}`}>
                            <div className="text-xs font-medium truncate">{video.actionName}</div>
                            <div className={`text-[10px] mt-0.5 ${isMine ? 'text-white/60' : 'text-surface-400'}`}>
                                第{video.setNumber}组
                                {video.weight !== undefined && video.weight !== null && ` @ ${video.weight}kg`}
                                {video.reps !== undefined && video.reps !== null && ` × ${video.reps}次`}
                            </div>
                            <div className={`text-[10px] ${isMine ? 'text-white/60' : 'text-surface-400'}`}>
                                {formatDate(video.createdAt)}
                                {formatDayIndex(video.dayIndex) && ` · ${formatDayIndex(video.dayIndex)}`}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default VideoRefCard;
