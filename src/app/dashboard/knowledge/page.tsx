"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { BookOpen, Search, ChevronRight, Sparkles, List, GitBranch, MapPin, Plus, Edit3, Users } from "lucide-react";
import AIChatPanel from "@/components/knowledge/AIChatPanel";
import BodyMapCanvas, { BODY_REGION_LABELS, type BodyRegion } from "@/components/knowledge/BodyMap/BodyMapCanvas";
import BodyMapModeSwitch from "@/components/knowledge/BodyMap/BodyMapModeSwitch";

const KnowledgeMindMap = dynamic(
    () => import("@/components/knowledge/KnowledgeMindMap"),
    { ssr: false, loading: () => <div className="h-[500px] bg-surface-100 dark:bg-surface-800 rounded-3xl animate-pulse" /> }
);

type KnowledgePillar = {
    id: string;
    title: string;
    description: string | null;
    node_type?: string;
    children?: KnowledgePillar[];
};

type ViewMode = 'list' | 'mindmap';
type BodyMapMode = 'screening' | 'training';

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
    difficulty: number;
    is_free: boolean;
    is_collaborative?: boolean;
    created_by?: string;
    editors?: Editor[];
};

// Aero design system constants
const AERO_CONTAINER = "max-w-5xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900 dark:text-surface-0";
const AERO_SUBTITLE = "text-sm text-surface-600 dark:text-surface-400 mt-1";

// 自定义非线性动画曲线 - 营造丝滑感
const ANIMATION_CURVE = "cubic-bezier(0.34, 1.56, 0.64, 1)";

const KnowledgeBaseHomePage = () => {
    const router = useRouter();
    const [loadingPillars, setLoadingPillars] = useState(true);
    const [pillars, setPillars] = useState<KnowledgePillar[]>([]);
    const [showAIChat, setShowAIChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>('list');
    const [bodyMapMode, setBodyMapMode] = useState<BodyMapMode>('screening');
    const [selectedBodyRegion, setSelectedBodyRegion] = useState<BodyRegion | null>(null);
    const [regionNodes, setRegionNodes] = useState<KnowledgeNode[]>([]);
    const [loadingRegionNodes, setLoadingRegionNodes] = useState(false);
    const [isBodyMapExpanded, setIsBodyMapExpanded] = useState(true);
    
    // 结果区域ref，用于自动滚动
    const resultsRef = React.useRef<HTMLDivElement>(null);
    
    // 选择身体部位后自动滚动到结果区域（移动端）
    useEffect(() => {
        if (selectedBodyRegion && resultsRef.current && window.innerWidth < 1024) {
            setTimeout(() => {
                resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [selectedBodyRegion]);

    useEffect(() => {
        const fetchPillars = async () => {
            try {
                const res = await fetch("/api/knowledge/tree");
                const json = await res.json();
                setPillars(json.tree || []);
            } catch (error) {
                console.error("获取知识体系失败:", error);
            } finally {
                setLoadingPillars(false);
            }
        };
        fetchPillars();
    }, []);

    useEffect(() => {
        if (!selectedBodyRegion) {
            setRegionNodes([]);
            return;
        }

        const fetchRegionNodes = async () => {
            setLoadingRegionNodes(true);
            try {
                const res = await fetch(`/api/knowledge/nodes?body_region=${selectedBodyRegion}`);
                const json = await res.json();
                setRegionNodes(json.nodes || []);
            } catch (error) {
                console.error("获取人体地图节点失败:", error);
                setRegionNodes([]);
            } finally {
                setLoadingRegionNodes(false);
            }
        };

        fetchRegionNodes();
    }, [selectedBodyRegion]);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    // 渲染编辑者头像
    const renderEditors = (editors: Editor[]) => {
        if (!editors || editors.length === 0) return null;
        
        const displayEditors = editors.slice(0, 3);
        const remainingCount = editors.length - 3;
        
        return (
            <div className="flex items-center gap-1 mt-2">
                <Users className="w-3 h-3 text-surface-400" />
                <div className="flex -space-x-1.5">
                    {displayEditors.map((editor, idx) => (
                        <div
                            key={editor.user_id}
                            className="w-5 h-5 rounded-full bg-surface-200 border-2 border-surface-0 dark:border-surface-900 flex items-center justify-center text-[8px] font-medium text-surface-600"
                            title={`${editor.user_name} (${editor.contribution_type === 'create' ? '创建者' : '编辑者'})`}
                        >
                            {editor.user_avatar ? (
                                <img src={editor.user_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                                editor.user_name?.[0] || '?'
                            )}
                        </div>
                    ))}
                    {remainingCount > 0 && (
                        <div className="w-5 h-5 rounded-full bg-surface-100 border-2 border-surface-0 dark:border-surface-900 flex items-center justify-center text-[8px] font-medium text-surface-500">
                            +{remainingCount}
                        </div>
                    )}
                </div>
                <span className="text-[10px] text-surface-400 ml-1">
                    {editors.length} 人共建
                </span>
            </div>
        );
    };

    return (
        <div className="min-h-screen pb-24">
            {/* 背景装饰 - 上下渐变 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 dark:from-primary-900/20 to-transparent" />

            <div className="relative z-10">
                {/* Header */}
                <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                                <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            </div>
                            <div>
                                <h1 className={AERO_TITLE}>知识库</h1>
                                <p className={AERO_SUBTITLE}>点击身体部位，共建训练知识</p>
                            </div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="relative">
                        <div className="flex items-center bg-surface-0 dark:bg-surface-900 rounded-2xl border border-surface-200 dark:border-surface-800 shadow-sm overflow-hidden">
                            <Search className="ml-4 w-4 h-4 text-surface-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                placeholder="搜索知识点..."
                                className="flex-1 px-3 py-3.5 bg-transparent text-surface-900 dark:text-surface-0 placeholder-surface-400 text-sm focus:outline-none"
                            />
                            <button
                                onClick={handleSearch}
                                disabled={!searchQuery.trim()}
                                className="mr-1.5 px-4 py-2 bg-surface-900 dark:bg-surface-700 hover:bg-surface-800 disabled:bg-surface-200 dark:disabled:bg-surface-800 disabled:cursor-not-allowed text-surface-0 dark:text-surface-0 text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
                            >
                                搜索
                            </button>
                        </div>
                    </div>

                    {/* Quick Tags */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        {['深蹲', '拉伸', '减脂', '增肌'].map((tag) => (
                            <button
                                key={tag}
                                onClick={() => router.push(`/dashboard/knowledge/search?q=${tag}`)}
                                className="px-3 py-1.5 bg-surface-0 dark:bg-surface-900 border border-surface-200 dark:border-surface-800 hover:border-primary-200 dark:hover:border-primary-800 text-surface-600 dark:text-surface-400 text-xs font-medium rounded-xl transition-all active:scale-[0.98]"
                            >
                                {tag}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick Actions - 仅保留书籍入口 */}
                <div className={`${AERO_CONTAINER} mb-4`}>
                    <button
                        onClick={() => router.push('/dashboard/knowledge/books')}
                        className={`${AERO_CARD} w-full flex items-center gap-3 p-4 active:scale-[0.98]`}
                    >
                        <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="text-left flex-1">
                            <h3 className="font-semibold text-surface-900 dark:text-surface-0 text-sm">书籍笔记</h3>
                            <p className="text-xs text-surface-500">系统化学习资料</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-surface-300" />
                    </button>
                </div>

                {/* Body Map - 丝滑动画焦点模式 */}
                <div className={AERO_CONTAINER}>
                    <div 
                        className={`${AERO_CARD} mb-3 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                            isBodyMapExpanded 
                                ? selectedBodyRegion 
                                    ? 'p-4 md:p-6 lg:p-8' 
                                    : 'p-4 md:p-6'
                                : 'p-4'
                        }`}
                        style={{ transitionTimingFunction: ANIMATION_CURVE }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-surface-500 dark:text-surface-400" />
                                <h2 className="font-semibold text-surface-900 dark:text-surface-0 text-sm">人体地图</h2>
                                {selectedBodyRegion && (
                                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-xs font-medium rounded-full animate-in fade-in slide-in-from-left-2 duration-500">
                                        {BODY_REGION_LABELS[selectedBodyRegion]}
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => setIsBodyMapExpanded(!isBodyMapExpanded)}
                                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-0.5 transition-all duration-300 hover:scale-105"
                            >
                                {isBodyMapExpanded ? '收起' : '展开查看'}
                                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${isBodyMapExpanded ? 'rotate-90' : ''}`} />
                            </button>
                        </div>
                        
                        {isBodyMapExpanded && (
                            <div 
                                className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                    selectedBodyRegion 
                                        ? 'lg:grid lg:grid-cols-12 lg:gap-8' 
                                        : ''
                                }`}
                                style={{ transitionTimingFunction: ANIMATION_CURVE }}
                            >
                                {/* 左侧：人体地图 - 焦点模式下缩小并左移 */}
                                <div 
                                    className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                                        selectedBodyRegion 
                                            ? 'lg:col-span-5 lg:sticky lg:top-4 lg:self-start' 
                                            : ''
                                    }`}
                                    style={{ transitionTimingFunction: ANIMATION_CURVE }}
                                >
                                    <BodyMapModeSwitch mode={bodyMapMode} onChange={setBodyMapMode} />
                                    <div className="mt-4">
                                        <BodyMapCanvas
                                            mode={bodyMapMode}
                                            selectedRegion={selectedBodyRegion}
                                            onRegionClick={(region) =>
                                                setSelectedBodyRegion((prev) => (prev === region ? null : region))
                                            }
                                            isFocusMode={!!selectedBodyRegion}
                                        />
                                    </div>
                                    
                                    {/* 取消选择按钮 */}
                                    {selectedBodyRegion && (
                                        <button
                                            onClick={() => setSelectedBodyRegion(null)}
                                            className="mt-4 w-full py-2 text-xs text-surface-500 hover:text-surface-700 border border-surface-200 hover:border-surface-300 rounded-xl transition-all duration-300 hover:bg-surface-50"
                                        >
                                            重新选择部位
                                        </button>
                                    )}
                                    
                                    {/* 移动端提示 */}
                                    {selectedBodyRegion && (
                                        <div className="lg:hidden mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-center animate-pulse">
                                            <p className="text-xs text-primary-600 dark:text-primary-400">
                                                ↓ 向下滑动查看 {BODY_REGION_LABELS[selectedBodyRegion]} 的相关内容
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* 右侧：结果区域 - 丝滑入场动画 */}
                                {selectedBodyRegion && (
                                    <div 
                                        ref={resultsRef} 
                                        className="mt-6 lg:mt-0 lg:col-span-7 space-y-3 animate-in slide-in-from-right-8 fade-in duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                                        style={{ animationTimingFunction: ANIMATION_CURVE }}
                                    >
                                        {/* 头部：标题 + 创建按钮 */}
                                        <div className="flex items-center justify-between pb-3 border-b border-surface-200 dark:border-surface-700">
                                            <div>
                                                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                                                    {BODY_REGION_LABELS[selectedBodyRegion]} 相关知识
                                                </h3>
                                                <p className="text-xs text-surface-400 mt-0.5">
                                                    共 {regionNodes.length} 篇 • 欢迎共建
                                                </p>
                                            </div>
                                            {selectedBodyRegion && (
                                                <button
                                                    onClick={() => {
                                                        const region = selectedBodyRegion;
                                                        const label = BODY_REGION_LABELS[region];
                                                        const params = new URLSearchParams();
                                                        params.set("body_region", region);
                                                        if (label) {
                                                            params.set("tag", label);
                                                        }
                                                        router.push(`/dashboard/knowledge/write?${params.toString()}`);
                                                    }}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-surface-900 text-surface-0 text-xs font-medium rounded-lg hover:bg-surface-800 transition-all duration-300 hover:scale-105 active:scale-95"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    创建文章
                                                </button>
                                            )}
                                        </div>

                                        {/* 文章列表 - PC端固定高度可滚动，带逐条入场动画 */}
                                        <div className="lg:max-h-[500px] lg:overflow-y-auto lg:pr-1 space-y-3">
                                            {loadingRegionNodes ? (
                                                <div className="space-y-2">
                                                    {[1, 2].map((i) => (
                                                        <div key={i} className="h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl animate-pulse" />
                                                    ))}
                                                </div>
                                            ) : regionNodes.length === 0 ? (
                                                <div className="text-sm text-surface-500 bg-surface-50 dark:bg-surface-800/50 rounded-2xl px-4 py-6 text-center animate-in fade-in zoom-in-95 duration-500">
                                                    <p>该部位暂时没有内容</p>
                                                    <p className="text-xs mt-1">点击"创建文章"成为第一个贡献者</p>
                                                </div>
                                            ) : (
                                                regionNodes.map((node, index) => (
                                                    <div
                                                        key={node.id}
                                                        className="w-full text-left rounded-2xl border border-surface-100 dark:border-surface-800 bg-surface-50 dark:bg-surface-800/50 px-4 py-3 hover:border-primary-200 dark:hover:border-primary-800 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.02] hover:shadow-md group"
                                                        style={{ 
                                                            animationDelay: `${index * 80}ms`,
                                                            animationTimingFunction: ANIMATION_CURVE 
                                                        }}
                                                    >
                                                        <button
                                                            onClick={() => router.push(`/dashboard/knowledge/nodes/${node.id}`)}
                                                            className="w-full text-left"
                                                        >
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div className="font-medium text-surface-900 dark:text-surface-0 text-sm line-clamp-1 flex-1 group-hover:text-primary-600 transition-colors duration-300">
                                                                    {node.title}
                                                                </div>
                                                                {node.is_collaborative && (
                                                                    <span className="shrink-0 px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-medium rounded">
                                                                        共建
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {node.description && (
                                                                <div className="text-xs text-surface-500 mt-1 line-clamp-1">
                                                                    {node.description}
                                                                </div>
                                                            )}
                                                        </button>
                                                        
                                                        {/* 编辑者信息和编辑按钮 */}
                                                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-surface-200/50 dark:border-surface-700/50">
                                                            {renderEditors(node.editors || [])}
                                                            <button
                                                                onClick={() => router.push(`/dashboard/knowledge/nodes/${node.id}/edit`)}
                                                                className="flex items-center gap-1 px-2 py-1 text-xs text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-all duration-300 hover:scale-105"
                                                            >
                                                                <Edit3 className="w-3 h-3" />
                                                                编辑
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {!isBodyMapExpanded && (
                            <div className="text-center py-6 text-surface-400">
                                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-xs">点击展开查看人体地图</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Knowledge Pillars */}
                <div className={AERO_CONTAINER}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-primary-500" />
                            <h2 className="font-semibold text-surface-900 dark:text-surface-0 text-sm">知识体系</h2>
                        </div>
                        <div className="flex items-center gap-1 bg-surface-0 dark:bg-surface-900 rounded-xl p-0.5 border border-surface-200 dark:border-surface-800">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
                                    viewMode === 'list' 
                                        ? 'bg-surface-100 dark:bg-surface-800 text-primary-600 shadow-sm' 
                                        : 'text-surface-500 hover:text-surface-700'
                                }`}
                            >
                                <List className="w-3.5 h-3.5" />
                                列表
                            </button>
                            <button
                                onClick={() => setViewMode('mindmap')}
                                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all active:scale-[0.98] ${
                                    viewMode === 'mindmap' 
                                        ? 'bg-surface-100 dark:bg-surface-800 text-primary-600 shadow-sm' 
                                        : 'text-surface-500 hover:text-surface-700'
                                }`}
                            >
                                <GitBranch className="w-3.5 h-3.5" />
                                思维导图
                            </button>
                        </div>
                    </div>

                    {loadingPillars ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-16 bg-surface-100 dark:bg-surface-800 rounded-3xl animate-pulse" />
                            ))}
                        </div>
                    ) : pillars.length === 0 ? (
                        <div className={`${AERO_CARD} py-8 text-center`}>
                            <BookOpen className="w-10 h-10 mx-auto mb-2 text-surface-400" />
                            <p className="text-sm text-surface-500">知识体系构建中...</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="space-y-2">
                            {pillars.map((domain) => (
                                <button
                                    key={domain.id}
                                    onClick={() => router.push(`/dashboard/knowledge/pillars/${domain.id}`)}
                                    className={`${AERO_CARD} w-full flex items-center justify-between p-3.5 active:scale-[0.98]`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                                            <BookOpen className="w-4 h-4 text-primary-500" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-surface-900 dark:text-surface-0 text-sm">
                                                {domain.title}
                                            </h3>
                                            {domain.description && (
                                                <p className="text-xs text-surface-500 line-clamp-1">
                                                    {domain.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-surface-300" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <KnowledgeMindMap data={pillars} />
                    )}
                </div>
            </div>

            {/* AI Chat Floating Button */}
            <button
                onClick={() => setShowAIChat(true)}
                className="fixed bottom-24 right-4 w-12 h-12 bg-surface-900 dark:bg-surface-700 hover:bg-surface-800 text-surface-0 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
            >
                <Sparkles className="w-5 h-5" />
            </button>

            <AIChatPanel isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
        </div>
    );
};

export default KnowledgeBaseHomePage;
