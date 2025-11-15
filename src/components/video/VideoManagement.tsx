import React, { useState, useEffect } from 'react';
import { Play, MessageSquare, Clock, Filter, Search, Trash2, Eye, X } from 'lucide-react';
import TrainingVideoService from '../../services/trainingVideoService';
import { TrainingVideo, VideoType, ReviewStatus } from '../../types/video';

interface VideoManagementProps {
  userId: string;
  coachId?: string;
  showUpload?: boolean;
}

const VideoManagement: React.FC<VideoManagementProps> = ({ 
  userId, 
  coachId,
  showUpload = false 
}) => {
  const [videos, setVideos] = useState<TrainingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    type?: VideoType;
    review_status?: ReviewStatus;
    exercise_name?: string;
  }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<TrainingVideo | null>(null);

  const videoService = TrainingVideoService.getInstance();

  useEffect(() => {
    loadVideos();
  }, [userId, filter]);

  const loadVideos = async () => {
    try {
      setLoading(true);
      const { videos: videoData } = await videoService.getUserVideos(userId, {
        ...filter,
        date_from: undefined,
        date_to: undefined
      });
      setVideos(videoData);
    } catch (error) {
      console.error('加载视频失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (videoId: string) => {
    if (!confirm('确定要删除这个视频吗？')) return;
    
    try {
      await videoService.deleteVideo(videoId, userId);
      setVideos(videos.filter(v => v.id !== videoId));
    } catch (error) {
      alert('删除视频失败: ' + (error as Error).message);
    }
  };

  const filteredVideos = videos.filter(video => {
    const matchesSearch = searchTerm === '' || 
      video.exercise_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      video.user_notes?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getTypeLabel = (type: VideoType) => {
    switch (type) {
      case 'baseline': return '基线评估';
      case 'training': return '训练视频';
      case 'completion': return '完成总结';
      default: return type;
    }
  };

  const getStatusColor = (status: ReviewStatus) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'reviewed': return 'bg-green-100 text-green-800';
      case 'not_required': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: ReviewStatus) => {
    switch (status) {
      case 'pending': return '待点评';
      case 'reviewed': return '已点评';
      case 'not_required': return '无需点评';
      default: return '未知';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">训练视频管理</h1>
        {showUpload && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            上传视频
          </button>
        )}
      </div>

      {/* 过滤器 */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="搜索视频..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="flex gap-2">
            <select
              value={filter.type || ''}
              onChange={(e) => setFilter({ ...filter, type: e.target.value as VideoType || undefined })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">所有类型</option>
              <option value="baseline">基线评估</option>
              <option value="training">训练视频</option>
              <option value="completion">完成总结</option>
            </select>
            
            <select
              value={filter.review_status || ''}
              onChange={(e) => setFilter({ ...filter, review_status: e.target.value as ReviewStatus || undefined })}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">所有状态</option>
              <option value="pending">待点评</option>
              <option value="reviewed">已点评</option>
              <option value="not_required">无需点评</option>
            </select>
          </div>
        </div>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-gray-900">{filteredVideos.length}</div>
          <div className="text-sm text-gray-600">总视频数</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-yellow-600">
            {filteredVideos.filter(v => v.review_status === 'pending').length}
          </div>
          <div className="text-sm text-gray-600">待点评</div>
        </div>
        
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="text-2xl font-bold text-green-600">
            {filteredVideos.filter(v => v.review_status === 'reviewed').length}
          </div>
          <div className="text-sm text-gray-600">已点评</div>
        </div>
      </div>

      {/* 视频列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                      try { e.currentTarget.currentTime = 0.1; } catch {}
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
                  {getTypeLabel(video.type)}
                </span>
              </div>
              
              <div className="absolute top-2 right-2">
                <span className={`px-2 py-1 text-xs rounded ${getStatusColor(video.review_status)}`}>
                  {getStatusLabel(video.review_status)}
                </span>
              </div>
            </div>
            
            <div className="p-4 space-y-3">
              {video.exercise_name && (
                <h3 className="font-semibold text-gray-900">{video.exercise_name}</h3>
              )}
              
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

              {/* 教练点评显示 */}
              {video.review_status === 'reviewed' && video.coach_feedback && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-800">教练点评</span>
                    {video.coach_feedback.rating && (
                      <div className="flex space-x-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span
                            key={star}
                            className={`text-xs ${
                              star <= video.coach_feedback.rating
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-green-700 line-clamp-3">
                    {video.coach_feedback.comment}
                  </p>
                  {video.coach_feedback.tips && video.coach_feedback.tips.length > 0 && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-green-800">建议：</span>
                      <ul className="text-xs text-green-700 mt-1">
                        {video.coach_feedback.tips.slice(0, 2).map((tip, index) => (
                          <li key={index} className="list-disc list-inside">
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{formatDate(video.created_at)}</span>
                </div>
                
                <div className="flex space-x-1">
                  <button className="p-1 text-gray-400 hover:text-gray-600" onClick={() => setPreviewVideo(video)}>
                    <Eye className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => deleteVideo(video.id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredVideos.length === 0 && (
        <div className="text-center py-12">
          <Filter className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{searchTerm ? '没有找到匹配的视频' : '还没有视频记录'}</p>
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
    </div>
  );
};

export default VideoManagement;