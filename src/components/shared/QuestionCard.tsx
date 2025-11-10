import React from 'react';
import { MessageCircle, Clock, Tag, CheckCircle, User } from 'lucide-react';
import { Question } from '../types';

interface QuestionCardProps {
    question: Question;
    onView?: () => void;
}

const QuestionCard: React.FC<QuestionCardProps> = ({ question, onView }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'answered': return 'bg-green-100 text-green-700';
            case 'pending': return 'bg-yellow-100 text-yellow-700';
            case 'closed': return 'bg-gray-100 text-gray-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'answered': return '已回答';
            case 'pending': return '待回答';
            case 'closed': return '已关闭';
            default: return '未知';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - date.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) return '今天';
        if (diffDays === 2) return '昨天';
        if (diffDays <= 7) return `${diffDays - 1}天前`;
        return date.toLocaleDateString();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 cursor-pointer" onClick={onView}>
            {/* 问题头部 */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">{question.title}</h3>
                    <p className="text-gray-600 text-sm line-clamp-3">{question.content}</p>
                </div>
                <div className="ml-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(question.status)}`}>
                        {getStatusText(question.status)}
                    </span>
                </div>
            </div>

            {/* 问题信息 */}
            <div className="flex items-center justify-between text-sm text-gray-500">
                <div className="flex items-center space-x-4">
                    {question.category && (
                        <div className="flex items-center space-x-1">
                            <Tag className="w-4 h-4" />
                            <span>{question.category}</span>
                        </div>
                    )}
                    <div className="flex items-center space-x-1">
                        <Clock className="w-4 h-4" />
                        <span>{formatDate(question.created_at)}</span>
                    </div>
                    {question.is_public && (
                        <div className="flex items-center space-x-1">
                            <User className="w-4 h-4" />
                            <span>公开</span>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-1">
                    <MessageCircle className="w-4 h-4" />
                    <span>查看详情</span>
                </div>
            </div>
        </div>
    );
};

export default QuestionCard;