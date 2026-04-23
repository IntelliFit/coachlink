'use client';

import React, { useState, useEffect } from 'react';
import {
    Hash, Type, Users, Lock, Crown, Gem, Eye, Pencil, Send, Save, Star, DollarSign
} from 'lucide-react';

// PrimeReact imports
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputNumber } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';
import { Chip } from 'primereact/chip';
import { Checkbox } from 'primereact/checkbox';
import { useToastContext } from '@/context/ToastContext';
import { CoachContentColumnRow, CoachContentRow } from '@/types';
import RichTextEditor from '@/components/RichTextEditor';

export enum ContentTier { FREE = 0, BASIC = 1, PREMIUM = 2, VIP = 3 }

interface ContentForm {
    title: string;
    content: string;
    content_type: 'text' | 'video' | 'image' | 'live' | 'plan';
    column_id?: string | null;
    column_sort_order?: number | null;
    required_tier: ContentTier;
    price_cents?: number;
    is_featured: boolean;
    tags: string[];
    media_urls: string[];
    thumbnail_url?: string;
    notifyAllStudents?: boolean;
}

interface ContentEditorProps {
    coachId: string;
    onPublish: (content: ContentForm) => Promise<void>;
    onSaveDraft: (content: ContentForm) => Promise<void>;
    initialContent?: CoachContentRow | null;
    columns?: CoachContentColumnRow[];
    onManageColumns?: () => void;
    columnToSelectId?: string | null;
    onColumnSelectionConsumed?: () => void;
}

