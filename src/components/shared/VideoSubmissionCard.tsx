import React from 'react';
import { Play, Clock, MessageSquare, Star, AlertCircle, CheckCircle } from 'lucide-react';
import { VideoSubmission } from '../types';

interface VideoSubmissionCardProps {
  submission: VideoSubmission;
  onView?: () => void;
}

const VideoSubmissionCard: React.FC<VideoSubmissionCardProps> = ({ submission, onView }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reviewed': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'needs_improvement': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'reviewed': return '已点评';
      case 'pending': return '待点评';
      case 'needs_improvement': return '需改进';
      default: return '未知';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'reviewed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'needs_improvement': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer" onClick={onView}>
      {/* 视频缩略图区域 */}
      <div className="relative h-32 bg-gradient-to-r from-gray-400 to-gray-600 rounded-lg mb-4 overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <Play className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {/* 状态标签 */}
        <div className="absolute top-2 left-2">
          <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
            {getStatusIcon(submission.status)}
            <span>{getStatusText(submission.status)}</span>
          </div>
        </div>

        {/* 评分 */}
        {submission.coach_rating && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500 text-white rounded-full text-xs font-medium">
              <Star className="w-3 h-3 fill-current" />
              <span>{submission.coach_rating}</span>
            </div>
          </div>
        )}
      </div>

      {/* 提交信息 */}
      <div className="space-y-3">
        {submission.description && (
          <p className="text-gray-700 text-sm line-clamp-2">{submission.description}</p>
        )}

        {/* 教练反馈 */}
        {submission.coach_feedback && (
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">教练点评</span>
            </div>
            <p className="text-blue-700 text-sm line-clamp-3">{submission.coach_feedback}</p>
          </div>
        )}

        {/* 时间信息 */}
        <div className="flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>提交于 {formatDate(submission.submitted_at)}</span>
          </div>
          
          {submission.reviewed_at && (
            <div className="flex items-center space-x-1">
              <CheckCircle className="w-4 h-4" />
              <span>点评于 {formatDate(submission.reviewed_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoSubmissionCard;