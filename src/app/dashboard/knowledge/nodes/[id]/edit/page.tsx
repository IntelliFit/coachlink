'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Users, Loader2 } from 'lucide-react';

// Aero design system constants
const AERO_CONTAINER = "max-w-2xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 shadow-[0_1px_0_rgba(15,23,42,0.02)]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900 dark:text-surface-0";

type Editor = {
    user_id: string;
    user_name: string;
    user_avatar?: string;
    contributed_at: string;
    contribution_type: 'create' | 'edit' | 'review';
};

type KnowledgeNode = {
    id: string;
    title: string;
    description: string | null;
    content: any;
    body_region: string[];
    is_collaborative: boolean;
    created_by: string;
    editors: Editor[];
};

export default function EditNodePage() {
    const params = useParams();
    const router = useRouter();
    const nodeId = params?.id as string;

    const [node, setNode] = useState<KnowledgeNode | null>(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // Fetch node data
        const fetchNode = async () => {
            try {
                const res = await fetch(`/api/knowledge/nodes/${nodeId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                
                setNode(data.node);
                setTitle(data.node.title || '');
                setDescription(data.node.description || '');
                setContent(typeof data.node.content === 'string' 
                    ? data.node.content 
                    : JSON.stringify(data.node.content, null, 2) || ''
                );
            } catch (error) {
                console.error('获取文章失败:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchNode();
    }, [nodeId]);

    const handleSave = async () => {
        if (!title.trim()) return;
        
        setSaving(true);
        try {
            const res = await fetch('/api/knowledge/nodes', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: nodeId,
                    title: title.trim(),
                    description: description.trim(),
                    content: content,
                }),
            });

            if (res.ok) {
                router.push(`/dashboard/knowledge/nodes/${nodeId}`);
            }
        } catch (error) {
            console.error('保存失败:', error);
        } finally {
            setSaving(false);
        }
    };

    // 渲染编辑者列表
    const renderEditorsList = () => {
        if (!node?.editors || node.editors.length === 0) return null;

        return (
            <div className="mt-6 pt-6 border-t border-surface-200 dark:border-surface-700">
                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    共建者 ({node.editors.length})
                </h3>
                <div className="space-y-2">
                    {node.editors.map((editor) => (
                        <div 
                            key={editor.user_id}
                            className="flex items-center gap-2 text-sm"
                        >
                            <div className="w-7 h-7 rounded-full bg-surface-200 flex items-center justify-center text-xs font-medium text-surface-600">
                                {editor.user_avatar ? (
                                    <img src={editor.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                                ) : (
                                    editor.user_name?.[0] || '?'
                                )}
                            </div>
                            <span className="text-surface-700 dark:text-surface-300">
                                {editor.user_name}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                                editor.contribution_type === 'create' 
                                    ? 'bg-primary-100 text-primary-600' 
                                    : 'bg-surface-100 text-surface-500'
                            }`}>
                                {editor.contribution_type === 'create' ? '创建者' : '编辑者'}
                            </span>
                            <span className="text-xs text-surface-400 ml-auto">
                                {new Date(editor.contributed_at).toLocaleDateString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-surface-400" />
            </div>
        );
    }

    if (!node) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-surface-500">文章不存在</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen pb-24">
            {/* 背景装饰 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 dark:from-primary-900/20 to-transparent" />

            <div className="relative z-10">
                {/* Header */}
                <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
                    <div className="flex items-center justify-between mb-6">
                        <button
                            onClick={() => router.back()}
                            className="flex items-center gap-1 text-surface-500 hover:text-surface-700 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="text-sm font-medium">返回</span>
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving || !title.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-surface-900 text-surface-0 text-sm font-medium rounded-xl hover:bg-surface-800 disabled:bg-surface-300 disabled:cursor-not-allowed transition-colors"
                        >
                            {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {saving ? '保存中...' : '保存'}
                        </button>
                    </div>
                    
                    <h1 className={AERO_TITLE}>编辑文章</h1>
                    <p className="text-sm text-surface-500 mt-1">
                        {node.is_collaborative ? '这是一篇共建文章，您的编辑将被记录' : ''}
                    </p>
                </div>

                {/* Edit Form */}
                <div className={AERO_CONTAINER}>
                    <div className={`${AERO_CARD} p-6`}>
                        {/* 标题 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                标题
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="输入文章标题"
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-surface-0 focus:outline-none focus:border-primary-400 transition-colors"
                            />
                        </div>

                        {/* 描述 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                描述
                            </label>
                            <input
                                type="text"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="简要描述文章内容"
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-surface-0 focus:outline-none focus:border-primary-400 transition-colors"
                            />
                        </div>

                        {/* 内容 */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                内容
                            </label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="输入文章内容..."
                                rows={12}
                                className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-surface-0 focus:outline-none focus:border-primary-400 transition-colors resize-none font-mono text-sm"
                            />
                        </div>

                        {/* 关联部位 */}
                        {node.body_region && node.body_region.length > 0 && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-1.5">
                                    关联部位
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {node.body_region.map((region) => (
                                        <span 
                                            key={region}
                                            className="px-3 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-medium rounded-full"
                                        >
                                            {region}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 共建者列表 */}
                        {renderEditorsList()}
                    </div>
                </div>
            </div>
        </div>
    );
}
