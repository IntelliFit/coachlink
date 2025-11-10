'use client';

import React, { useState, useEffect } from 'react';
import { Play, MessageSquare, Star, Clock, User, Filter, Search, X, Eye } from 'lucide-react';

import { TrainingVideo } from '@/types';
import { ReviewStatus } from '@/types/coach';
import { coachVideoService } from '../service/coachVideoService';

interface CoachVideoReviewProps {
    coachId: string;
}

const CoachVideoReview: React.FC<CoachVideoReviewProps> = ({ coachId }) => {
    const [videos, setVideos] = useState<TrainingVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVideo, setSelectedVideo] = useState<TrainingVideo | null>(null);
    const [showReviewModal, setShowReviewModal] = useState(false);
    const [filter, setFilter] = useState<{
        review_status?: ReviewStatus;
        exercise_name?: string;
    }>({ review_status: 'pending' });
    const [searchTerm, setSearchTerm] = useState('');
    const [previewVideo, setPreviewVideo] = useState<TrainingVideo | null>(null);

    const [reviewForm, setReviewForm] = useState({
        rating: 0,
        comment: '',
        tips: ['']
    });



    useEffect(() => {
        loadPendingReviews();
    }, [coachId, filter]);

    const loadPendingReviews = async () => {
        try {
            setLoading(true);
            const res = await coachVideoService.getCoachPendingReviews({
                pagination: {
                    page: 1,
                    limit: 100,
                },
                reviewStatus: filter.review_status
            });
            
            if (res) {
                setVideos(res.videos);
            }
        } catch (error) {
            console.error('加载待点评视频失败:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReview = async () => {
        if (!selectedVideo || !coachId) return;

        try {
            const coachName = '教练';
            const updatedVideo = await coachVideoService.reviewVideo(
                selectedVideo.id,
                {
                    rating: reviewForm.rating,
                    comment: reviewForm.comment,
                    tips: reviewForm.tips.filter(t => t.trim())
                }
            );

            if (updatedVideo) {
                setVideos(videos.map(v => v.id === updatedVideo.id ? updatedVideo : v));
            }

            setShowReviewModal(false);
            setSelectedVideo(null);
            setReviewForm({ rating: 0, comment: '', tips: [''] });
        } catch (error) {
            alert('点评失败: ' + (error as Error).message);
        }
    };

    const getExerciseLabel = (exerciseName: string | null) => {
        return exerciseName || '未指定动作';
    };

    const getStatusLabel = (status: ReviewStatus | null) => {
        switch (status) {
            case 'pending': return '待点评';
            case 'reviewed': return '已点评';
            case 'not_required': return '无需点评';
            default: return '未知';
        }
    };

    const getStatusColor = (status: ReviewStatus | null) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'reviewed': return 'bg-green-100 text-green-800';
            case 'not_required': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('zh-CN');
    };

    const filteredVideos = videos.filter(video => {
        const matchesSearch = searchTerm === '' ||
            video.exercise_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            video.user_notes?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSearch;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900">学员视频点评</h1>
                <div className="text-sm text-gray-600">
                    待点评: {filteredVideos.filter(v => v.review_status === 'pending').length}
                </div>
            </div>

            {/* 过滤器 */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="搜索学员或动作..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    <select
                        value={filter.review_status || ''}
                        onChange={(e) => setFilter({ ...filter, review_status: e.target.value as ReviewStatus || undefined })}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">所有状态</option>
                        <option value="pending">待点评</option>
                        <option value="reviewed">已点评</option>
                    </select>
                </div>
            </div>

            {/* 视频列表 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredVideos.map((video) => (
                    <div key={video.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                        <div className="relative">
                            <div className="aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center cursor-pointer overflow-hidden">
                                {video.thumbnail_url ? (
                                    <img
                                        src={video.thumbnail_url}
                                        alt="视频封面"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                ) : (
                                    <video
                                        src={video.video_url}
                                        className="w-full h-full object-cover"
                                        preload="metadata"
                                        muted
                                        playsInline
                                        onLoadedMetadata={(e) => {
                                            try { e.currentTarget.currentTime = 0.1; } catch { }
                                        }}
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                        }}
                                    />
                                )}
                                <div className="hidden absolute inset-0 flex items-center justify-center">
                                    <Play className="w-12 h-12 text-gray-400" />
                                </div>
                                <div
                                    className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (video.video_url?.startsWith('http')) {
                                            window.open(video.video_url, '_blank');
                                        } else {
                                            setPreviewVideo(video);
                                        }
                                    }}
                                >
                                    <Play className="w-16 h-16 text-white" />
                                </div>
                            </div>

                            <div className="absolute top-2 left-2">
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                    {getExerciseLabel(video.exercise_name)}
                                </span>
                            </div>

                            <div className="absolute top-2 right-2">
                                <span className={`px-2 py-1 text-xs rounded ${getStatusColor(video.review_status as any)}`}>
                                    {getStatusLabel(video.review_status as any)}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="flex items-center space-x-2">
                                <User className="w-4 h-4 text-gray-400" />
                                <span className="text-sm text-gray-600">
                                    {(video as any).metadata?.student_name || '匿名学员'}
                                    {video.user_id && (
                                        <span className="text-xs text-gray-400 ml-1">
                                            (ID: {video.user_id.slice(0, 8)}...)
                                        </span>
                                    )}
                                </span>
                            </div>

                            {/* 视频链接或备注 */}
                            {video.video_url?.startsWith('http') ? (
                                <a
                                    href={video.video_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-sm text-blue-600 hover:text-blue-800 break-all line-clamp-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {video.video_url}
                                </a>
                            ) : video.user_notes ? (
                                <p className="text-sm text-gray-600 line-clamp-2">
                                    {video.user_notes}
                                </p>
                            ) : null}

                            <div className="flex items-center justify-between text-xs text-gray-500">
                                <div className="flex items-center space-x-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{formatDate(video.created_at as any)}</span>
                                </div>

                                {video.review_status === 'pending' && (
                                    <button
                                        onClick={() => {
                                            setSelectedVideo(video);
                                            setShowReviewModal(true);
                                        }}
                                        className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                                    >
                                        点评
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredVideos.length === 0 && (
                <div className="text-center py-12">
                    <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">{searchTerm ? '没有找到匹配的视频' : '暂无待点评视频'}</p>
                </div>
            )}

            {/* 预览弹窗 */}
            {previewVideo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-4 w-full max-w-4xl mx-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold">视频预览</h3>
                            <button className="text-gray-500 hover:text-gray-700" onClick={() => setPreviewVideo(null)}>
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="aspect-video bg-black rounded-lg overflow-hidden">
                            <video controls src={previewVideo.video_url || ''} poster={previewVideo.thumbnail_url || undefined} className="w-full h-full" />
                        </div>
                    </div>
                </div>
            )}

            {/* 点评模态框 */}
            {showReviewModal && selectedVideo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold">视频点评</h2>
                            <button
                                onClick={() => {
                                    setShowReviewModal(false);
                                    setSelectedVideo(null);
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ×
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <h3 className="font-semibold">{getExerciseLabel(selectedVideo.exercise_name)}</h3>
                                <p className="text-sm text-gray-600">{selectedVideo.user_notes || '无备注'}</p>
                            </div>

                            <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                                <video controls src={selectedVideo.video_url || ''} poster={selectedVideo.thumbnail_url || undefined} className="w-full h-full" />
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium">评分 (1-5星)</label>
                                <div className="flex space-x-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`w-6 h-6 cursor-pointer ${star <= reviewForm.rating
                                                    ? 'text-yellow-400 fill-current'
                                                    : 'text-gray-300'
                                                }`}
                                            onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-sm font-medium">点评内容</label>
                                <textarea
                                    value={reviewForm.comment}
                                    onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                                    placeholder="请输入您的点评..."
                                    rows={4}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex justify-end space-x-3">
                                <button
                                    onClick={() => {
                                        setShowReviewModal(false);
                                        setSelectedVideo(null);
                                    }}
                                    className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                                >
                                    取消
                                </button>
                                <button
                                    onClick={handleReview}
                                    disabled={!reviewForm.comment.trim()}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                                >
                                    提交点评
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CoachVideoReview;