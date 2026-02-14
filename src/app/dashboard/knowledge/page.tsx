"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { BookOpen, Search, ChevronRight, Sparkles, List, GitBranch } from "lucide-react";
import AIChatPanel from "@/components/knowledge/AIChatPanel";
import BodyMapCanvas, { BODY_REGION_LABELS, type BodyRegion } from "@/components/knowledge/BodyMap/BodyMapCanvas";
import BodyMapModeSwitch from "@/components/knowledge/BodyMap/BodyMapModeSwitch";

// Dynamic import for mind map (uses ReactFlow which needs client-side only)
const KnowledgeMindMap = dynamic(
    () => import("@/components/knowledge/KnowledgeMindMap"),
    { ssr: false, loading: () => <div className="h-[500px] bg-surface-100 dark:bg-surface-800 rounded-2xl animate-pulse" /> }
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

type KnowledgeNode = {
    id: string;
    title: string;
    description: string | null;
    difficulty: number;
    is_free: boolean;
};

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

    // Fetch knowledge pillars (tree structure)
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

    return (
        <div className="pb-32">
            {/* Hero Header with Gradient */}
            <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-amber-500 text-white px-4 pt-7 pb-4">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-white/20 backdrop-blur rounded-xl">
                            <BookOpen size={20} />
                        </div>
                        <h1 className="text-xl font-black">知识库</h1>
                    </div>
                    <p className="text-white/80 text-xs">
                        以最通俗易懂的方式传授运动训练知识
                    </p>

                    {/* Search Bar */}
                    <div className="mt-3 relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && searchQuery.trim()) {
                                    router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}`);
                                }
                            }}
                            placeholder="搜索知识点..."
                            className="w-full pl-10 pr-3 py-2 rounded-xl bg-white/95 text-surface-900 placeholder-surface-400 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                        />
                    </div>
                </div>
            </div>

            {/* Body Map Inline */}
            <div className="px-4 mt-3">
                <div className="max-w-3xl mx-auto">
                    <div className="rounded-2xl border border-surface-200 bg-white dark:bg-surface-800 p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h2 className="text-base font-black text-surface-900 dark:text-surface-100">人体地图</h2>
                                <p className="text-xs text-surface-500 mt-1">
                                    直接点击部位查看内容，不需要单独跳转
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => router.push("/dashboard/knowledge/body-map")}
                                className="text-xs text-primary-600 font-semibold hover:text-primary-500"
                            >
                                全屏查看
                            </button>
                        </div>
                        <BodyMapModeSwitch mode={bodyMapMode} onChange={setBodyMapMode} />
                        <div className="mt-4">
                            <BodyMapCanvas
                                mode={bodyMapMode}
                                selectedRegion={selectedBodyRegion}
                                onRegionClick={(region) =>
                                    setSelectedBodyRegion((prev) => (prev === region ? null : region))
                                }
                            />
                        </div>

                        {selectedBodyRegion && (
                            <div className="mt-4 space-y-2">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-surface-700 dark:text-surface-200">
                                        {BODY_REGION_LABELS[selectedBodyRegion]} 相关内容
                                    </h3>
                                    <span className="text-xs text-surface-500">
                                        {loadingRegionNodes ? "加载中..." : `${regionNodes.length} 条`}
                                    </span>
                                </div>
                                {loadingRegionNodes ? (
                                    <div className="space-y-2">
                                        {[1, 2].map((i) => (
                                            <div key={i} className="h-16 bg-surface-100 dark:bg-surface-700 rounded-xl animate-pulse" />
                                        ))}
                                    </div>
                                ) : regionNodes.length === 0 ? (
                                    <div className="text-xs text-surface-500 bg-surface-50 dark:bg-surface-700/40 rounded-xl px-3 py-3">
                                        该部位暂时没有内容，正在补充中。
                                    </div>
                                ) : (
                                    regionNodes.slice(0, 3).map((node) => (
                                        <button
                                            key={node.id}
                                            type="button"
                                            onClick={() => router.push(`/dashboard/knowledge/nodes/${node.id}`)}
                                            className="w-full rounded-xl border border-surface-200 bg-surface-0 dark:bg-surface-700/40 px-3 py-3 text-left hover:border-primary-200 transition-colors"
                                        >
                                            <div className="text-sm font-semibold text-surface-900 dark:text-surface-100 line-clamp-1">
                                                {node.title}
                                            </div>
                                            {node.description && (
                                                <div className="text-xs text-surface-500 mt-1 line-clamp-2">
                                                    {node.description}
                                                </div>
                                            )}
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Knowledge Pillars (Tree) with View Toggle */}
            <div className="px-4 mt-4">
                <div className="max-w-3xl mx-auto">
                    {/* Header with view toggle */}
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-surface-700 dark:text-surface-200 text-sm font-bold">知识体系</h2>
                        
                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    viewMode === 'list' 
                                        ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                                        : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                }`}
                            >
                                <List size={14} />
                                <span>列表</span>
                            </button>
                            <button
                                onClick={() => setViewMode('mindmap')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                    viewMode === 'mindmap' 
                                        ? 'bg-white dark:bg-surface-700 text-primary-600 dark:text-primary-400 shadow-sm' 
                                        : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
                                }`}
                            >
                                <GitBranch size={14} />
                                <span>思维导图</span>
                            </button>
                        </div>
                    </div>

                    {loadingPillars ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="h-20 bg-surface-100 dark:bg-surface-800 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : pillars.length === 0 ? (
                        <div className="text-center py-8 text-surface-400">
                            <BookOpen size={40} className="mx-auto mb-2 opacity-50" />
                            <p className="text-sm">知识体系构建中...</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        /* List View */
                        <div className="space-y-3">
                            {pillars.map((domain) => (
                                <button
                                    key={domain.id}
                                    onClick={() => router.push(`/dashboard/knowledge/pillars/${domain.id}`)}
                                    className="w-full flex items-center justify-between p-4 bg-white dark:bg-surface-800 rounded-2xl shadow-sm hover:shadow-md transition-all text-left group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">
                                            <BookOpen size={20} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                                {domain.title}
                                            </h3>
                                            {domain.description && (
                                                <p className="text-xs text-surface-500 dark:text-surface-400 mt-0.5 line-clamp-1">
                                                    {domain.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <ChevronRight size={18} className="text-surface-300 group-hover:text-primary-500 transition-colors" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        /* Mind Map View */
                        <KnowledgeMindMap data={pillars} />
                    )}
                </div>
            </div>

            {/* AI Chat Floating Button */}
            <button
                onClick={() => setShowAIChat(true)}
                className="fixed bottom-24 right-4 w-14 h-14 bg-gradient-to-br from-purple-500 to-primary-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-30"
            >
                <Sparkles size={24} />
            </button>

            {/* AI Chat Panel */}
            <AIChatPanel isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
        </div>
    );
};

export default KnowledgeBaseHomePage;
