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
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">内容发布</h2>
                <div className="flex space-x-3">
                    <button
                        onClick={() => setIsPreview(!isPreview)}
                        className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                        <Eye className="w-4 h-4" />
                        <span>{isPreview ? '编辑' : '预览'}</span>
                    </button>
                </div>
            </div>

            {!isPreview ? (
                // 编辑模式
                <div className="space-y-6">
                    {/* 标题输入 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Type className="w-4 h-4 inline mr-2" />
                            标题
                        </label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="输入一个吸引人的标题..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            maxLength={100}
                        />
                        <div className="text-right text-xs text-gray-500 mt-1">
                            {form.title.length}/100
                        </div>
                    </div>

                    {/* 内容输入 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            内容
                        </label>
                        <textarea
                            value={form.content}
                            onChange={(e) => handleInputChange('content', e.target.value)}
                            placeholder="分享你的训练心得、技巧或经验..."
                            rows={8}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        />
                        <div className="text-right text-xs text-gray-500 mt-1">
                            {form.content.length} 字符
                        </div>
                    </div>

                    {/* 访问权限设置 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
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
                                        className={`p-3 border-2 rounded-lg transition-all ${isSelected
                                                ? `border-blue-500 ${tier.bgColor}`
                                                : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                    >
                                        <Icon className={`w-5 h-5 mx-auto mb-2 ${tier.color}`} />
                                        <div className="text-sm font-medium text-gray-900">{tier.label}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 标签输入 */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            <Hash className="w-4 h-4 inline mr-2" />
                            标签
                        </label>
                        <div className="flex space-x-2 mb-3">
                            <input
                                type="text"
                                value={currentTag}
                                onChange={(e) => setCurrentTag(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="添加标签..."
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                maxLength={20}
                            />
                            <button
                                onClick={handleAddTag}
                                disabled={!currentTag.trim()}
                                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                添加
                            </button>
                        </div>

                        {/* 标签列表 */}
                        {form.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {form.tags.map((tag, index) => (
                                    <span
                                        key={index}
                                        className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full"
                                    >
                                        #{tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="ml-2 text-blue-600 hover:text-blue-800"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 其他设置 */}
                    <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={form.is_featured}
                                onChange={(e) => handleInputChange('is_featured', e.target.checked)}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">设为精选内容</span>
                        </label>
                    </div>
                </div>
            ) : (
                // 预览模式
                <div className="space-y-6">
                    <div className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">{form.title || '未输入标题'}</h3>
                            <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${selectedTier?.bgColor}`}>
                                <TierIcon className={`w-4 h-4 ${selectedTier?.color}`} />
                                <span className={`text-sm font-medium ${selectedTier?.color}`}>
                                    {selectedTier?.label}
                                </span>
                            </div>
                        </div>

                        <div className="text-gray-700 whitespace-pre-wrap mb-4">
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
                    </div>
                </div>
            )}

            {/* 底部操作按钮 */}
            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200">
                <div className="text-sm text-gray-500">
                    {form.required_tier === ContentTier.FREE ? '所有人可见' : `${selectedTier?.label}可见`}
                </div>

                <div className="flex space-x-3">
                    <button
                        onClick={handleSaveDraft}
                        disabled={isPublishing}
                        className="flex items-center space-x-2 px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        <span>保存草稿</span>
                    </button>

                    <button
                        onClick={handlePublish}
                        disabled={isPublishing || !form.title.trim() || !form.content.trim()}
                        className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Send className="w-4 h-4" />
                        <span>{isPublishing ? '发布中...' : '立即发布'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ContentEditor;