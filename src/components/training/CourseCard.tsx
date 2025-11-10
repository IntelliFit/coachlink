import React from 'react';
import { Play, Clock, Users, Star, DollarSign } from 'lucide-react';
import { Course } from '../types';

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
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
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* 课程缩略图 */}
      <div className="relative h-48 bg-gradient-to-r from-blue-500 to-purple-500">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <Play className="w-8 h-8 text-white" />
          </div>
        </div>
        
        {/* 难度标签 */}
        <div className="absolute top-4 left-4">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(course.difficulty_level)}`}>
            {getDifficultyText(course.difficulty_level)}
          </span>
        </div>

        {/* 价格标签 */}
        <div className="absolute top-4 right-4">
          {course.is_free ? (
            <span className="px-2 py-1 bg-green-500 text-white rounded-full text-xs font-medium">
              免费
            </span>
          ) : (
            <span className="px-2 py-1 bg-white bg-opacity-90 text-gray-900 rounded-full text-xs font-medium">
              ¥{course.price}
            </span>
          )}
        </div>
      </div>

      {/* 课程信息 */}
      <div className="p-6">
        {/* 标题和分类 */}
        <div className="mb-3">
          <h3 className="text-lg font-bold text-gray-900 mb-1">{course.title}</h3>
          <span className="text-sm text-blue-600 font-medium">{course.category}</span>
        </div>

        {/* 描述 */}
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {course.description}
        </p>

        {/* 课程统计 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">{course.duration_minutes}分钟</span>
          </div>
          <div className="flex items-center space-x-1">
            <Users className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-600">{course.enrollment_count}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Star className="w-4 h-4 text-yellow-500 fill-current" />
            <span className="text-xs text-gray-600">{course.rating}</span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex space-x-2">
          <button className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors flex items-center justify-center space-x-1">
            <Play className="w-4 h-4" />
            <span>{course.is_free ? '免费学习' : '立即购买'}</span>
          </button>
          <button className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors">
            <Star className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CourseCard;