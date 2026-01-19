'use client';

import React, { useState, useEffect } from 'react';
import { History, Trophy, Play, Calendar, Star, Loader2, Trash2 } from 'lucide-react';
import { Dialog } from 'primereact/dialog';
import { ProfileData, TimelineItem, PRRecord } from './types';
import { executionService } from '@/app/service/executionService';

interface ProgressTimelineProps {
    data: ProfileData;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ data }) => {
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [prRecords, setPrRecords] = useState<PRRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        fetchPRRecords();
    }, []);

    const fetchPRRecords = async () => {
        try {
            setLoading(true);
            const result = await executionService.getPRRecords({
                limit: 20,
            });
            
            if (result) {
                setPrRecords(result.records || []);
            } else {
                setError('获取记录失败');
            }
        } catch (err) {
            console.error('获取PR记录失败:', err);
            setError('获取记录失败');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteRecord = async (recordId: string) => {
        const ok = window.confirm('确定要删除这条进步记录吗？删除后将恢复到上一个正确的极限值（如果存在）。');
        if (!ok) return;

        try {
            setDeletingId(recordId);
            const res = await fetch('/api/execution/delete-pr-record', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId }),
            });
            const result = await res.json();
            if (!result?.success) {
                alert(result?.message || '删除失败');
                return;
            }
            // Refresh list. "current 1RM" aggregation will fall back automatically server-side.
            await fetchPRRecords();
        } catch (e) {
            console.error('删除PR记录失败:', e);
            alert('删除失败');
        } finally {
            setDeletingId(null);
        }
    };

    // Transform PR records to timeline format
    const timelineItems: TimelineItem[] = prRecords.map(pr => ({
        id: pr.id,
        date: pr.date_achieved,
        title: `${pr.exercise_name} 新纪录！`,
        // 避免与 load_formula 展示重复：公式单独展示，description 只展示备注或简短说明
        description: pr.notes || '成功完成',
        type: 'pr' as const,
        videoUrl: pr.video_url,
        load_formula: pr.load_formula,
        stats: {
            weight: pr.weight,
            reps: pr.reps,
        }
    }));

    // Merge with any existing timeline data that isn't PR type
    const mergedTimeline = [
        ...timelineItems,
        ...(data.timelineData?.filter(t => t.type !== 'pr') || [])
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (loading) {
        return (
            <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                    <History className="text-primary" size={20} />
                    进步足迹
                </h2>
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-gray-500">加载中...</span>
                </div>
            </div>
        );
    }

    if (mergedTimeline.length === 0) {
        return (
            <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
                <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                    <History className="text-primary" size={20} />
                    进步足迹
                </h2>
                <div className="text-center py-8">
                    <Trophy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">还没有进步记录</p>
                    <p className="text-sm text-gray-400 mt-1">
                        在训练中标记"进步组"来记录你的突破
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                <History className="text-primary" size={20} />
                进步足迹
                {prRecords.length > 0 && (
                    <span className="text-sm font-normal text-gray-500">
                        ({prRecords.length} 个记录)
                    </span>
                )}
            </h2>

            <div className="relative pl-4 border-l-2 border-primary-100 space-y-8">
                {mergedTimeline.map((item) => (
                    <div key={item.id} className="relative">
                        {/* Dot */}
                        <div className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 border-surface shadow-sm ${
                            item.type === 'pr' ? 'bg-yellow-400' : 
                            item.type === 'video' ? 'bg-blue-400' : 'bg-primary-400'
                        }`} />

                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <span className="text-xs font-medium text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Calendar size={10} />
                                        {item.date}
                                    </span>
                                    {item.type === 'pr' && (
                                        <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Star size={10} className="fill-yellow-500" />
                                            新纪录
                                        </span>
                                    )}
                                    {item.type === 'pr' && (
                                        <button
                                            type="button"
                                            className="ml-auto text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-full flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={() => handleDeleteRecord(item.id)}
                                            disabled={deletingId === item.id}
                                            title="删除该记录"
                                        >
                                            <Trash2 size={12} />
                                            删除
                                        </button>
                                    )}
                                </div>
                                <h3 className="text-base font-semibold text-surface-900">{item.title}</h3>
                                
                                {/* Load Formula */}
                                {item.load_formula && (
                                    <div className="mt-1 text-sm font-medium text-primary-600">
                                        🏋️ {item.load_formula}
                                    </div>
                                )}
                                
                                <p className="text-sm text-surface-600 mt-1">{item.description}</p>
                                
                                {item.stats && (
                                    <div className="flex gap-3 mt-2 flex-wrap">
                                        <div className="text-xs bg-surface-50 px-2 py-1 rounded border border-surface-100">
                                            <span className="text-surface-500">重量:</span> <span className="font-medium">{item.stats.weight}kg</span>
                                        </div>
                                        <div className="text-xs bg-surface-50 px-2 py-1 rounded border border-surface-100">
                                            <span className="text-surface-500">次数:</span> <span className="font-medium">{item.stats.reps}</span>
                                        </div>
                                        {item.stats.rpe && (
                                            <div className="text-xs bg-surface-50 px-2 py-1 rounded border border-surface-100">
                                                <span className="text-surface-500">RPE:</span> <span className="font-medium">{item.stats.rpe}</span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {item.videoUrl && (
                                <div 
                                    className="relative w-32 h-20 bg-surface-900 rounded-lg overflow-hidden cursor-pointer group flex-shrink-0"
                                    onClick={() => setSelectedVideo(item.videoUrl || null)}
                                >
                                    {/* Video thumbnail - shows first frame */}
                                    <video 
                                        src={item.videoUrl}
                                        className="w-full h-full object-cover"
                                        muted
                                        preload="metadata"
                                    />
                                    {/* Play button overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                            <Play size={16} className="text-primary ml-0.5" fill="currentColor" />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Dialog 
                header="训练视频" 
                visible={!!selectedVideo} 
                style={{ width: '90vw', maxWidth: '800px' }} 
                onHide={() => setSelectedVideo(null)}
                dismissableMask
            >
                {selectedVideo && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <video 
                            src={selectedVideo} 
                            controls 
                            className="w-full h-full" 
                            autoPlay
                        />
                    </div>
                )}
            </Dialog>
        </div>
    );
};
