import React from 'react';
import { Star, Users, Award, Calendar } from 'lucide-react';
import { Coach } from '../types';

interface CoachCardProps {
  coach: Coach;
}

const CoachCard: React.FC<CoachCardProps> = ({ coach }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6">
      {/* 教练头像和基本信息 */}
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
          <span className="text-white text-xl font-bold">
            {coach.name.charAt(0)}
          </span>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-gray-900">{coach.name}</h3>
          <p className="text-sm text-blue-600 font-medium">{coach.title}</p>
          <div className="flex items-center space-x-1 mt-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-sm text-gray-600">{coach.rating}</span>
          </div>
        </div>
      </div>

      {/* 专长标签 */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {coach.specialties.slice(0, 3).map((specialty, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
            >
              {specialty}
            </span>
          ))}
        </div>
      </div>

      {/* 简介 */}
      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
        {coach.bio}
      </p>

      {/* 统计信息 */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{coach.total_students} 学员</span>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <span className="text-sm text-gray-600">{coach.years_experience} 年经验</span>
        </div>
      </div>

      {/* 成就 */}
      {coach.achievements.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center space-x-1 mb-2">
            <Award className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-700">主要成就</span>
          </div>
          <div className="space-y-1">
            {coach.achievements.slice(0, 2).map((achievement, index) => (
              <div key={index} className="text-xs text-gray-600 flex items-center space-x-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                <span>{achievement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex space-x-2">
        <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors">
          查看详情
        </button>
        <button className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
          关注教练
        </button>
      </div>
    </div>
  );
};

export default CoachCard;