'use client';

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Edit,
    Trash2,
    Eye,
    ThumbsUp,
    MessageCircle,
    Clock,
    Filter,
    Search,
    MoreHorizontal
} from 'lucide-react';
import ContentEditor, { ContentTier } from '../content/ContentEditor';

interface CoachContentManagerProps {
    coachId: string;
    coachName: string;
}

const CoachContentManager: React.FC<CoachContentManagerProps> = ({
    coachId,
    coachName
}) => {
    const [currentView, setCurrentView] = useState<'list' | 'editor'>('list');
    const [contents, setContents] = useState<CoachContent[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTier, setFilterTier] = useState<number | 'all'>('all');

    // 加载内容列表
    useEffect(() => {
        loadContents();
    }, [coachId]);

    const loadContents = async () => {
        setIsLoading(true);
        setError(null);

        try {
            // 获取当前用户ID（这里需要从全局状态或context获取）
            const currentUserId = localStorage.getItem('current_user_id') || '';

            const response = await contentService.getCoachContent({
                coachId,
                userId: currentUserId, // 当前查看者的用户ID
                limit: 50,
                offset: 0
            });

            setContents(response.contents);
        } catch (error) {
            console.error('加载内容失败:', error);
            setError('加载内容失败，请重试');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePublishContent = async (contentData: any) => {
        try {
            await contentService.publishContent(coachId, contentData);
            setCurrentView('list');
            loadContents(); // 重新加载列表
        } catch (error) {
            throw error; // 让ContentEditor处理错误
        }
    };

    const handleSaveDraft = async (contentData: any) => {
        try {
            await contentService.saveDraft(coachId, contentData);
        } catch (error) {
            throw error; // 让ContentEditor处理错误
        }
    };

    // 过滤内容
    const filteredContents = contents.filter(content => {
        const matchesSearch = content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            content.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = filterTier === 'all' || content.required_tier === filterTier;
        return matchesSearch && matchesTier;
    });

    const getContentTypeIcon = (type: string) => {
        switch (type) {
            case 'video':
                return '🎥';
            case 'image':
                return '🖼️';
            case 'plan':
                return '📋';
            case 'live':
                return '🔴';
            default:
                return '📝';
        }
    };

    const getTierBadge = (tier: number) => {
        const configs = {
            0: { label: '免费', color: 'bg-green-100 text-green-800' },
            1: { label: '基础', color: 'bg-blue-100 text-blue-800' },
            2: { label: '高级', color: 'bg-purple-100 text-purple-800' },
            3: { label: 'VIP', color: 'bg-amber-100 text-amber-800' }
        };

        const config = configs[tier as keyof typeof configs] || configs[0];

        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                {config.label}
            </span>
        );
    };

    if (currentView === 'editor') {
        return (
            <div className="max-w-6xl mx-auto p-6">
                <div className="mb-6">
                    <button
                        onClick={() => setCurrentView('list')}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                        ← 返回内容管理
                    </button>
                </div>

                <ContentEditor
                    coachId={coachId}
                    onPublish={handlePublishContent}
                    onSaveDraft={handleSaveDraft}
                />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                {/* 头部 */}
                <div className="border-b border-gray-200 p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">内容管理</h1>
                            <p className="text-gray-500 mt-1">管理您发布的所有内容</p>
                        </div>

                        <button
                            onClick={() => setCurrentView('editor')}
                            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            <Plus className="w-4 h-4" />
                            <span>发布新内容</span>
                        </button>
                    </div>

                    {/* 搜索和过滤 */}
                    <div className="flex space-x-4 mt-6">
                        <div className="flex-1 relative">
                            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索内容..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>

                        <select
                            value={filterTier}
                            onChange={(e) => setFilterTier(e.target.value === 'all' ? 'all' : parseInt(e.target.value))}
                            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="all">所有权限</option>
                            <option value={0}>免费内容</option>
                            <option value={1}>基础订阅</option>
                            <option value={2}>高级订阅</option>
                            <option value={3}>VIP专属</option>
                        </select>
                    </div>
                </div>

                {/* 内容列表 */}
                <div className="p-6">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="text-gray-500 mt-4">加载中...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={loadContents}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                重新加载
                            </button>
                        </div>
                    ) : filteredContents.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 mb-4">
                                {searchTerm || filterTier !== 'all' ? '没有找到匹配的内容' : '还没有发布任何内容'}
                            </p>
                            {!searchTerm && filterTier === 'all' && (
                                <button
                                    onClick={() => setCurrentView('editor')}
                                    className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                    发布第一个内容
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredContents.map((content) => (
                                <div key={content.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <span className="text-lg">{getContentTypeIcon(content.content_type)}</span>
                                                <h3 className="text-lg font-semibold text-gray-900">{content.title}</h3>
                                                {getTierBadge(content.required_tier)}
                                                {content.is_featured && (
                                                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                                        ⭐ 精选
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-gray-600 mb-3 line-clamp-2">
                                                {content.content.length > 100
                                                    ? content.content.substring(0, 100) + '...'
                                                    : content.content
                                                }
                                            </p>

                                            {/* 标签 */}
                                            {content.tags.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mb-3">
                                                    {content.tags.slice(0, 4).map((tag, index) => (
                                                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                    {content.tags.length > 4 && (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                                                            +{content.tags.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                                                <div className="flex items-center space-x-1">
                                                    <Eye className="w-4 h-4" />
                                                    <span>{content.views_count}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <ThumbsUp className="w-4 h-4" />
                                                    <span>{content.likes_count}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <MessageCircle className="w-4 h-4" />
                                                    <span>{content.comments_count}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{contentService.formatRelativeTime(content.created_at)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center space-x-2 ml-4">
                                            <button
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                                title="编辑"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-gray-100"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                                title="更多"
                                            >
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoachContentManager;