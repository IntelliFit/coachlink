import React from 'react';
import { Trophy, Star, Target, Calendar } from 'lucide-react';
import { Achievement, UserAchievement } from '../types';

interface AchievementCardProps {
  achievement: Achievement;
  userAchievement?: UserAchievement;
  progress?: number;
}

const AchievementCard: React.FC<AchievementCardProps> = ({ 
  achievement, 
  userAchievement, 
  progress = 0 
}) => {
  const isEarned = !!userAchievement;
  const progressPercentage = Math.min((progress / achievement.requirement) * 100, 100);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'training': return 'from-blue-500 to-blue-600';
      case 'consistency': return 'from-orange-500 to-orange-600';
      case 'strength': return 'from-red-500 to-red-600';
      case 'progress': return 'from-green-500 to-green-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm p-6 transition-all ${
      isEarned ? 'ring-2 ring-yellow-400 shadow-lg' : 'hover:shadow-md'
    }`}>
      {/* 成就图标和标题 */}
      <div className="flex items-center space-x-4 mb-4">
        <div className={`w-16 h-16 rounded-full bg-gradient-to-r ${getCategoryColor(achievement.category)} flex items-center justify-center text-2xl ${
          isEarned ? '' : 'grayscale opacity-50'
        }`}>
          {achievement.icon || '🏆'}
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-bold ${isEarned ? 'text-gray-900' : 'text-gray-500'}`}>
            {achievement.name}
          </h3>
          <p className={`text-sm ${isEarned ? 'text-gray-600' : 'text-gray-400'}`}>
            {achievement.description}
          </p>
        </div>
        {isEarned && (
          <div className="text-yellow-500">
            <Trophy className="w-6 h-6" />
          </div>
        )}
      </div>

      {/* 进度条 */}
      {!isEarned && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>进度</span>
            <span>{progress}/{achievement.requirement}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className={`bg-gradient-to-r ${getCategoryColor(achievement.category)} h-2 rounded-full transition-all duration-300`}
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 成就信息 */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className={isEarned ? 'text-gray-700' : 'text-gray-500'}>
              {achievement.points} 积分
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Target className="w-4 h-4 text-blue-500" />
            <span className={isEarned ? 'text-gray-700' : 'text-gray-500'}>
              {achievement.category}
            </span>
          </div>
        </div>
        
        {isEarned && userAchievement && (
          <div className="flex items-center space-x-1 text-green-600">
            <Calendar className="w-4 h-4" />
            <span>{new Date(userAchievement.earned_at).toLocaleDateString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementCard;