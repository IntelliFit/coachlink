'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { Eye, ThumbsUp, MessageCircle, Clock, Plus, ArrowLeft, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Dropdown } from 'primereact/dropdown';
import { DataView } from 'primereact/dataview';
import { Skeleton } from 'primereact/skeleton';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import ContentEditor from '@/app/dashboard/content/ContentEditor';
import NodeSelector from '@/components/knowledge/NodeSelector';
import { coachService } from '@/app/service/coachService';
import { CoachContentRow } from '@/types';

const Content = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const { showToast } = useToastContext();

    const [contents, setContents] = useState<CoachContentRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentView, setCurrentView] = useState<'list' | 'editor'>('list');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTier, setFilterTier] = useState<number | 'all'>('all');
    const [editingContent, setEditingContent] = useState<CoachContentRow | null>(null);
    const [selectedKnowledgeNodeId, setSelectedKnowledgeNodeId] = useState<string | null>(null);
    const [selectedKnowledgeNodePath, setSelectedKnowledgeNodePath] = useState<string[]>([]);

    useEffect(() => {
        if (coach?.id) loadContents();
    }, [coach?.id]);

    // Reset knowledge node selection when editing content changes
    useEffect(() => {
        if (editingContent) {
            setSelectedKnowledgeNodeId((editingContent as any).knowledge_node_id || null);
        } else {
            setSelectedKnowledgeNodeId(null);
            setSelectedKnowledgeNodePath([]);
        }
    }, [editingContent]);

    const loadContents = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await coachService.getContents({ coachId: coach.id, limit: 50, offset: 0 });
            if (res) setContents(res.contents || []);
        } catch (err) {
            setError('加载内容失败，请重试');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        setSearching(true);
        // 此处通常调用后端搜索 API，当前通过逻辑过滤模拟
        await new Promise(resolve => setTimeout(resolve, 400)); 
        setSearching(false);
    };

    const handleEditContent = (content: CoachContentRow) => {
        setEditingContent(content);
        setCurrentView('editor');
    };

    const handlePublishContent = async (contentData: any) => {
        try {
            const dataWithKnowledge = {
                ...contentData,
                knowledge_node_id: selectedKnowledgeNodeId,
            };
            if (editingContent) {
                await coachService.updateContent({ ...dataWithKnowledge, id: editingContent.id, isDraft: false });
                showToast({ severity: 'success', summary: '更新成功' });
            } else {
                await coachService.publishContent({ ...dataWithKnowledge, coachId: coach.id, isDraft: false });
                showToast({ severity: 'success', summary: '发布成功' });
            }
            closeEditor();
        } catch (err) {
            showToast({ severity: 'error', summary: '操作失败' });
        }
    };

    const handleSaveDraft = async (contentData: any) => {
        try {
            const dataWithKnowledge = {
                ...contentData,
                knowledge_node_id: selectedKnowledgeNodeId,
            };
            if (editingContent) {
                await coachService.updateContent({ ...dataWithKnowledge, id: editingContent.id, isDraft: true });
            } else {
                await coachService.publishContent({ ...dataWithKnowledge, coachId: coach.id, isDraft: true });
            }
            showToast({ severity: 'info', summary: '草稿已保存' });
            closeEditor();
        } catch (err) {
            showToast({ severity: 'error', summary: '保存草稿失败' });
        }
    };

    const closeEditor = () => {
        setCurrentView('list');
        setEditingContent(null);
        setSelectedKnowledgeNodeId(null);
        setSelectedKnowledgeNodePath([]);
        loadContents();
    };

    const handleDeleteContent = (content: CoachContentRow) => {
        confirmDialog({
            message: `确定要删除内容"${content.title}"吗？此操作无法撤销。`,
            header: '删除确认',
            acceptClassName: 'p-button-danger border-none rounded-xl',
            rejectClassName: 'p-button-text text-surface-500 rounded-xl',
            accept: async () => {
                try {
                    await coachService.deleteContent(content.id);
                    loadContents();
                    showToast({ severity: 'success', summary: '删除成功' });
                } catch (err) {
                    showToast({ severity: 'error', summary: '删除失败' });
                }
            }
        });
    };

    const getTierBadge = (tier: number) => {
        const configs = {
            0: { label: '免费', class: 'bg-green-50 text-green-600' },
            1: { label: '基础', class: 'bg-primary-50 text-primary-600' },
            2: { label: '高级', class: 'bg-purple-50 text-purple-600' },
            3: { label: 'VIP', class: 'bg-amber-50 text-amber-600' },
        };
        const config = configs[tier as keyof typeof configs] || configs[0];
        return (
            <span className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md ${config.class}`}>
                {config.label}
            </span>
        );
    };

    const formatRelativeTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    };

    const filteredContents = contents.filter(content => {
        const matchesSearch = content.title.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTier = filterTier === 'all' || content.required_tier === filterTier;
        return matchesSearch && matchesTier;
    });

    if (currentView === 'editor') {
        return (
            <div className="max-w-5xl mx-auto px-4 py-8 animate-in fade-in duration-500">
                <Button
                    icon={<ArrowLeft size={18} className="mr-2" />}
                    label={editingContent ? "取消编辑" : "返回列表"}
                    className="p-button-text text-surface-500 hover:text-primary mb-6 rounded-xl active:scale-95"
                    onClick={() => { setCurrentView('list'); setEditingContent(null); }}
                />
                
                {/* Knowledge Node Selector */}
                <div className="mb-6 p-5 bg-gradient-to-r from-purple-50 to-primary-50 dark:from-purple-900/20 dark:to-primary-900/20 rounded-[24px] border border-purple-100 dark:border-purple-800">
                    <div className="flex items-start gap-3 mb-4">
                        <span className="text-2xl">📚</span>
                        <div>
                            <h3 className="font-bold text-surface-900 dark:text-surface-100">关联到知识库</h3>
                            <p className="text-xs text-surface-500 mt-0.5">将文章挂载到知识体系的某个节点下，便于用户按主题浏览</p>
                        </div>
                    </div>
                    <NodeSelector
                        value={selectedKnowledgeNodeId}
                        onChange={(nodeId, path) => {
                            setSelectedKnowledgeNodeId(nodeId);
                            setSelectedKnowledgeNodePath(path);
                        }}
                        placeholder="点击选择知识分类（可选）..."
                        label=""
                    />
                    {selectedKnowledgeNodePath.length > 0 && (
                        <p className="mt-3 text-xs text-green-600 dark:text-green-400 font-medium">
                            ✓ 将发布到：{selectedKnowledgeNodePath.join(' → ')}
                        </p>
                    )}
                </div>

                <div className="p-5 bg-surface-0 rounded-[32px] border border-surface-100 overflow-hidden">
                    <ContentEditor
                        coachId={coach.id}
                        onPublish={handlePublishContent}
                        onSaveDraft={handleSaveDraft}
                        initialContent={editingContent}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-10 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <ConfirmDialog />
            
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 px-2">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black tracking-tighter text-surface-900">内容管理</h1>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xs font-bold uppercase tracking-widest text-primary bg-primary-50 px-2 py-0.5 rounded">
                            {filteredContents.length} items
                        </span>
                        <p className="text-surface-500 text-sm font-medium opacity-70">记录与读者的每一次互动</p>
                    </div>
                </div>
                <Button
                    label="发布新内容"
                    icon={<Plus size={18} className="mr-1" />}
                    onClick={() => { setEditingContent(null); setCurrentView('editor'); }}
                    className="p-button-primary shadow-lg shadow-primary-100 transition-transform active:scale-95 rounded-2xl px-6 py-3"
                />
            </header>

            {/* 同步 PlanLib 样式的搜索区域 */}
            <section className="flex gap-3 mb-10 px-2">
                <IconField iconPosition="left" className="flex-1 group">
                    <InputIcon><Search size={18} className="text-surface-400 group-focus-within:text-primary transition-colors" /></InputIcon>
                    <InputText
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            if (!e.target.value) loadContents();
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="搜索内容标题或关键词..."
                        className="w-full border-surface-200 bg-surface-50/50 focus:bg-white focus:border-primary rounded-2xl py-3 transition-all"
                    />
                </IconField>
                <Dropdown
                    value={filterTier}
                    options={[
                        { label: '所有权限', value: 'all' },
                        { label: '免费内容', value: 0 },
                        { label: '基础订阅', value: 1 },
                        { label: '高级订阅', value: 2 },
                        { label: 'VIP专属', value: 3 },
                    ]}
                    onChange={(e) => setFilterTier(e.value)}
                    className="w-40 border-surface-200 bg-surface-50/50 focus:bg-surface-100 focus:border-primary rounded-2xl flex items-center px-2"
                />
                <Button
                    icon="pi pi-search"
                    onClick={handleSearch}
                    loading={searching}
                    className="p-button-primary p-button-outlined rounded-2xl px-6 active:scale-95 transition-transform"
                />
            </section>

            <main className="min-h-[400px]">
                {loading || searching ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="flex items-center gap-6 p-8 bg-surface-100 border border-surface-50 rounded-[24px]">
                                <Skeleton shape="circle" size="3rem" />
                                <div className="flex-1"><Skeleton width="40%" className="mb-3" /><Skeleton width="70%" /></div>
                            </div>
                        ))}
                    </div>
                ) : filteredContents.length === 0 ? (
                    <div className="text-center py-32 bg-surface-50/30 border-2 border-dashed border-surface-100 rounded-[40px]">
                        <h3 className="text-lg font-bold text-surface-900 tracking-tight">未找到匹配的内容</h3>
                        <p className="text-surface-400 text-sm mt-1">尝试调整搜索词或过滤器</p>
                    </div>
                ) : (
                    <DataView
                        value={filteredContents}
                        itemTemplate={(content: CoachContentRow) => (
                            <div className="group flex flex-col md:flex-row items-center gap-6 p-6 mb-4 bg-surface-0 dark:bg-surface-50 border border-surface-100 rounded-[24px] transition-all duration-300 hover:border-primary-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.02)] active:scale-[0.995]">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        {getTierBadge(content.required_tier)}
                                        <h3 className="text-lg font-bold tracking-tight text-surface-900 truncate group-hover:text-primary transition-colors leading-tight">
                                            {content.title}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-surface-500 line-clamp-1 mb-4 font-medium opacity-80">
                                        {content.content.replace(/<[^>]*>/g, '')}
                                    </p>
                                    <div className="flex items-center gap-6 text-surface-400">
                                        <div className="flex items-center gap-1.5"><Eye size={14} /><span className="text-xs font-bold tracking-tighter">{content.views_count}</span></div>
                                        <div className="flex items-center gap-1.5"><ThumbsUp size={14} /><span className="text-xs font-bold tracking-tighter">{content.likes_count}</span></div>
                                        <div className="flex items-center gap-1.5"><Clock size={14} /><span className="text-xs font-medium">{formatRelativeTime(content.created_at)}</span></div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 md:opacity-0 group-hover:opacity-100 transition-all duration-200">
                                    <Button 
                                        icon={<Pencil size={18} />} 
                                        className="p-button-text p-button-rounded text-surface-400 hover:text-primary hover:bg-primary-50 w-11 h-11"
                                        onClick={() => handleEditContent(content)}
                                    />
                                    <Button 
                                        icon={<Trash2 size={18} />} 
                                        className="p-button-text p-button-rounded text-surface-400 hover:text-red-500 hover:bg-red-50 w-11 h-11"
                                        onClick={() => handleDeleteContent(content)}
                                    />
                                </div>
                            </div>
                        )}
                        paginator
                        rows={8}
                        pt={{
                            content: { className: 'bg-transparent border-none' },
                            paginator: {
                                pageButton: ({ context }: any) => ({
                                    className: context.active ? 'bg-primary text-white rounded-xl shadow-md' : 'text-surface-500 rounded-xl hover:bg-surface-100'
                                })
                            }
                        }}
                    />
                )}
            </main>
        </div>
    );
};

export default Content;