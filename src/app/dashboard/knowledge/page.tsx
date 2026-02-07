"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { BookOpen, Search, Zap, ChevronRight, Sparkles, List, GitBranch } from "lucide-react";
import AIChatPanel from "@/components/knowledge/AIChatPanel";

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

const KnowledgeBaseHomePage = () => {
    const router = useRouter();
    const [loadingPillars, setLoadingPillars] = useState(true);
    const [pillars, setPillars] = useState<KnowledgePillar[]>([]);
    const [showAIChat, setShowAIChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>('list');

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

    // Scenario quick fixes 
    const scenarios = [
        { title: "办公族肩颈救星", icon: "💼", slug: "office-neck" },
        { title: "久坐腰痛缓解", icon: "🪑", slug: "sitting-back" },
        { title: "跑步后拉伸", icon: "🏃", slug: "post-run" },
        { title: "睡前放松", icon: "😴", slug: "bedtime" },
    ];

    return (
        <div className="pb-32">
            {/* Hero Header with Gradient */}
            <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-amber-500 text-white px-4 pt-12 pb-8">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white/20 backdrop-blur rounded-2xl">
                            <BookOpen size={24} />
                        </div>
                        <h1 className="text-2xl font-black">知识库</h1>
                    </div>
                    <p className="text-white/80 text-sm">
                        以最通俗易懂的方式传授运动训练知识
                    </p>

                    {/* Search Bar */}
                    <div className="mt-5 relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
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
                            className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/95 text-surface-900 placeholder-surface-400 text-sm shadow-lg focus:outline-none focus:ring-2 focus:ring-white/50"
                        />
                    </div>
                </div>
            </div>

            {/* Body Map Entry */}
            <div className="px-4 mt-5">
                <div className="max-w-3xl mx-auto">
                    <button
                        onClick={() => router.push("/dashboard/knowledge/body-map")}
                        className="w-full bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-600 dark:to-pink-600 text-white p-5 rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center gap-4"
                    >
                        <div className="text-4xl">🧍</div>
                        <div className="text-left flex-1">
                            <h3 className="font-black text-lg">人体地图</h3>
                            <p className="text-white/80 text-xs mt-0.5">
                                按部位查看筛查方案或训练动作
                            </p>
                        </div>
                        <ChevronRight size={20} className="text-white/60" />
                    </button>
                </div>
            </div>

            {/* Scenario Quick Fixes */}
            <div className="px-4 mt-5">
                <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 text-surface-700 dark:text-surface-200 text-sm font-bold mb-3">
                        <Zap size={16} className="text-amber-500" />
                        <span>场景急救箱</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {scenarios.map((scenario, idx) => (
                            <button
                                key={idx}
                                onClick={() => router.push(`/dashboard/knowledge/scenarios/${scenario.slug}`)}
                                className="flex items-center gap-3 p-4 bg-white dark:bg-surface-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow text-left"
                            >
                                <span className="text-2xl">{scenario.icon}</span>
                                <span className="text-sm font-bold text-surface-800 dark:text-surface-100">{scenario.title}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Knowledge Pillars (Tree) with View Toggle */}
            <div className="px-4 mt-6">
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
