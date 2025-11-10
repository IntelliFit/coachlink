import React from 'react';
import { Play, Clock, Target, CheckCircle, Star, User } from 'lucide-react';
import { TrainingPlan } from '../types';

interface TrainingPlanCardProps {
  plan: TrainingPlan;
  onStart?: () => void;
  onView?: () => void;
}

const TrainingPlanCard: React.FC<TrainingPlanCardProps> = ({ plan, onStart, onView }) => {
  const getDifficultyColor = (level: string) => {
    switch (level) {
      case 'beginner': return 'bg-green-100 text-green-700';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700';
      case 'advanced': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getDifficultyText = (level: string) => {
    switch (level) {
      case 'beginner': return '初级';
      case 'intermediate': return '中级';
      case 'advanced': return '高级';
      default: return '未知';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
      {/* 计划头部 */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900 mb-2">{plan.title}</h3>
          <p className="text-gray-600 text-sm line-clamp-2">{plan.description}</p>
        </div>
        <div className="ml-4">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(plan.difficulty_level)}`}>
            {getDifficultyText(plan.difficulty_level)}
          </span>
        </div>
      </div>

      {/* 计划信息 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Clock className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{plan.duration_weeks} 周</span>
        </div>
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{plan.exercises?.length || 0} 个动作</span>
        </div>
      </div>

      {/* AI/教练标识 */}
      <div className="flex items-center space-x-2 mb-4">
        {plan.ai_generated && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-blue-50 rounded-full">
            <Star className="w-3 h-3 text-blue-500" />
            <span className="text-xs text-blue-700">AI生成</span>
          </div>
        )}
        {plan.coach_reviewed && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-green-50 rounded-full">
            <CheckCircle className="w-3 h-3 text-green-500" />
            <span className="text-xs text-green-700">教练审核</span>
          </div>
        )}
        {plan.coach_id && (
          <div className="flex items-center space-x-1 px-2 py-1 bg-purple-50 rounded-full">
            <User className="w-3 h-3 text-purple-500" />
            <span className="text-xs text-purple-700">专业定制</span>
          </div>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex space-x-2">
        <button 
          onClick={onStart}
          className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-1"
        >
          <Play className="w-4 h-4" />
          <span>开始训练</span>
        </button>
        <button 
          onClick={onView}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          查看详情
        </button>
      </div>
    </div>
  );
};

export default TrainingPlanCard;