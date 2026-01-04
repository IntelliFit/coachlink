'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { chatService } from '@/app/service/chatService';
import type { VideoItem } from '@/app/api/chat/list-student-videos/entity';
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity';
import { Search, Trophy, Video, X, Loader2, Check } from 'lucide-react';

interface VideoRefPickerProps {
    visible: boolean;
    onHide: () => void;
    studentId: string;
    onSelect: (videos: VideoReferenceItem[]) => void;
}

export function VideoRefPicker({ visible, onHide, studentId, onSelect }: VideoRefPickerProps) {
    const [loading, setLoading] = useState(false);
    const [videos, setVideos] = useState<VideoItem[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');
    const [onlyProgress, setOnlyProgress] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [total, setTotal] = useState(0);

    const fetchVideos = useCallback(async (reset = false) => {
        if (!studentId) return;
        
        setLoading(true);
        try {
            const result = await chatService.listStudentVideos({
                studentId,
                query: searchQuery || undefined,
                onlyProgress,
                page: reset ? 1 : page,
                pageSize: 20
            });

            if (result) {
                if (reset) {
                    setVideos(result.videos);
                    setPage(1);
                } else {
                    setVideos(prev => [...prev, ...result.videos]);
                }
                setHasMore(result.hasMore);
                setTotal(result.total);
            }
        } finally {
            setLoading(false);
        }
    }, [studentId, searchQuery, onlyProgress, page]);

    // Reset and fetch when filters change
    useEffect(() => {
        if (visible) {
            setSelectedIds(new Set());
            fetchVideos(true);
        }
    }, [visible, searchQuery, onlyProgress]);

    // Load more
    const loadMore = () => {
        setPage(p => p + 1);
        fetchVideos(false);
    };

    const toggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };

    const handleConfirm = () => {
        const selectedVideos = videos
            .filter(v => selectedIds.has(v.id))
            .map(v => ({
                videoId: v.id,
                videoUrl: v.videoUrl,
                thumbnailUrl: v.thumbnailUrl,
                actionName: v.actionName,
                setNumber: v.setNumber,
                weight: v.weight,
                reps: v.reps,
                isProgress: v.isProgress,
                createdAt: v.createdAt,
                dayIndex: (v as any).dayIndex ?? null,
            }));
        onSelect(selectedVideos);
        onHide();
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    const renderHeader = () => (
        <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
                <Video size={20} className="text-primary-500" />
                <span className="font-bold text-lg">选择视频</span>
            </div>
        </div>
    );

    const renderFooter = () => (
        <div className="flex items-center justify-between w-full pt-4 border-t border-surface-200">
            <span className="text-sm text-surface-500">
                已选择 <span className="font-bold text-primary-500">{selectedIds.size}</span> 个视频
            </span>
            <div className="flex gap-2">
                <Button 
                    label="取消" 
                    severity="secondary" 
                    outlined 
                    onClick={onHide}
                    className="px-4"
                />
                <Button 
                    label="确定发送" 
                    onClick={handleConfirm} 
                    disabled={selectedIds.size === 0}
                    className="px-4"
                />
            </div>
        </div>
    );

    return (
        <Dialog
            header={renderHeader()}
            visible={visible}
            onHide={onHide}
            modal
            draggable={false}
            resizable={false}
            style={{ width: '95vw', maxWidth: '600px' }}
            className="video-ref-picker-dialog"
            contentClassName="p-0"
            footer={renderFooter()}
        >
            {/* 搜索和筛选区 */}
            <div className="p-4 border-b border-surface-200 space-y-3">
                <div className="relative">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <InputText
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索动作名称..."
                        className="w-full pl-10 pr-4 py-2"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Checkbox
                        inputId="onlyProgress"
                        checked={onlyProgress}
                        onChange={(e) => setOnlyProgress(e.checked || false)}
                    />
                    <label htmlFor="onlyProgress" className="text-sm text-surface-600 cursor-pointer flex items-center gap-1">
                        <Trophy size={14} className="text-amber-500" />
                        只看进步视频
                    </label>
                </div>
            </div>

            {/* 视频列表 */}
            <div className="max-h-[400px] overflow-y-auto p-2">
                {loading && videos.length === 0 ? (
                    <div className="space-y-2 p-2">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex items-center gap-3 p-3">
                                <Skeleton shape="circle" size="1.5rem" />
                                <Skeleton width="60%" height="1rem" />
                                <Skeleton width="20%" height="1rem" className="ml-auto" />
                            </div>
                        ))}
                    </div>
                ) : videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-surface-400">
                        <Video size={48} strokeWidth={1} className="mb-4 opacity-50" />
                        <p className="font-medium">暂无视频</p>
                        <p className="text-sm text-surface-300">该学员尚未上传训练视频</p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        {videos.map(video => {
                            const isSelected = selectedIds.has(video.id);
                            return (
                                <div
                                    key={video.id}
                                    onClick={() => toggleSelect(video.id)}
                                    className={`
                                        flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all
                                        ${isSelected 
                                            ? 'bg-primary-50 border border-primary-200' 
                                            : 'hover:bg-surface-50 border border-transparent'}
                                    `}
                                >
                                    {/* 选择框 */}
                                    <div className={`
                                        w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                                        ${isSelected 
                                            ? 'bg-primary-500 text-white' 
                                            : 'border-2 border-surface-300'}
                                    `}>
                                        {isSelected && <Check size={12} strokeWidth={3} />}
                                    </div>

                                    {/* 视频信息 */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium text-surface-900 truncate">
                                                {video.actionName || '未命名动作'}
                                            </span>
                                            {video.isProgress && (
                                                <Trophy size={14} className="text-amber-500 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-surface-500 mt-0.5">
                                            <span>第{video.setNumber}组</span>
                                            {video.weight !== undefined && video.weight !== null && (
                                                <span>@ {video.weight}kg</span>
                                            )}
                                            {video.reps !== undefined && video.reps !== null && (
                                                <span>× {video.reps}次</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* 日期 */}
                                    <span className="text-xs text-surface-400 flex-shrink-0">
                                        {formatDate(video.createdAt)}
                                    </span>
                                </div>
                            );
                        })}
                        
                        {/* 加载更多 */}
                        {hasMore && (
                            <div className="flex justify-center pt-2 pb-1">
                                <Button
                                    label={loading ? '加载中...' : '加载更多'}
                                    severity="secondary"
                                    text
                                    onClick={loadMore}
                                    disabled={loading}
                                    icon={loading ? <Loader2 size={14} className="animate-spin mr-2" /> : undefined}
                                    className="text-sm"
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Dialog>
    );
}

export default VideoRefPicker;
