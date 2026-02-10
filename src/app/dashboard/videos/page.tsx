'use client';

import React, { useState, useEffect } from 'react';
import { Play, Clock, User, Search, MessageSquarePlus, FileVideo, TrendingUp } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { ReviewStatus } from '@/types/coach';
import { coachVideoService } from '../../service/coachVideoService';
import type { ExecutionSetVideoWithDetails } from '@/app/api/coach/video/execution-videos-pending/entity';

// PrimeReact
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Dialog } from 'primereact/dialog';
import { Rating } from 'primereact/rating';
import { InputTextarea } from 'primereact/inputtextarea';
import { Skeleton } from 'primereact/skeleton';

const Videos: React.FC = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    const [videos, setVideos] = useState<ExecutionSetVideoWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState<ExecutionSetVideoWithDetails | null>(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [filter, setFilter] = useState<{ review_status?: ReviewStatus }>({ review_status: 'pending' });
    const [searchTerm, setSearchTerm] = useState('');
    const [previewVideo, setPreviewVideo] = useState<ExecutionSetVideoWithDetails | null>(null);
    const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });

    const canPlayInlineVideo = (url?: string | null) => {
        if (!url) return false;
        const lower = url.toLowerCase();
        if (
            lower.endsWith(".mp4") ||
            lower.endsWith(".webm") ||
            lower.endsWith(".mov") ||
            lower.endsWith(".m4v") ||
            lower.endsWith(".ogg") ||
            lower.includes(".mp4?") ||
            lower.includes(".webm?") ||
            lower.includes(".mov?") ||
            lower.includes(".m4v?") ||
            lower.includes(".ogg?")
        ) {
            return true;
        }
        if (url.includes("/storage/v1/object/")) return true;
        return false;
    };

    useEffect(() => {
        if (coach?.id) loadPendingReviews();
    }, [coach?.id, filter]);

    const loadPendingReviews = async () => {
        try {
            setLoading(true);
            const res = await coachVideoService.getExecutionSetVideos({
                pagination: { page: 1, limit: 100 },
                reviewStatus: filter.review_status,
            });
            if (res) {
                setVideos(res.videos);
            }
        } finally { setLoading(false); }
    };

    const handleReview = async () => {
        if (!selectedVideo || !coach?.id) return;
        try {
            const updatedVideo = await coachVideoService.reviewExecutionVideo(selectedVideo.id, {
                rating: reviewForm.rating,
                comment: reviewForm.comment,
                tips: [],
            });
            if (updatedVideo) {
                setVideos(videos.map(v => v.id === updatedVideo.id ? { ...v, ...updatedVideo } : v));
            }
            setShowReviewModal(false);
            setSelectedVideo(null);
            setReviewForm({ rating: 0, comment: '' });
        } catch (error) {
            console.error(error);
        }
    };

    const statusOptions = [
        { label: '全部状态', value: '' },
        { label: '等待审阅', value: 'pending' },
        { label: '已点评', value: 'reviewed' },
    ];

    return (
        <div className="min-h-screen bg-surface-50/50 py-8 px-4">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* 顶部标题与筛选 */}
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-black text-surface-900 tracking-tight">学员视频点评</h1>
                        <p className="text-surface-500 text-sm mt-1 font-medium">查看并分析学员的动作录像</p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 bg-surface-0 p-1.5 rounded-lg shadow-sm border border-surface-100">
                        <div className="relative flex items-center">
                            <Search className="absolute left-3 text-surface-400" size={16} />
                            <InputText
                                placeholder="搜索学员或动作..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 border-none shadow-none bg-transparent w-full sm:w-60 text-sm"
                            />
                        </div>
                        <Dropdown
                            value={filter.review_status || ''}
                            options={statusOptions}
                            onChange={(e) => setFilter({ review_status: e.value || undefined })}
                            className="w-full sm:w-36 border-none bg-surface-50 rounded text-sm font-bold"
                        />
                    </div>
                </header>

                {/* 视频列表网格 */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-surface-0 rounded-lg p-4 border border-surface-100">
                                <Skeleton height="180px" className="rounded-lg mb-4" />
                                <Skeleton width="60%" height="1.2rem" className="mb-2" />
                                <Skeleton width="100%" height="3rem" />
                            </div>
                        ))}
                    </div>
                ) : videos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 bg-surface-0 rounded-lg border border-surface-100">
                        <FileVideo size={48} className="text-surface-200 mb-4" />
                        <p className="text-surface-400 font-bold">暂无待审阅的视频</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {videos.filter(v =>
                            searchTerm === '' ||
                            v.exercise_name?.includes(searchTerm) ||
                            v.metadata?.student_name?.includes(searchTerm)
                        ).map(video => (
                            <div key={video.id} className="flex flex-col bg-surface-0 rounded-lg overflow-hidden border border-surface-100 hover:border-primary-200 hover:shadow-lg transition-all duration-300">

                                {/* 视频封面区域 */}
                                <div className="relative aspect-video bg-surface-900 group">
                                    {canPlayInlineVideo(video.video_url) ? (
                                        <video
                                            src={video.video_url}
                                            className="absolute inset-0 w-full h-full object-cover opacity-90"
                                            onMouseEnter={(e) => e.currentTarget.play()}
                                            onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                                            muted
                                            loop
                                        />
                                    ) : (
                                        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 text-white/80">
                                            <FileVideo size={36} className="text-white/60" />
                                            <div className="text-xs font-bold">外部链接视频</div>
                                            <button
                                                className="px-3 py-1.5 rounded bg-white/10 hover:bg-white/20 text-xs font-bold"
                                                onClick={() => window.open(video.video_url, "_blank")}
                                            >
                                                打开链接
                                            </button>
                                        </div>
                                    )}
                                    {/* 状态显示 - 右上角中文 */}
                                    <div className="absolute top-3 right-3">
                                        <span className={`px-2 py-1 text-[10px] font-bold rounded shadow-sm ${video.review_status === 'pending' ? 'bg-amber-400 text-white' : 'bg-emerald-500 text-white'
                                            }`}>
                                            {video.review_status === 'pending' ? '等待审阅' : '已点评'}
                                        </span>
                                    </div>

                                    {/* 播放按钮叠加层 */}
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setPreviewVideo(video)}>
                                        <div className="w-10 h-10 rounded-full bg-primary-500 text-white flex items-center justify-center shadow-lg transform scale-75 group-hover:scale-100 transition-transform">
                                            <Play size={20} fill="currentColor" />
                                        </div>
                                    </div>
                                </div>

                                {/* 信息区域 - 使用 flex-1 和 flex flex-col 实现按钮探底 */}
                                <div className="flex flex-col flex-1 p-5">
                                    <div className="mb-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-primary-600 uppercase tracking-wider">
                                                {video.exercise_name || '未指定动作'}
                                            </span>
                                            <div className="flex items-center gap-1 text-surface-400 text-[10px] font-medium">
                                                <Clock size={12} />
                                                {new Date(video.created_at).toLocaleDateString() + ' ' + new Date(video.execution_details.completed_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-surface-100 flex items-center justify-center">
                                                <User size={12} className="text-surface-500" />
                                            </div>
                                            <span className="font-bold text-surface-800 text-sm">
                                                {video.metadata?.student_name || '匿名学员'}
                                            </span>
                                        </div>

                                        {/* 执行详情 - 显示训练数据 */}
                                        {video.execution_details ? (
                                            <div className="mb-3 p-2.5 bg-gradient-to-br from-primary-50 to-surface-50 rounded-lg border border-primary-100">
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <TrendingUp size={12} className="text-primary-600" />
                                                    <span className="text-[10px] font-bold text-primary-700 uppercase tracking-wide">第 {video.set_number} 组</span>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 text-xs">
                                                    {video.execution_details.actual_reps !== undefined && (
                                                        <div className="flex flex-col">
                                                            <span className="text-surface-500 text-[10px] font-medium">完成次数</span>
                                                            <span className="font-bold text-surface-900">
                                                                {video.execution_details.actual_reps}
                                                                {video.execution_details.planned_reps ? ` / ${video.execution_details.planned_reps}` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {video.execution_details.actual_weight !== undefined && (
                                                        <div className="flex flex-col">
                                                            <span className="text-surface-500 text-[10px] font-medium">重量</span>
                                                            <span className="font-bold text-surface-900">
                                                                {video.execution_details.actual_weight}kg
                                                                {video.execution_details.planned_weight ? ` / ${video.execution_details.planned_weight}` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {video.execution_details.rpe !== undefined && (
                                                        <div className="flex flex-col">
                                                            <span className="text-surface-500 text-[10px] font-medium">RPE</span>
                                                            <span className="font-bold text-amber-600">{video.execution_details.rpe}/10</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mb-3 p-2 bg-amber-50 rounded border border-amber-200">
                                                <p className="text-xs text-amber-700">
                                                    ⚠️ 执行详情未找到（调试模式）
                                                    <br />
                                                    video.execution_details: {JSON.stringify(video.execution_details)}
                                                    <br />
                                                    action_id: {video.action_id}, set_number: {video.set_number}
                                                </p>
                                            </div>
                                        )}

                                        {video.user_notes && (
                                            <p className="text-xs text-surface-500 line-clamp-2 leading-relaxed bg-surface-50 p-2 rounded border border-surface-100 italic">
                                                "{video.user_notes}"
                                            </p>
                                        )}
                                    </div>

                                    {/* 按钮区域 - 永远处于卡片底部 */}
                                    <div className="mt-auto pt-4 border-t border-surface-50">
                                        {video.review_status === 'pending' ? (
                                            <Button
                                                label="开始点评"
                                                icon={<MessageSquarePlus size={16} className="mr-2" />}
                                                onClick={() => { setSelectedVideo(video); setShowReviewModal(true); }}
                                                className="w-full bg-primary-500 border-none rounded-lg font-bold py-2.5 text-sm shadow-sm hover:bg-primary-600"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1 text-amber-500 font-bold text-sm">
                                                    <Rating value={video.coach_rating || 5} readOnly stars={5} cancel={false} className="scale-75 origin-left" />
                                                </div>
                                                <Button label="查看结果" className="p-button-text p-button-sm font-bold text-primary-500 text-xs" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 点评对话框 */}
            <Dialog
                visible={showReviewModal && !!selectedVideo}
                onHide={() => { setShowReviewModal(false); setSelectedVideo(null); }}
                header={
                    <div className="space-y-1">
                        <div className="font-bold text-lg">专业视频审阅</div>
                        {selectedVideo && (
                            <div className="flex items-center gap-3 text-sm text-surface-500">
                                <span className="flex items-center gap-1">
                                    <User size={14} />
                                    {selectedVideo.metadata?.student_name || '匿名学员'}
                                </span>
                                <span>•</span>
                                <span className="font-medium text-primary-600">
                                    {selectedVideo.exercise_name || '未指定动作'}
                                </span>
                                <span>•</span>
                                <span>第 {selectedVideo.set_number} 组</span>
                            </div>
                        )}
                    </div>
                }
                className="w-[95vw] max-w-3xl"
                pt={{
                    root: { className: 'rounded-lg border-none shadow-xl bg-surface-0' },
                    header: { className: 'px-6 pt-6 border-none' },
                    content: { className: 'px-6 pb-6' }
                }}
                footer={
                    <div className="flex justify-end gap-2 px-6 pb-6">
                        <Button label="取消" onClick={() => setShowReviewModal(false)} className="p-button-text font-bold text-surface-400" />
                        <Button label="提交指导意见" onClick={handleReview} className="bg-primary-500 border-none font-bold px-6 rounded-lg text-white" disabled={!reviewForm.comment.trim()} />
                    </div>
                }
            >
                <div className="space-y-5">
                    {/* 视频播放器 */}
                    <div className="aspect-video rounded-lg overflow-hidden bg-surface-900 shadow-inner flex items-center justify-center">
                        {selectedVideo?.video_url && canPlayInlineVideo(selectedVideo.video_url) ? (
                            <video controls src={selectedVideo.video_url} className="w-full h-full" />
                        ) : (
                            <div className="text-white/80 text-sm font-bold flex flex-col items-center gap-3">
                                <div>该视频为外部链接，无法在此处直接播放</div>
                                {selectedVideo?.video_url && (
                                    <button
                                        className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-xs font-bold"
                                        onClick={() => window.open(selectedVideo.video_url, "_blank")}
                                    >
                                        打开链接观看
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 执行详情卡片 */}
                    {selectedVideo?.execution_details && (
                        <div className="bg-gradient-to-br from-primary-50 to-surface-50 rounded-lg border border-primary-100 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <TrendingUp size={16} className="text-primary-600" />
                                <h3 className="text-sm font-bold text-primary-700 uppercase tracking-wide">训练执行数据</h3>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {selectedVideo.execution_details.actual_reps !== undefined && (
                                    <div className="bg-surface-0 rounded-lg p-3 border border-surface-100">
                                        <div className="text-[10px] font-medium text-surface-500 mb-1 uppercase">完成次数</div>
                                        <div className="text-lg font-bold text-surface-900">
                                            {selectedVideo.execution_details.actual_reps}
                                            {selectedVideo.execution_details.planned_reps && (
                                                <span className="text-sm text-surface-500 font-normal"> / {selectedVideo.execution_details.planned_reps}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {selectedVideo.execution_details.actual_weight !== undefined && (
                                    <div className="bg-surface-0 rounded-lg p-3 border border-surface-100">
                                        <div className="text-[10px] font-medium text-surface-500 mb-1 uppercase">重量</div>
                                        <div className="text-lg font-bold text-surface-900">
                                            {selectedVideo.execution_details.actual_weight}
                                            <span className="text-sm font-normal">kg</span>
                                            {selectedVideo.execution_details.planned_weight && (
                                                <span className="text-sm text-surface-500 font-normal"> / {selectedVideo.execution_details.planned_weight}</span>
                                            )}
                                        </div>
                                    </div>
                                )}
                                {selectedVideo.execution_details.rpe !== undefined && (
                                    <div className="bg-surface-0 rounded-lg p-3 border border-surface-100">
                                        <div className="text-[10px] font-medium text-surface-500 mb-1 uppercase">主观疲劳度</div>
                                        <div className="text-lg font-bold text-amber-600">
                                            {selectedVideo.execution_details.rpe}
                                            <span className="text-sm font-normal text-surface-500">/10</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {/* 显示计划完成度 */}
                            {selectedVideo.execution_details.planned_reps && selectedVideo.execution_details.actual_reps && (
                                <div className="mt-3 pt-3 border-t border-primary-100">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-surface-600 font-medium">完成度</span>
                                        <span className={`font-bold ${
                                            selectedVideo.execution_details.actual_reps >= selectedVideo.execution_details.planned_reps 
                                                ? 'text-emerald-600' 
                                                : 'text-amber-600'
                                        }`}>
                                            {Math.round((selectedVideo.execution_details.actual_reps / selectedVideo.execution_details.planned_reps) * 100)}%
                                        </span>
                                    </div>
                                    <div className="mt-2 h-2 bg-surface-200 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all ${
                                                selectedVideo.execution_details.actual_reps >= selectedVideo.execution_details.planned_reps 
                                                    ? 'bg-emerald-500' 
                                                    : 'bg-amber-500'
                                            }`}
                                            style={{ 
                                                width: `${Math.min((selectedVideo.execution_details.actual_reps / selectedVideo.execution_details.planned_reps) * 100, 100)}%` 
                                            }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 学员备注 */}
                    {selectedVideo?.user_notes && (
                        <div className="bg-surface-50 rounded-lg p-4 border border-surface-100">
                            <div className="text-xs font-bold text-surface-400 uppercase mb-2">学员备注</div>
                            <p className="text-sm text-surface-700 italic">"{selectedVideo.user_notes}"</p>
                        </div>
                    )}

                    {/* 点评表单 */}
                    <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-surface-400 uppercase">动作评分</label>
                            <Rating
                                value={reviewForm.rating}
                                onChange={(e) => setReviewForm({ ...reviewForm, rating: e.value || 0 })}
                                stars={5} cancel={false}
                                pt={{ item: { className: 'text-amber-400' } }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-surface-400 uppercase">点评反馈</label>
                            <InputTextarea
                                value={reviewForm.comment}
                                onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                rows={5} className="w-full border-surface-200 rounded-lg focus:border-primary-500 text-sm p-3"
                                placeholder="请输入针对该动作的指导意见...&#10;&#10;参考要点：&#10;• 动作规范性评价&#10;• 技术要点提示&#10;• 改进建议&#10;• 训练强度建议"
                            />
                        </div>
                    </div>
                </div>
            </Dialog>

            {/* 预览对话框（点击卡片播放按钮） */}
            <Dialog
                visible={!!previewVideo}
                onHide={() => setPreviewVideo(null)}
                header={
                    <div className="space-y-1">
                        <div className="font-bold text-lg">视频预览</div>
                        {previewVideo && (
                            <div className="flex items-center gap-3 text-sm text-surface-500">
                                <span className="flex items-center gap-1">
                                    <User size={14} />
                                    {previewVideo.metadata?.student_name || "匿名学员"}
                                </span>
                                <span>•</span>
                                <span className="font-medium text-primary-600">
                                    {previewVideo.exercise_name || "未指定动作"}
                                </span>
                                <span>•</span>
                                <span>第 {previewVideo.set_number} 组</span>
                            </div>
                        )}
                    </div>
                }
                className="w-[95vw] max-w-3xl"
                pt={{
                    root: { className: "rounded-lg border-none shadow-xl bg-surface-0" },
                    header: { className: "px-6 pt-6 border-none" },
                    content: { className: "px-6 pb-6" },
                }}
                footer={
                    <div className="flex justify-end gap-2 px-6 pb-6">
                        <Button
                            label="关闭"
                            onClick={() => setPreviewVideo(null)}
                            className="p-button-text font-bold text-surface-400"
                        />
                        {previewVideo && (
                            <Button
                                label="开始点评"
                                onClick={() => {
                                    setSelectedVideo(previewVideo);
                                    setShowReviewModal(true);
                                    setPreviewVideo(null);
                                }}
                                className="bg-primary-500 border-none font-bold px-6 rounded-lg text-white"
                            />
                        )}
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="aspect-video rounded-lg overflow-hidden bg-surface-900 shadow-inner flex items-center justify-center">
                        {previewVideo?.video_url && canPlayInlineVideo(previewVideo.video_url) ? (
                            <video controls src={previewVideo.video_url} className="w-full h-full" />
                        ) : (
                            <div className="text-white/80 text-sm font-bold flex flex-col items-center gap-3">
                                <div>该视频为外部链接，无法在此处直接播放</div>
                                {previewVideo?.video_url && (
                                    <button
                                        className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-xs font-bold"
                                        onClick={() => window.open(previewVideo.video_url, "_blank")}
                                    >
                                        打开链接观看
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                    {previewVideo?.execution_details && (
                        <div className="text-xs text-surface-600">
                            {previewVideo.execution_details.actual_reps !== undefined && (
                                <span className="mr-3">
                                    次数：<b>{previewVideo.execution_details.actual_reps}</b>
                                </span>
                            )}
                            {previewVideo.execution_details.actual_weight !== undefined && (
                                <span className="mr-3">
                                    重量：<b>{previewVideo.execution_details.actual_weight}kg</b>
                                </span>
                            )}
                            {previewVideo.execution_details.rpe !== undefined && (
                                <span className="mr-3">
                                    RPE：<b>{previewVideo.execution_details.rpe}</b>
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </Dialog>
        </div>
    );
};

export default Videos;