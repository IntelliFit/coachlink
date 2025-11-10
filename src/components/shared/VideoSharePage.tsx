import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Star,
  User,
  Calendar,
  Clock,
  Award,
  ArrowLeft,
  Share2,
  Download,
  ExternalLink
} from 'lucide-react';

interface VideoShareData {
  id: string;
  title: string;
  description: string;
  video_url: string;
  thumbnail_url: string;
  upload_date: string;
  exercise_type: string;
  duration: number;
  file_size: string;
  coach: {
    name: string;
    title: string;
    rating: number;
  };
  coach_review?: {
    rating: number;
    written_feedback: string;
    technical_score: number;
    form_score: number;
    progress_score: number;
  };
}

interface VideoSharePageProps {
  videoId: string;
  onClose?: () => void;
}

const VideoSharePage: React.FC<VideoSharePageProps> = ({ videoId, onClose }) => {
  const [video, setVideo] = useState<VideoShareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 视频播放器状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // 模拟获取视频数据
  useEffect(() => {
    const fetchVideoData = async () => {
      setLoading(true);
      try {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 模拟视频数据（实际项目中这里应该调用API）
        const mockVideo: VideoShareData = {
          id: videoId,
          title: '引体向上训练 - 第3周',
          description: '按照教练计划进行的引体向上训练，请点评动作标准性。这是我第三周的训练记录，感觉比之前有了明显改善。',
          video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          thumbnail_url: '',
          upload_date: '2024-01-15T10:00:00Z',
          exercise_type: '引体向上',
          duration: 45,
          file_size: '12.5 MB',
          coach: {
            name: '刘三乐',
            title: '国际健身教练认证',
            rating: 4.9
          },
          coach_review: {
            rating: 4,
            written_feedback: '整体动作标准不错！建议改进：1. 下放时要更加控制，避免突然放松 2. 拉起时可以稍微挺胸，激活背部肌肉 3. 呼吸节奏要配合动作。继续加油！',
            technical_score: 85,
            form_score: 90,
            progress_score: 88
          }
        };
        
        setVideo(mockVideo);
      } catch (err) {
        setError('视频加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchVideoData();
  }, [videoId]);

  // 视频播放控制
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return '刚刚';
    } else if (diffInHours < 24) {
      return `${diffInHours}小时前`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays}天前`;
    }
  };

  const handleShareCurrent = () => {
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl).then(() => {
      alert('链接已复制到剪贴板');
    });
  };

  const handleJoinPlatform = () => {
    // 跳转到主页面
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">正在加载视频...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😔</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">视频不存在或已被删除</h2>
          <p className="text-gray-600 mb-6">{error || '无法找到您要查看的视频'}</p>
          <button
            onClick={handleJoinPlatform}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            前往智健联盟
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {onClose && (
                <button
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <h1 className="text-xl font-semibold text-gray-900">智健联盟 - 视频分享</h1>
            </div>
            <button
              onClick={handleJoinPlatform}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>加入平台</span>
            </button>
          </div>
        </div>
      </div>

      {/* 主要内容 */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* 视频播放器 */}
          <div className="bg-black aspect-video relative">
            <video
              ref={videoRef}
              src={video.video_url}
              className="w-full h-full object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              poster={video.thumbnail_url}
              playsInline
            />
            
            {/* 视频控制层 */}
            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-300 group">
              {/* 中心播放按钮 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <button
                  onClick={togglePlay}
                  className="w-16 h-16 bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-110"
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8 text-white" />
                  ) : (
                    <Play className="w-8 h-8 text-white ml-1" />
                  )}
                </button>
              </div>
              
              {/* 底部控制栏 */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="mb-3">
                  <input
                    type="range"
                    min="0"
                    max={duration}
                    value={currentTime}
                    onChange={(e) => handleSeek(Number(e.target.value))}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
                    }}
                  />
                </div>
                
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center space-x-3">
                    <button onClick={togglePlay} className="hover:text-blue-400">
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                    </button>
                    
                    <button onClick={toggleMute} className="hover:text-blue-400">
                      {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                    </button>
                    
                    <span className="text-sm">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  
                  <button className="hover:text-blue-400">
                    <Maximize className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 视频信息 */}
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{video.title}</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center space-x-1">
                    <Award className="w-4 h-4" />
                    <span>{video.exercise_type}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span>{video.duration}秒</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Calendar className="w-4 h-4" />
                    <span>{getRelativeTime(video.upload_date)}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleShareCurrent}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  <span>分享</span>
                </button>
                <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4" />
                  <span>下载</span>
                </button>
              </div>
            </div>

            {/* 教练信息 */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{video.coach.name}</h3>
                  <p className="text-sm text-gray-600">{video.coach.title}</p>
                  <div className="flex items-center space-x-1 mt-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                    <span className="text-sm text-gray-600">{video.coach.rating}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 视频描述 */}
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-2">视频描述</h3>
              <p className="text-gray-700 leading-relaxed">{video.description}</p>
            </div>

            {/* 教练点评 */}
            {video.coach_review && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">教练专业点评</h3>
                
                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{video.coach_review.rating}</div>
                    <div className="text-sm text-gray-600">综合评分</div>
                    <div className="flex justify-center mt-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= video.coach_review!.rating 
                              ? 'text-yellow-400 fill-current' 
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{video.coach_review.technical_score}</div>
                    <div className="text-sm text-gray-600">技术动作</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{video.coach_review.form_score}</div>
                    <div className="text-sm text-gray-600">姿势标准</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{video.coach_review.progress_score}</div>
                    <div className="text-sm text-gray-600">进步程度</div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 mb-2">详细反馈</h4>
                  <p className="text-gray-700 leading-relaxed">{video.coach_review.written_feedback}</p>
                </div>
              </div>
            )}

            {/* 平台推广 */}
            <div className="mt-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white text-center">
              <h3 className="text-xl font-bold mb-2">想要获得专业指导？</h3>
              <p className="mb-4 opacity-90">加入智健联盟，获得专业教练的个性化训练指导</p>
              <button
                onClick={handleJoinPlatform}
                className="bg-white text-blue-600 px-6 py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors"
              >
                立即加入
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoSharePage; 