'use client';

import React, { useState, useEffect } from 'react';
import {
    Eye,
    ThumbsUp,
    MessageCircle,
    Clock
} from 'lucide-react';
import ContentEditor from './ContentEditor';
import { CoachContent } from '@/types/coach';
import { coachService } from '../service/coachService';

// PrimeReact imports
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { Card } from 'primereact/card';
import { DataView } from 'primereact/dataview';

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
            const response = await coachService.getContents({
                coachId,
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
            await coachService.publishContent({
                coachId,
                title: contentData.title,
                content: contentData.content,
                content_type: contentData.content_type,
                required_tier: contentData.required_tier,
                is_featured: contentData.is_featured,
                tags: contentData.tags,
                media_urls: contentData.media_urls,
                thumbnail_url: contentData.thumbnail_url,
                isDraft: false,
            });
            setCurrentView('list');
            loadContents(); // 重新加载列表
        } catch (error) {
            throw error; // 让ContentEditor处理错误
        }
    };

    const handleSaveDraft = async (contentData: any) => {
        try {
            await coachService.publishContent({
                coachId,
                title: contentData.title,
                content: contentData.content,
                content_type: contentData.content_type,
                required_tier: contentData.required_tier,
                is_featured: contentData.is_featured,
                tags: contentData.tags,
                media_urls: contentData.media_urls,
                thumbnail_url: contentData.thumbnail_url,
                isDraft: false,
            });
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

    const formatRelativeTime = (dateString: string): string => {
        const date = new Date(dateString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

        if (diffInHours < 1) {
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
            return diffInMinutes < 1 ? '刚刚' : `${diffInMinutes}分钟前`;
        } else if (diffInHours < 24) {
            return `${diffInHours}小时前`;
        } else {
            const diffInDays = Math.floor(diffInHours / 24);
            if (diffInDays < 30) {
                return `${diffInDays}天前`;
            } else {
                return date.toLocaleDateString('zh-CN');
            }
        }
    }

    if (currentView === 'editor') {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                <div className="mb-4 md:mb-6">
                    <Button 
                        icon="pi pi-arrow-left"
                        label="返回内容管理"
                        className="p-button-text"
                        onClick={() => setCurrentView('list')}
                    />
                </div>

                <ContentEditor
                    coachId={coachId}
                    onPublish={handlePublishContent}
                    onSaveDraft={handleSaveDraft}
                />
            </div>
        );
    }

    // 权限过滤选项
    const tierOptions = [
        { label: '所有权限', value: 'all' },
        { label: '免费内容', value: 0 },
        { label: '基础订阅', value: 1 },
        { label: '高级订阅', value: 2 },
        { label: 'VIP专属', value: 3 }
    ];

    // 内容列表项渲染
    const itemTemplate = (content: CoachContent) => {
        return (
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                            <span className="text-lg">{getContentTypeIcon(content.content_type)}</span>
                            <h3 className="text-lg font-semibold text-900">{content.title}</h3>
                            {getTierBadge(content.required_tier)}
                            {content.is_featured && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                    ⭐ 精选
                                </span>
                            )}
                        </div>

                        <p className="text-600 mb-3 line-clamp-2">
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
                                <span>{formatRelativeTime(content.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                        <Button 
                            icon="pi pi-pencil" 
                            className="p-button-rounded p-button-text" 
                            tooltip="编辑"
                        />
                        <Button 
                            icon="pi pi-trash" 
                            className="p-button-rounded p-button-text p-button-danger" 
                            tooltip="删除"
                        />
                        <Button 
                            icon="pi pi-ellipsis-v" 
                            className="p-button-rounded p-button-text" 
                            tooltip="更多"
                        />
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-6xl mx-auto">
            <Card className="shadow-sm">
                {/* 头部 */}
                <div className="border-b border-gray-200 p-4 md:p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-900">内容管理</h1>
                            <p className="text-600 mt-1">管理您发布的所有内容</p>
                        </div>

                        <Button
                            label="发布新内容"
                            icon="pi pi-plus"
                            onClick={() => setCurrentView('editor')}
                        />
                    </div>

                    {/* 搜索和过滤 */}
                    <div className="flex flex-col md:flex-row gap-4 mt-6">
                        <div className="p-input-icon-left flex-1">
                            <InputText
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索内容..."
                                className="w-full"
                            />
                        </div>

                        <Dropdown
                            value={filterTier}
                            options={tierOptions}
                            onChange={(e) => setFilterTier(e.value)}
                            placeholder="选择权限"
                            className="min-w-40"
                        />
                    </div>
                </div>

                {/* 内容列表 */}
                <div className="p-4 md:p-6">
                    {isLoading ? (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="text-600 mt-4">加载中...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-4">{error}</p>
                            <Button
                                label="重新加载"
                                className="p-button-text"
                                onClick={loadContents}
                            />
                        </div>
                    ) : filteredContents.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-600 mb-4">
                                {searchTerm || filterTier !== 'all' ? '没有找到匹配的内容' : '还没有发布任何内容'}
                            </p>
                            {!searchTerm && filterTier === 'all' && (
                                <Button
                                    label="发布第一个内容"
                                    className="p-button-text"
                                    onClick={() => setCurrentView('editor')}
                                />
                            )}
                        </div>
                    ) : (
                        <DataView 
                            value={filteredContents} 
                            itemTemplate={itemTemplate}
                            paginator
                            rows={10}
                        />
                    )}
                </div>
            </Card>
        </div>
    );
};

export default CoachContentManager;