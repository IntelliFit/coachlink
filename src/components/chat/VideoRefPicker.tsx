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
import { Search, Trophy, Video, X, Loader2, Check, PlayCircle } from 'lucide-react';
import { useSession } from 'next-auth/react';

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

    const { data: session } = useSession();

    const fetchVideos = useCallback(async (reset = false) => {
        if (!session?.user?.id) {
            return;
        }

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
                    className="px-4 rounded-xl"
                />
                <Button
                    label="确定发送"
                    onClick={handleConfirm}
                    disabled={selectedIds.size === 0}
                    className="px-4 rounded-xl"
                />
            </div>
        </div>
    );

    return (
        <Dialog
            header={
                <div className="flex flex-col gap-0.5">
                    <span className="tracking-tight font-black text-surface-900 text-lg">引用训练视频</span>
                    <span className="text-[10px] font-black text-surface-400 uppercase tracking-widest">选择视频作为动作参考</span>
                </div>
            }
            visible={visible}
            onHide={onHide}
            modal
            draggable={false}
            resizable={false}
            style={{ width: '95vw', maxWidth: '500px' }}
            className="aero-dialog"
            pt={{
                root: { className: 'rounded-[24px] border-none shadow-2xl bg-surface overflow-hidden' },
                header: { className: 'p-6 pb-4 border-none' },
                content: { className: 'p-0' },
                footer: { className: 'p-6 pt-4 border-t border-surface-100/60' }
            }}
            footer={renderFooter()}
        >
            <div className="flex flex-col">
                {/* 1. 搜索与筛选区：去线化色块设计 */}
                <div className="px-6 py-4 space-y-4 bg-surface-50/30">
                    <div className="relative group">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400 group-focus-within:text-primary-500 transition-colors" />
                        <InputText
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="搜索动作名称..."
                            className="w-full pl-11 pr-4 py-3 bg-surface border-none rounded-[16px] shadow-sm text-sm placeholder:text-surface-300 focus:ring-2 focus:ring-primary-500/20 transition-all"
                        />
                    </div>

                    <div
                        className="flex items-center gap-2 px-1 cursor-pointer group"
                        onClick={() => setOnlyProgress(!onlyProgress)}
                    >
                        <div className={`
                    w-4 h-4 rounded-md border flex items-center justify-center transition-all
                    ${onlyProgress ? 'bg-amber-500 border-amber-500 text-surface' : 'border-surface-300 bg-surface group-hover:border-amber-400'}
                `}>
                            {onlyProgress && <Check size={12} strokeWidth={4} />}
                        </div>
                        <label className="text-[11px] font-black text-surface-500 cursor-pointer flex items-center gap-1.5 uppercase tracking-tight">
                            <Trophy size={14} className={onlyProgress ? 'text-amber-500' : 'text-surface-300'} />
                            只看进步视频记录
                        </label>
                    </div>
                </div>

                {/* 2. 视频列表区 */}
                <div className="px-3 py-2 max-h-[420px] overflow-y-auto scrollbar-hide">
                    {loading && videos.length === 0 ? (
                        <div className="space-y-2 p-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-[18px] bg-surface-50/50">
                                    <Skeleton shape="circle" size="2rem" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton width="60%" height="0.8rem" />
                                        <Skeleton width="40%" height="0.6rem" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : videos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 opacity-40">
                            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mb-4">
                                <Video size={32} strokeWidth={1.5} className="text-surface-400" />
                            </div>
                            <p className="font-black text-sm text-surface-900 tracking-tight">未找到相关视频</p>
                            <p className="text-xs font-medium text-surface-400 mt-1">请尝试更换搜索词或取消筛选</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-2 p-1">
                            {videos.map(video => {
                                const isSelected = selectedIds.has(video.id);
                                return (
                                    <div
                                        key={video.id}
                                        onClick={() => toggleSelect(video.id)}
                                        className={`
                                    relative flex items-center gap-4 p-4 rounded-[20px] cursor-pointer transition-all duration-300
                                    ${isSelected
                                                ? 'bg-primary-50/80 shadow-[inset_0_0_0_1.5px_rgba(var(--primary-rgb),0.5)] scale-[0.98]'
                                                : 'bg-surface hover:bg-surface-50 active:scale-[0.99]'}
                                `}
                                    >
                                        {/* 自定义选择环 */}
                                        <div className={`
                                    w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                                    ${isSelected ? 'bg-primary-600 scale-110' : 'border-2 border-surface-200 bg-surface'}
                                `}>
                                            {isSelected && <Check size={14} strokeWidth={3} className="text-surface" />}
                                        </div>

                                        {/* 视频详情 */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black text-sm tracking-tight truncate ${isSelected ? 'text-primary-900' : 'text-surface-900'}`}>
                                                    {video.actionName || '未命名动作'}
                                                </span>
                                                {video.isProgress && (
                                                    <span className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md">
                                                        <Trophy size={10} />
                                                        <span className="text-[9px] font-black uppercase">PR</span>
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="text-[10px] font-bold px-2 py-0.5 bg-surface-100 text-surface-500 rounded-full">
                                                    第 {video.setNumber} 组
                                                </span>
                                                {(video.weight || video.reps) && (
                                                    <span className="text-[10px] font-black text-primary-600/60">
                                                        {video.weight}kg × {video.reps}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* 时间标签 */}
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="text-[10px] font-black text-surface-300 uppercase tracking-tighter">
                                                {formatDate(video.createdAt)}
                                            </span>
                                            <PlayCircle size={14} className={isSelected ? 'text-primary-400' : 'text-surface-200'} />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* 加载更多：物理化按钮 */}
                            {hasMore && (
                                <div className="flex justify-center py-4">
                                    <button
                                        onClick={loadMore}
                                        disabled={loading}
                                        className="flex items-center gap-2 px-6 py-2 rounded-full bg-surface-100 text-[11px] font-black text-surface-500 hover:bg-surface-200 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {loading ? <Loader2 size={14} className="animate-spin" /> : '加载更多记录'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </Dialog>
    );
}

export default VideoRefPicker;
