'use client';

import React, { useState, useEffect } from 'react';
import { History, Trophy, Video, Play, Calendar, Star, Loader2 } from 'lucide-react';
import { Dialog } from 'primereact/dialog';

interface PRRecord {
    id: string;
    exercise_name: string;
    max_weight: number;
    max_reps: number;
    load_formula: string;
    date_achieved: string;
    notes?: string;
    video_url?: string;
}

interface TimelineItem {
    id: string;
    date: string;
    title: string;
    description: string;
    type: "pr" | "milestone" | "video";
    videoUrl?: string;
    load_formula?: string;
    stats?: {
        weight: number;
        reps: number;
        rpe?: number;
    };
}

interface CoachViewProgressTimelineProps {
    /** 学员的用户ID */
    studentId: string;
    /** 最多显示条目数 */
    limit?: number;
}

/**
 * 教练视图的进步足迹组件
 * 用于在学员详情弹窗中显示学员的PR记录
 */
export const CoachViewProgressTimeline: React.FC<CoachViewProgressTimelineProps> = ({ 
    studentId,
    limit = 10
}) => {
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [prRecords, setPrRecords] = useState<PRRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (studentId) {
            fetchPRRecords();
        }
    }, [studentId]);

    const fetchPRRecords = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/execution/get-pr-records?userId=${studentId}&limit=${limit}`);
            const result = await res.json();
            
            if (result.success && result.data) {
                setPrRecords(result.data.records || []);
            } else {
                // 如果无权访问或无数据，静默处理
                setPrRecords([]);
            }
        } catch (err) {
            console.error('获取学员PR记录失败:', err);
            setPrRecords([]);
        } finally {
            setLoading(false);
        }
    };

    // Transform PR records to timeline format
    const timelineItems: TimelineItem[] = prRecords.map(pr => ({
        id: pr.id,
        date: pr.date_achieved,
        title: `${pr.exercise_name} 新纪录！`,
        description: pr.notes || `成功完成 ${pr.load_formula}`,
        type: 'pr' as const,
        videoUrl: pr.video_url,
        load_formula: pr.load_formula,
        stats: {
            weight: pr.max_weight,
            reps: pr.max_reps,
        }
    }));

    if (loading) {
        return (
            <div className="bg-surface rounded-xl p-4 mb-4">
                <h3 className="text-md font-bold text-surface-900 flex items-center gap-2 mb-4">
                    <History className="text-primary" size={18} />
                    进步足迹
                </h3>
                <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    <span className="ml-2 text-sm text-gray-500">加载中...</span>
                </div>
            </div>
        );
    }

    if (timelineItems.length === 0) {
        return (
            <div className="bg-surface rounded-xl p-4 mb-4">
                <h3 className="text-md font-bold text-surface-900 flex items-center gap-2 mb-4">
                    <History className="text-primary" size={18} />
                    进步足迹
                </h3>
                <div className="text-center py-6">
                    <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">暂无进步记录</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface rounded-xl p-4 mb-4">
            <h3 className="text-md font-bold text-surface-900 flex items-center gap-2 mb-4">
                <History className="text-primary" size={18} />
                进步足迹
                <span className="text-xs font-normal text-gray-500">
                    ({prRecords.length} 个记录)
                </span>
            </h3>

            <div className="relative pl-3 border-l-2 border-primary-100 space-y-4">
                {timelineItems.map((item) => (
                    <div key={item.id} className="relative">
                        {/* Dot */}
                        <div className={`absolute -left-[13px] top-0 w-3 h-3 rounded-full border-2 border-surface shadow-sm ${
                            item.type === 'pr' ? 'bg-yellow-400' : 
                            item.type === 'video' ? 'bg-blue-400' : 'bg-primary-400'
                        }`} />

                        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
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
                                </div>
                                <h4 className="text-sm font-semibold text-surface-900">{item.title}</h4>
                                
                                {/* Load Formula */}
                                {item.load_formula && (
                                    <div className="mt-1 text-xs font-medium text-primary-600">
                                        🏋️ {item.load_formula}
                                    </div>
                                )}
                                
                                {item.stats && (
                                    <div className="flex gap-2 mt-1 flex-wrap">
                                        <div className="text-xs bg-surface-50 px-2 py-0.5 rounded border border-surface-100">
                                            <span className="text-surface-500">重量:</span> <span className="font-medium">{item.stats.weight}kg</span>
                                        </div>
                                        <div className="text-xs bg-surface-50 px-2 py-0.5 rounded border border-surface-100">
                                            <span className="text-surface-500">次数:</span> <span className="font-medium">{item.stats.reps}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {item.videoUrl && (
                                <div 
                                    className="relative w-24 h-14 bg-surface-900 rounded-lg overflow-hidden cursor-pointer group flex-shrink-0"
                                    onClick={() => setSelectedVideo(item.videoUrl || null)}
                                >
                                    {/* Video thumbnail */}
                                    <video 
                                        src={item.videoUrl}
                                        className="w-full h-full object-cover"
                                        muted
                                        preload="metadata"
                                    />
                                    {/* Play button overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                            <Play size={12} className="text-primary ml-0.5" fill="currentColor" />
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
