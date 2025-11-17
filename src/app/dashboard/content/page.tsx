'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import {
    Eye, ThumbsUp, MessageCircle, Clock,
} from 'lucide-react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import ContentEditor from '@/app/dashboard/components/ContentEditor';
import { coachService } from '@/app/service/coachService';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { CoachContentRow } from '@/types';

const Content = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    const [contents, setContents] = useState<CoachContentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<'list' | 'editor'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTier, setFilterTier] = useState<number | 'all'>('all');

    // 加载内容
    useEffect(() => {
        if (!coach?.id) return;
        loadContents();
    }, [coach?.id]);

    const loadContents = async () => {
        setLoading(true);
        setError(null);

        const res = await coachService.getContents({
            coachId: coach.id,
            limit: 50,
            offset: 0,
        });

        if (res) {
            setContents(res.contents || []);
        } else {
            setError('加载内容失败，请重试');
        }

        setLoading(false);
    };

    const handlePublishContent = async (contentData: any) => {
        await coachService.publishContent({
            coachId: coach.id,
            ...contentData,
            isDraft: false,
        });
        setCurrentView('list');
        loadContents();
    };

    const handleSaveDraft = async (contentData: any) => {
        await coachService.publishContent({
            coachId: coach.id,
            ...contentData,
            isDraft: true,
        });
    };

    const getTierBadge = (tier: number) => {
        const configs = {
            0: { label: '免费', color: 'bg-green-100 text-green-800' },
            1: { label: '基础', color: 'bg-blue-100 text-blue-800' },
            2: { label: '高级', color: 'bg-purple-100 text-purple-800' },
            3: { label: 'VIP', color: 'bg-amber-100 text-amber-800' },
        };
        const config = configs[tier as keyof typeof configs] || configs[0];
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
                {config.label}
            </span>
        );
    };

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const mins = Math.floor(diff / 60000);
        const hours = Math.floor(mins / 60);
        const days = Math.floor(hours / 24);
        if (mins < 1) return '刚刚';
        if (hours < 1) return `${mins}分钟前`;
        if (hours < 24) return `${hours}小时前`;
        if (days < 30) return `${days}天前`;
        return date.toLocaleDateString('zh-CN');
    };

    const filteredContents = contents.filter(content => {
        const matchesSearch =
            content.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            content.content.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = filterTier === 'all' || content.required_tier === filterTier;
        return matchesSearch && matchesTier;
    });

    if (currentView === 'editor') {
        return (
            <div className="max-w-6xl mx-auto p-4 md:p-6">
                <Button
                    icon="pi pi-arrow-left"
                    label="返回内容管理"
                    className="p-button-text mb-4"
                    onClick={() => setCurrentView('list')}
                />
                <ContentEditor
                    coachId={coach.id}
                    onPublish={handlePublishContent}
                    onSaveDraft={handleSaveDraft}
                />
            </div>
        );
    }

    const tierOptions = [
        { label: '所有权限', value: 'all' },
        { label: '免费内容', value: 0 },
        { label: '基础订阅', value: 1 },
        { label: '高级订阅', value: 2 },
        { label: 'VIP专属', value: 3 },
    ];

    return (
        <div className="max-w-6xl mx-auto">
            <Card className="shadow-sm">
                {/* 顶部区域 */}
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

                    <div className="flex flex-col md:flex-row gap-4 mt-6">
                        <IconField iconPosition="left" className='w-full'>
                            <InputIcon className="pi pi-search"> </InputIcon>
                            <InputText
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="搜索内容..."
                                className="w-full"
                            />
                        </IconField>
                        <Dropdown
                            value={filterTier}
                            options={tierOptions}
                            onChange={(e) => setFilterTier(e.value)}
                            className="min-w-40"
                        />
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="p-4 md:p-6">
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3, 4, 5, 6].map(i => (
                                <div key={i} className="border rounded-lg p-4">
                                    <Skeleton width="100%" height="8rem" className="mb-4" />
                                    <Skeleton width="80%" height="1.25rem" className="mb-2" />
                                    <Skeleton width="60%" height="1rem" className="mb-3" />
                                    <div className="flex justify-between mt-4">
                                        <Skeleton width="4rem" height="2rem" />
                                        <Skeleton width="4rem" height="2rem" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <p className="text-red-500 mb-4">{error}</p>
                            <Button label="重新加载" className="p-button-text" onClick={loadContents} />
                        </div>
                    ) : filteredContents.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-600 mb-4">暂无内容</p>
                            <Button
                                label="发布第一个内容"
                                className="p-button-text"
                                onClick={() => setCurrentView('editor')}
                            />
                        </div>
                    ) : (
                        <DataView
                            value={filteredContents}
                            itemTemplate={(content) => (
                                <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center space-x-3 mb-2">
                                                <h3 className="text-lg font-semibold">{content.title}</h3>
                                                {getTierBadge(content.required_tier)}
                                            </div>
                                            <p className="text-600 mb-3 line-clamp-2">
                                                {content.content.length > 100
                                                    ? content.content.slice(0, 100) + '...'
                                                    : content.content}
                                            </p>
                                            <div className="flex items-center space-x-6 text-sm text-gray-500">
                                                <div className="flex items-center space-x-1"><Eye className="w-4 h-4" /><span>{content.views_count}</span></div>
                                                <div className="flex items-center space-x-1"><ThumbsUp className="w-4 h-4" /><span>{content.likes_count}</span></div>
                                                <div className="flex items-center space-x-1"><MessageCircle className="w-4 h-4" /><span>{content.comments_count}</span></div>
                                                <div className="flex items-center space-x-1"><Clock className="w-4 h-4" /><span>{formatRelativeTime(content.created_at)}</span></div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-2 ml-4">
                                            <Button icon="pi pi-pencil" className="p-button-rounded p-button-text" tooltip="编辑" />
                                            <Button icon="pi pi-trash" className="p-button-rounded p-button-text p-button-danger" tooltip="删除" />
                                        </div>
                                    </div>
                                </div>
                            )}
                            paginator
                            rows={9}
                        />
                    )}
                </div>
            </Card>
        </div>
    );
};

export default Content;
