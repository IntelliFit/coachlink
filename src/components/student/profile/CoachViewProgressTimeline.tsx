'use client';

import React, { useState, useEffect } from 'react';
import { History, Trophy, Video, Play, Calendar, Star, Loader2 } from 'lucide-react';
import { Dialog } from 'primereact/dialog';
import { Skeleton } from 'primereact/skeleton';

interface PRRecord {
    id: string;
    exercise_name: string;
    // 与 /api/execution/get-pr-records 返回保持一致
    weight: number;
    reps: number;
    e1rm?: number;
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


export const CoachViewProgressTimeline: React.FC<CoachViewProgressTimelineProps> = ({ 
    studentId,
    limit = 10
}) => {
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
    const [prRecords, setPrRecords] = useState<PRRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (studentId) fetchPRRecords();
    }, [studentId]);

    const fetchPRRecords = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/execution/get-pr-records?userId=${studentId}&limit=${limit}`);
            const result = await res.json();
            setPrRecords(result.success ? result.data.records : []);
        } catch (err) { setPrRecords([]); } finally { setLoading(false); }
    };

    if (loading) {
        return (
            <div className="p-2 space-y-6">
                <Skeleton width="120px" height="1.5rem" className="rounded-full bg-surface-100" />
                <div className="pl-4 space-y-8 border-l border-surface-100">
                    {[1, 2].map(i => <Skeleton key={i} height="100px" className="rounded-[20px] bg-surface-50/50" />)}
                </div>
            </div>
        );
    }

    if (prRecords.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 bg-surface-50/30 rounded-[24px] border border-dashed border-surface-200">
                <Trophy className="w-10 h-10 text-surface-200 mb-2 stroke-[1.5]" />
                <p className="text-xs font-bold text-surface-400 tracking-tight">暂无进步记录</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header: 紧凑字间距 */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2 font-bold tracking-tight text-surface-900 text-sm">
                    <History size={16} className="text-primary-500" />
                    <span>进步足迹</span>
                </div>
                <span className="text-[10px] font-black text-surface-300 tracking-widest uppercase">
                    {prRecords.length} Records
                </span>
            </div>

            {/* Timeline: 保留结构，轻量化线条 */}
            <div className="relative ml-2 pl-6 border-l border-surface-100 space-y-8">
                {prRecords.map((pr) => (
                    <div key={pr.id} className="relative group">
                        
                        {/* 物理感节点: 静态时微弱，Hover时发光 */}
                        <div className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full border-2 border-surface bg-surface-300 
                                      ring-4 ring-surface transition-all duration-300 group-hover:bg-primary-500 group-hover:ring-primary-50" />

                        <div className="flex flex-col gap-3 transition-all duration-300">
                            
                            {/* 第一行：日期与徽章 */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-bold text-surface-400 bg-surface-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-surface-100/50">
                                    <Calendar size={10} strokeWidth={2.5} />
                                    {pr.date_achieved}
                                </span>
                                <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-amber-100/50 flex items-center gap-1">
                                    <Star size={10} className="fill-amber-500" />
                                    New PR
                                </span>
                            </div>

                            {/* 第二行：核心标题与备注 */}
                            <div>
                                <h4 className="text-sm font-bold text-surface-900 tracking-tight">{pr.exercise_name} 新纪录！</h4>
                                <p className="text-[11px] text-surface-500 mt-0.5 opacity-80 leading-relaxed font-medium">
                                    {/* 避免与右侧 Formula 区重复：公式单独展示，这里仅展示备注或简短说明 */}
                                    {pr.notes || '成功完成'}
                                </p>
                            </div>

                            {/* 第三行：数值中心化数据区（严格保留数字） */}
                            <div className="flex items-center gap-4">
                                <div className="flex-1 flex items-center gap-3 p-3 bg-surface-50/50 rounded-[16px] border border-surface-100/30 group-hover:border-primary-100 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-surface-400 uppercase tracking-widest">Weight</span>
                                        <span className="text-lg font-black text-surface-900 tracking-tighter">{pr.weight}<small className="text-[10px] ml-0.5 font-bold">kg</small></span>
                                    </div>
                                    <div className="w-[1px] h-6 bg-surface-200/50" />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-bold text-surface-400 uppercase tracking-widest">Reps</span>
                                        <span className="text-lg font-black text-surface-900 tracking-tighter">{pr.reps}</span>
                                    </div>
                                    <div className="ml-auto text-right">
                                        <div className="text-[9px] font-bold text-primary-400 uppercase tracking-widest">Formula</div>
                                        <div className="text-[11px] font-bold text-primary-600 tracking-tight italic">{pr.load_formula}</div>
                                    </div>
                                </div>

                                {/* 视频入口：物理缩放反馈 */}
                                {pr.video_url && (
                                    <div 
                                        className="relative w-16 h-16 rounded-[18px] overflow-hidden cursor-pointer flex-shrink-0 
                                                   transition-all duration-300 active:scale-[0.95] hover:shadow-lg shadow-sm"
                                        onClick={() => setSelectedVideo(pr.video_url || null)}
                                    >
                                        <video src={pr.video_url} className="w-full h-full object-cover" muted preload="metadata" />
                                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center group-hover:bg-black/40 transition-colors">
                                            <div className="w-8 h-8 rounded-full bg-surface/95 flex items-center justify-center shadow-xl">
                                                <Play size={10} className="text-primary-600 ml-0.5" fill="currentColor" />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* 视频 Dialog */}
            <Dialog 
                header={<span className="text-sm font-bold tracking-tight">训练实录</span>} 
                visible={!!selectedVideo} 
                onHide={() => setSelectedVideo(null)}
                style={{ width: '90vw', maxWidth: '450px' }}
                pt={{
                    root: { className: 'rounded-[24px] overflow-hidden border-none shadow-2xl' },
                    header: { className: 'p-4 pb-0' },
                    content: { className: 'p-4' }
                }}
                modal dismissableMask
            >
                {selectedVideo && (
                    <div className="aspect-[9/16] max-h-[70vh] bg-black rounded-[20px] overflow-hidden">
                        <video src={selectedVideo} controls className="w-full h-full" autoPlay />
                    </div>
                )}
            </Dialog>
        </div>
    );
};