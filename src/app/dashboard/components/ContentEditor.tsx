'use client';

import React, { useState } from 'react';
import {
    Save,
    Eye,
    Send,
    Hash,
    Type,
    Image,
    Video,
    Calendar,
    Lock,
    Users,
    Crown,
    Gem
} from 'lucide-react';

// PrimeReact imports
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Card } from 'primereact/card';
import { Chip } from 'primereact/chip';
import { Checkbox } from 'primereact/checkbox';

// 内容类型枚举
export enum ContentTier {
    FREE = 0,
    BASIC = 1,
    PREMIUM = 2,
    VIP = 3
}

// 内容表单接口
interface ContentForm {
    title: string;
    content: string;
    content_type: 'text' | 'video' | 'image' | 'live' | 'plan';
    required_tier: ContentTier;
    is_featured: boolean;
    tags: string[];
    media_urls: string[];
    thumbnail_url?: string;
}

interface ContentEditorProps {
    coachId: string;
    onPublish: (content: ContentForm) => Promise<void>;
    onSaveDraft: (content: ContentForm) => Promise<void>;
    isPublishing?: boolean;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
    coachId,
    onPublish,
    onSaveDraft,
    isPublishing = false
}) => {
    const [form, setForm] = useState<ContentForm>({
        title: '',
        content: '',
        content_type: 'text',
        required_tier: ContentTier.FREE,
        is_featured: false,
        tags: [],
        media_urls: []
    });

    const [currentTag, setCurrentTag] = useState('');
    const [isPreview, setIsPreview] = useState(false);

    // 订阅等级配置
    const tierOptions = [
        { value: ContentTier.FREE, label: '免费内容', icon: Users, color: 'text-green-600', bgColor: 'bg-green-100' },
        { value: ContentTier.BASIC, label: '基础订阅', icon: Lock, color: 'text-blue-600', bgColor: 'bg-blue-100' },
        { value: ContentTier.PREMIUM, label: '高级订阅', icon: Crown, color: 'text-purple-600', bgColor: 'bg-purple-100' },
        { value: ContentTier.VIP, label: 'VIP专属', icon: Gem, color: 'text-amber-600', bgColor: 'bg-amber-100' }
    ];

    const handleInputChange = (field: keyof ContentForm, value: any) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddTag = () => {
        if (currentTag.trim() && !form.tags.includes(currentTag.trim())) {
            setForm(prev => ({
                ...prev,
                tags: [...prev.tags, currentTag.trim()]
            }));
            setCurrentTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setForm(prev => ({
            ...prev,
            tags: prev.tags.filter(tag => tag !== tagToRemove)
        }));
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const handlePublish = async () => {
        if (!form.title.trim() || !form.content.trim()) {
            alert('请填写标题和内容');
            return;
        }

        try {
            await onPublish(form);
            // 重置表单
            setForm({
                title: '',
                content: '',
                content_type: 'text',
                required_tier: ContentTier.FREE,
                is_featured: false,
                tags: [],
                media_urls: []
            });
        } catch (error) {
            console.error('发布失败:', error);
            alert('发布失败，请重试');
        }
    };

    const handleSaveDraft = async () => {
        try {
            await onSaveDraft(form);
            alert('草稿已保存');
        } catch (error) {
            console.error('保存草稿失败:', error);
            alert('保存草稿失败，请重试');
        }
    };

    const selectedTier = tierOptions.find(tier => tier.value === form.required_tier);
    const TierIcon = selectedTier?.icon || Users;

    return (
        <Card className="shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-900">内容发布</h2>
                <div className="flex gap-2">
                    <Button
                        icon={isPreview ? "pi pi-pencil" : "pi pi-eye"}
                        label={isPreview ? '编辑' : '预览'}
                        className="p-button-text"
                        onClick={() => setIsPreview(!isPreview)}
                    />
                </div>
            </div>

            {!isPreview ? (
                // 编辑模式
                <div className="space-y-6">
                    {/* 标题输入 */}
                    <div>
                        <label className="block text-sm font-medium text-700 mb-2">
                            <Type className="w-4 h-4 inline mr-2" />
                            标题
                        </label>
                        <InputText
                            value={form.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="输入一个吸引人的标题..."
                            className="w-full"
                        />
                        <div className="text-right text-xs text-500 mt-1">
                            {form.title.length}/100
                        </div>
                    </div>

                    {/* 内容输入 */}
                    <div>
                        <label className="block text-sm font-medium text-700 mb-2">
                            内容
                        </label>
                        <InputTextarea
                            value={form.content}
                            onChange={(e) => handleInputChange('content', e.target.value)}
                            placeholder="分享你的训练心得、技巧或经验..."
                            rows={8}
                            className="w-full"
                        />
                        <div className="text-right text-xs text-500 mt-1">
                            {form.content.length} 字符
                        </div>
                    </div>

                    {/* 访问权限设置 */}
                    <div>
                        <label className="block text-sm font-medium text-700 mb-3">
                            访问权限
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {tierOptions.map((tier) => {
                                const Icon = tier.icon;
                                const isSelected = form.required_tier === tier.value;

                                return (
                                    <button
                                        key={tier.value}
                                        onClick={() => handleInputChange('required_tier', tier.value)}
                                        className={`p-3 border-2 rounded-lg transition-all cursor-pointer ${isSelected
                                                ? `border-primary ${tier.bgColor}`
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                        type="button"
                                    >
                                        <Icon className={`w-5 h-5 mx-auto mb-2 ${tier.color}`} />
                                        <div className="text-sm font-medium text-900">{tier.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 标签输入 */}
                    <div>
                        <label className="block text-sm font-medium text-700 mb-2">
                            <Hash className="w-4 h-4 inline mr-2" />
                            标签
                        </label>
                        <div className="flex gap-2 mb-3">
                            <InputText
                                value={currentTag}
                                onChange={(e) => setCurrentTag(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="添加标签..."
                                className="flex-1"
                            />
                            <Button
                                label="添加"
                                onClick={handleAddTag}
                                disabled={!currentTag.trim()}
                            />
                        </div>

                        {/* 标签列表 */}
                        {form.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {form.tags.map((tag, index) => (
                                    <Chip 
                                        key={index} 
                                        label={`#${tag}`} 
                                        removable
                                        className="bg-primary-100 text-primary-800"
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 其他设置 */}
                    <div className="flex items-center">
                        <Checkbox
                            inputId="featured"
                            checked={form.is_featured}
                            onChange={(e) => handleInputChange('is_featured', e.checked)}
                        />
                        <label htmlFor="featured" className="ml-2 text-sm text-700">
                            设为精选内容
                        </label>
                    </div>
                </div>
            ) : (
                // 预览模式
                <div className="space-y-6">
                    <Card className="border-200">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                            <h3 className="text-xl font-bold text-900">{form.title || '未输入标题'}</h3>
                            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${selectedTier?.bgColor}`}>
                                <TierIcon className={`w-4 h-4 ${selectedTier?.color}`} />
                                <span className={`text-sm font-medium ${selectedTier?.color}`}>
                                    {selectedTier?.label}
                                </span>
                            </div>
                        </div>

                        <div className="text-700 whitespace-pre-wrap mb-4">
                            {form.content || '未输入内容'}
                        </div>

                        {form.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-4">
                                {form.tags.map((tag, index) => (
                                    <span
                                        key={index}
                                        className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded"
                                    >
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        )}

                        {form.is_featured && (
                            <div className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-sm rounded">
                                ⭐ 精选内容
                            </div>
                        )}
                    </Card>
                </div>
            )}

            {/* 底部操作按钮 */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mt-8 pt-6 border-t border-gray-200">
                <div className="text-sm text-500">
                    {form.required_tier === ContentTier.FREE ? '所有人可见' : `${selectedTier?.label}可见`}
                </div>

                <div className="flex gap-2">
                    <Button
                        icon="pi pi-save"
                        label="保存草稿"
                        className="p-button-text"
                        onClick={handleSaveDraft}
                        disabled={isPublishing}
                    />

                    <Button
                        icon="pi pi-send"
                        label={isPublishing ? '发布中...' : '立即发布'}
                        onClick={handlePublish}
                        disabled={isPublishing || !form.title.trim() || !form.content.trim()}
                    />
                </div>
            </div>
        </Card>
    );
};

export default ContentEditor;