'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Tag, Save, Send } from 'lucide-react';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Chip } from 'primereact/chip';
import RichTextEditor from '@/components/RichTextEditor';

const AERO_CONTAINER = 'max-w-4xl mx-auto px-4';
const AERO_CARD =
    'rounded-3xl border border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 shadow-[0_1px_0_rgba(15,23,42,0.02)]';

export default function KnowledgeWritePage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const bodyRegion = searchParams.get('body_region');
    const lockedTag = useMemo(() => searchParams.get('tag') || '', [searchParams]);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [extraTag, setExtraTag] = useState('');
    const [savingDraft, setSavingDraft] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // 初始化标签：锁定当前肌肉标签为第一个且不可删除
    useEffect(() => {
        if (lockedTag && !tags.includes(lockedTag)) {
            setTags((prev) => [lockedTag, ...prev.filter((t) => t !== lockedTag)]);
        }
    }, [lockedTag, tags]);

    const handleAddExtraTag = () => {
        const v = extraTag.trim();
        if (!v) return;
        if (v === lockedTag) {
            setExtraTag('');
            return;
        }
        if (!tags.includes(v)) {
            setTags((prev) => [...prev, v]);
        }
        setExtraTag('');
    };

    const canSubmit = title.trim() && content.trim();

    const persistNode = async (options: { asDraft: boolean }) => {
        const payload: any = {
            title: title.trim(),
            description: description.trim(),
            content,
            node_type: 'article',
            body_region: bodyRegion ? [bodyRegion] : [],
            is_free: true,
        };

        // 目前后端没有 tags 字段，这里只在前端用于显示，不入库
        // 如需落库，可以后续在 knowledge_nodes 上增加 tags 列，再一并写入

        const res = await fetch('/api/knowledge/nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            throw new Error('创建知识条目失败');
        }

        const data = await res.json();
        return data?.node?.id as string | undefined;
    };

    const handleSaveDraft = async () => {
        if (!canSubmit) return;
        setSavingDraft(true);
        try {
            await persistNode({ asDraft: true });
            router.back();
        } catch (e) {
            console.error(e);
        } finally {
            setSavingDraft(false);
        }
    };

    const handlePublish = async () => {
        if (!canSubmit) return;
        setPublishing(true);
        try {
            const id = await persistNode({ asDraft: false });
            if (id) {
                router.push(`/dashboard/knowledge/nodes/${id}`);
            } else {
                router.back();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface-50 dark:bg-surface-950 pb-24">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 dark:from-primary-900/20 to-transparent" />

            <div className="relative z-10">
                <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-1 text-surface-500 hover:text-surface-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">返回</span>
                        </button>

                        <div className="flex gap-3">
                            <Button
                                label="保存草稿"
                                icon={<Save className="w-4 h-4 mr-2" />}
                                disabled={!canSubmit || savingDraft || publishing}
                                loading={savingDraft}
                                onClick={handleSaveDraft}
                                className="p-button-text p-button-secondary rounded-xl px-5"
                            />
                            <Button
                                label="发布文章"
                                icon={<Send className="w-4 h-4 mr-2" />}
                                disabled={!canSubmit || publishing}
                                loading={publishing}
                                onClick={handlePublish}
                                className="p-button-primary rounded-xl px-6 font-bold"
                            />
                        </div>
                    </div>

                    <h1 className="text-xl font-bold tracking-tight text-surface-900 dark:text-surface-0">
                        撰写知识文章
                    </h1>
                    {lockedTag && (
                        <p className="text-xs text-surface-500 mt-1">
                            固定标签：<span className="font-semibold text-primary-600">{lockedTag}</span>
                        </p>
                    )}
                </div>

                <div className={AERO_CONTAINER}>
                    <div className={`${AERO_CARD} p-6 space-y-6`}>
                        {/* 标题 */}
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                标题
                            </label>
                            <InputText
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="输入文章标题"
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-surface-0"
                            />
                        </div>

                        {/* 描述 */}
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                简要描述
                            </label>
                            <InputText
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="一句话总结这篇文章的核心内容"
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-surface-0"
                            />
                        </div>

                        {/* 标签 */}
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5 flex items-center gap-1">
                                <Tag className="w-4 h-4" />
                                标签
                            </label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {tags.map((tag) => (
                                    <Chip
                                        key={tag}
                                        label={tag}
                                        removable={tag !== lockedTag}
                                        onRemove={() => {
                                            if (tag === lockedTag) return false;
                                            setTags((prev) => prev.filter((t) => t !== tag));
                                            return true;
                                        }}
                                        className={
                                            tag === lockedTag
                                                ? 'bg-primary-50 text-primary-600 font-bold border-none'
                                                : 'bg-surface-100 text-surface-600 border-none'
                                        }
                                    />
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <InputText
                                    value={extraTag}
                                    onChange={(e) => setExtraTag(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddExtraTag())}
                                    placeholder="输入后回车添加标签（可选）"
                                    className="flex-1 px-3 py-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-sm"
                                />
                                <Button
                                    label="添加"
                                    onClick={handleAddExtraTag}
                                    className="p-button-secondary p-button-outlined rounded-xl px-4"
                                />
                            </div>
                            {lockedTag && (
                                <p className="text-xs text-surface-400 mt-1">
                                    提示：{lockedTag} 标签为当前选择的肌肉/关节部位，且不可删除。
                                </p>
                            )}
                        </div>

                        {/* 正文 */}
                        <div>
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                正文
                            </label>
                            <RichTextEditor
                                content={content}
                                onChange={setContent}
                                placeholder="在这里撰写这部分身体相关的训练原理、风险提示、案例分析等内容..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