const ContentEditor: React.FC<ContentEditorProps> = ({
    coachId,
    onPublish,
    onSaveDraft,
    initialContent = null,
    columns = [],
    onManageColumns,
    columnToSelectId = null,
    onColumnSelectionConsumed,
}) => {
    const [form, setForm] = useState<ContentForm>({
        title: '', content: '', content_type: 'text', column_id: null, column_sort_order: null, required_tier: ContentTier.FREE,
        is_featured: false, tags: [], media_urls: [], notifyAllStudents: false, price_cents: 0
    });
    const [currentTag, setCurrentTag] = useState('');
    const [isPreview, setIsPreview] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const { showToast } = useToastContext();

    const tierOptions = [
        { value: ContentTier.FREE, label: '所有人', icon: Users, color: 'text-green-600', bgColor: 'bg-green-50' },
        { value: ContentTier.BASIC, label: '仅订阅', icon: Lock, color: 'text-primary-600', bgColor: 'bg-primary-50' },
    ];

    useEffect(() => {
        if (initialContent) {
            setForm({
                title: initialContent.title,
                content: initialContent.content,
                content_type: (initialContent.content_type as any) || 'text',
                column_id: (initialContent as any).column_id || null,
                column_sort_order: (initialContent as any).column_sort_order ?? null,
                required_tier: initialContent.required_tier,
                is_featured: initialContent.is_featured || false,
                tags: initialContent.tags || [],
                media_urls: initialContent.media_urls || [],
                price_cents: (initialContent as any).price_cents ?? 0
            });
        }
    }, [initialContent]);

    useEffect(() => {
        if (!columnToSelectId) return;
        if (!columns.some((column) => column.id === columnToSelectId)) return;

        setForm((prev) => ({ ...prev, column_id: columnToSelectId }));
        onColumnSelectionConsumed?.();
    }, [columnToSelectId, columns, onColumnSelectionConsumed]);

    const columnOptions = [
        { label: '闲散文章（不属于任何专栏）', value: null },
        ...columns.map((column) => ({ label: column.name, value: column.id })),
    ];

    const handleInputChange = (field: keyof ContentForm, value: any) => {
        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleAddTag = () => {
        if (currentTag.trim() && !form.tags.includes(currentTag.trim())) {
            setForm(prev => ({ ...prev, tags: [...prev.tags, currentTag.trim()] }));
            setCurrentTag('');
        }
    };

    const handlePublish = async () => {
        setIsPublishing(true);
        try {
            await onPublish(form);
        } catch (error) {
            showToast({ severity: 'error', summary: '发布失败' });
        } finally {
            setIsPublishing(false);
        }
    };

        const handleSaveDraft = async () => {
        try {
            await onSaveDraft(form);
            showToast({
                severity: 'success',
                summary: '草稿已保存'
            })
        } catch (error) {
            console.error('保存草稿失败:', error);
            showToast({
                severity: 'error',
                summary: '保存草稿失败，请重试'
            })
        }
    };

    const selectedTier = tierOptions.find(t => t.value === form.required_tier);
    const TierIcon = selectedTier?.icon || Users;
    const priceYuan = form.price_cents ? (form.price_cents / 100).toFixed(2) : '0.00';

    return (
        <div className="bg-transparent space-y-10 py-6">
            {/* Header Area */}
            <div className="flex items-center justify-between px-2">
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-surface-900">创作中心</h2>
                    <p className="text-sm text-surface-400 font-medium">编辑并分发您的专业健身见解</p>
                </div>
                <Button
                    icon={isPreview ? <Pencil size={18} /> : <Eye size={18} />}
                    label={isPreview ? '继续编辑' : '效果预览'}
                    onClick={() => setIsPreview(!isPreview)}
                    className="p-button-text p-button-secondary rounded-xl active:scale-95 transition-all font-bold text-sm"
                />
            </div>

            {!isPreview ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
                    {/* Title Input */}
                    <div className="group space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400 px-1">
                            <Type size={14} /> 标题内容
                        </label>
                        <InputText
                            value={form.title}
                            onChange={(e) => handleInputChange('title', e.target.value)}
                            placeholder="输入标题..."
                            className="w-full border-none bg-surface-50/50 focus:bg-white focus:ring-2 focus:ring-primary-100 rounded-2xl py-4 text-lg font-bold tracking-tight transition-all"
                        />
                    </div>

                    {/* Column Selection */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 px-1">
                            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400">
                                内容归属
                            </label>
                            <button
                                type="button"
                                onClick={onManageColumns}
                                className="text-xs font-bold text-primary-600 hover:text-primary-700"
                            >
                                管理 / 新建专栏
                            </button>
                        </div>
                        <Dropdown
                            value={form.column_id ?? null}
                            options={columnOptions}
                            onChange={(e) => handleInputChange('column_id', e.value)}
                            placeholder="选择专栏或保持为闲散文章"
                            className="w-full border-surface-100 bg-surface-50/30 rounded-2xl"
                        />
                        <p className="text-xs text-surface-400 px-1">
                            不选专栏时，这篇会作为“闲散文章”展示；需要新专栏时先进入专栏管理创建。
                        </p>
                    </div>

                    {/* Content Editor Area - Rich Text Editor */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400 px-1">
                            正文叙述
                        </label>
                        <RichTextEditor
                            content={form.content}
                            onChange={(content) => handleInputChange('content', content)}
                            placeholder="在这里分享您的训练心得..."
                        />
                    </div>

                    {/* Tier Selection - 已隐藏，代码保留供后续使用 */}
                    {/**
                     * <div className="space-y-4">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400 px-1">
                            可见范围
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {tierOptions.map((tier) => {
                                const Icon = tier.icon;
                                const isSelected = form.required_tier === tier.value;
                                return (
                                    <button
                                        key={tier.value}
                                        onClick={() => handleInputChange('required_tier', tier.value)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 active:scale-95 ${
                                            isSelected 
                                            ? `border-primary bg-primary-50/30 ring-4 ring-primary-50` 
                                            : 'border-surface-100 bg-white hover:border-surface-200'
                                        }`}
                                    >
                                        <Icon size={20} className={`mb-2 ${isSelected ? 'text-primary' : 'text-surface-300'}`} />
                                        <span className={`text-xs font-bold tracking-tight ${isSelected ? 'text-primary' : 'text-surface-600'}`}>
                                            {tier.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                     */}

                    {/* Price Input */}
                    <div className="space-y-2">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400 px-1">
                            <DollarSign size={14} /> 单篇价格（元）
                        </label>
                        <div className="flex items-center gap-3">
                            <InputNumber
                                value={form.price_cents ? form.price_cents / 100 : 0}
                                onValueChange={(e) => {
                                    const yuan = e.value ?? 0;
                                    handleInputChange('price_cents', Math.max(0, Math.floor(yuan * 100)));
                                }}
                                mode="decimal"
                                min={0}
                                max={9999.99}
                                step={0.01}
                                suffix=" 元"
                                placeholder="0.00"
                                className="flex-1 border-none bg-surface-50/50 focus:bg-white focus:ring-2 focus:ring-primary-100 rounded-2xl py-3 transition-all"
                            />
                            <div className="text-xs text-surface-500 font-medium">
                                {form.price_cents && form.price_cents > 0 ? (
                                    <span className="text-amber-600 font-bold">付费内容 ¥{priceYuan}</span>
                                ) : (
                                    <span className="text-green-600 font-bold">免费内容</span>
                                )}
                            </div>
                        </div>
                        <p className="text-xs text-surface-400 px-1">
                            设置单篇购买价格。0 元表示免费，用户无需支付即可阅读。已订阅该教练的用户可免费阅读所有内容。
                        </p>
                    </div>

                    {/* Tags & Settings */}
                    <div className="grid md:grid-cols-2 gap-8 items-start">
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400 px-1">
                                <Hash size={14} /> 标签索引
                            </label>
                            <div className="flex gap-2">
                                <InputText
                                    value={currentTag}
                                    onChange={(e) => setCurrentTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                                    placeholder="输入后回车..."
                                    className="flex-1 border-surface-100 bg-surface-50/30 rounded-xl"
                                />
                                <Button label="添加" onClick={handleAddTag} className="p-button-secondary p-button-outlined rounded-xl" />
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {form.tags.map((tag, i) => (
                                    <Chip key={i} label={`# ${tag}`} removable onRemove={() => {
                                        handleInputChange('tags', form.tags.filter(t => t !== tag));
                                        return true;
                                    }} className="bg-primary-50 text-primary-600 font-bold border-none" />
                                ))}
                            </div>
                        </div>

                        {/* Featured Checkbox */}
                        <div className="space-y-4">
                            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-surface-400 px-1">
                                <Star size={14} /> 推荐设置
                            </label>
                            <div className="flex items-center gap-3 p-4 bg-amber-50/30 border border-amber-100 rounded-xl">
                                <Checkbox
                                    inputId="featured"
                                    checked={form.is_featured}
                                    onChange={(e) => handleInputChange('is_featured', e.checked || false)}
                                />
                                <label htmlFor="featured" className="flex-1 cursor-pointer select-none">
                                    <div className="font-bold text-sm text-surface-900">设为精选内容</div>
                                    <div className="text-xs text-surface-500 mt-0.5">精选内容将在列表顶部展示</div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Preview Mode - Aero Depth Style */
                <div className="animate-in fade-in zoom-in-95 duration-500">
                    <div className="bg-white border border-surface-100 rounded-[32px] p-8 shadow-sm">
                        <div className="flex items-center gap-3 mb-6">
                            <div className={`px-3 py-1 rounded-full flex items-center gap-2 ${selectedTier?.bgColor}`}>
                                <TierIcon size={14} className={selectedTier?.color} />
                                <span className={`text-[10px] font-black uppercase tracking-widest ${selectedTier?.color}`}>
                                    {selectedTier?.label}
                                </span>
                            </div>
                            {form.is_featured && <span className="bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1"><Star size={12} fill="currentColor" /> 精选</span>}
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-surface-900 mb-6 leading-tight">
                            {form.title || '标题预留位'}
                        </h1>
                        {/* 预览模式 - 完整Markdown和表格支持 */}
                        <div 
                            className="prose prose-lg max-w-none text-surface-600 leading-relaxed mb-10 prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-table:border-collapse prose-table:w-full prose-th:bg-surface-100 prose-th:font-bold prose-th:border prose-th:border-surface-300 prose-th:px-4 prose-th:py-2 prose-td:border prose-td:border-surface-300 prose-td:px-4 prose-td:py-2"
                            dangerouslySetInnerHTML={{ 
                                __html: form.content || '<p class="text-surface-400 italic">您还没有输入正文...</p>' 
                            }}
                        />

                        <div className="flex flex-wrap gap-2 pt-6 border-t border-surface-50">
                            {form.tags.map((tag, i) => (
                                <span key={i} className="text-primary font-bold text-sm">#{tag}</span>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Actions - Floating Visual Style */}
            <footer className="flex items-center justify-between pt-8 border-t border-surface-100/60">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Checkbox
                            inputId="notifyAll"
                            checked={form.notifyAllStudents || false}
                            onChange={(e) => handleInputChange('notifyAllStudents', e.checked)}
                            className="border-surface-200"
                        />
                        <label 
                            htmlFor="notifyAll" 
                            className="text-sm font-medium text-surface-600 cursor-pointer select-none flex items-center gap-1"
                        >
                            <Users size={16} className="text-primary-500" />
                            <span>@全体学员</span>
                            <span className="text-xs text-surface-400">(发布时推送消息给所有订阅学员)</span>
                        </label>
                    </div>
                </div>

                <div className="flex gap-4">
                    <Button
                        label="保存草稿"
                        icon={<Save size={18} className="mr-2" />}
                        onClick={handleSaveDraft}
                        disabled={isPublishing}
                        className="p-button-text p-button-secondary rounded-2xl px-6 active:scale-95 transition-all font-bold"
                    />
                    <Button
                        label={initialContent ? "更新发布" : "立即发布"}
                        icon={<Send size={18} className="mr-2" />}
                        loading={isPublishing}
                        onClick={handlePublish}
                        disabled={isPublishing || !form.title.trim() || !form.content.trim()}
                        className="p-button-primary rounded-2xl px-10 py-4 shadow-lg shadow-primary-100 active:scale-95 transition-all font-black uppercase tracking-wider"
                    />
                </div>
            </footer>
        </div>
    );
};

export default ContentEditor;
