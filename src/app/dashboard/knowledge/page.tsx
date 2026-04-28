"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Activity, BookOpen, CheckCircle2, ChevronRight, Dumbbell, Edit3, MapPin, Plus, Search, Sparkles, Users } from "lucide-react";
import AIChatPanel from "@/components/knowledge/AIChatPanel";
import BodyMapCanvas, { BODY_REGION_LABELS, type BodyRegion } from "@/components/knowledge/BodyMap/BodyMapCanvas";
import BodyMapModeSwitch from "@/components/knowledge/BodyMap/BodyMapModeSwitch";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookCollection, groupKnowledgeBooks } from "@/lib/knowledgeBooks";
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
    content_summary?: {
        content_level?: string;
        body_map_modes?: BodyMapMode[];
        source?: string | null;
        source_topic?: string | null;
        mode_rank?: number;
    };
};

// Aero design system constants
const AERO_CONTAINER = "max-w-5xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900 dark:text-surface-0";
const AERO_SUBTITLE = "text-sm text-surface-600 dark:text-surface-400 mt-1";
const SHOW_KNOWLEDGE_PILLARS = false;

// 自定义非线性动画曲线 - 营造丝滑感
const ANIMATION_CURVE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
const JOINT_REGIONS = new Set(["膝关节", "踝关节", "髋关节", "腕关节", "肩关节"]);

function getBodyMapModeCopy(region: string, mode: BodyMapMode) {
    const isJoint = JOINT_REGIONS.has(region);
    if (mode === "screening") {
        return {
            icon: Activity,
            title: `${region} 筛查`,
            subtitle: "先判断它是不是当前动作受限或疼痛的关键环节。",
            steps: isJoint
                ? ["看活动范围：左右是否明显不同", "看疼痛信号：是否有肿胀、卡住、刺痛", "看负重稳定：下蹲、支撑或推拉时是否失控"]
                : ["看位置和触感：是否单侧更紧或更敏感", "看动作代偿：目标动作中是否先耸肩、塌腰或膝内扣", "看训练反馈：训练后是否反复在同一区域不适"],
            badge: "先筛查，再处理",
        };
    }

    return {
        icon: Dumbbell,
        title: `${region} 训练`,
        subtitle: "把注意力放在动作选择、发力路径和逐步加量上。",
        steps: isJoint
            ? ["先恢复可控活动范围", "再做低负荷稳定控制", "最后回到深蹲、推拉、跑跳等复合动作"]
            : ["先用低强度动作找到发力感", "再选择能稳定重复的主训练动作", "最后按周增加组数、次数或重量"],
        badge: "先会用，再加量",
    };
}

function getContentLevelLabel(level?: string) {
    if (level === "formal-guide") return "系统指南";
    if (level === "article-guide") return "延伸阅读";
    if (level === "transcript-pack") return "素材包";
    return "知识点";
}

const KnowledgeBaseHomePage = () => {
    const router = useRouter();
    const [showAIChat, setShowAIChat] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection[]>([]);
    const [loadingBookCollections, setLoadingBookCollections] = useState(true);
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
        const fetchBookCollections = async () => {
            try {
                const result = await knowledgeService.listKnowledgeBooks({
                    is_published: true,
                });
                setBookCollections(groupKnowledgeBooks(result?.books || []));
            } catch (error) {
                console.error("获取书籍列表失败:", error);
                setBookCollections([]);
            } finally {
                setLoadingBookCollections(false);
            }
        };

        fetchBookCollections();
    }, []);

    useEffect(() => {
        if (!selectedBodyRegion) {
            setRegionNodes([]);
            return;
        }

        const fetchRegionNodes = async () => {
            setLoadingRegionNodes(true);
            try {
                const params = new URLSearchParams({
                    body_region: selectedBodyRegion,
                    mode: bodyMapMode,
                    limit: "6",
                });
                const res = await fetch(`/api/knowledge/nodes?${params.toString()}`);
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
    }, [selectedBodyRegion, bodyMapMode]);

    const handleSearch = () => {
        if (searchQuery.trim()) {
            router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}`);
        }
    };

    const displayedRegionNodes = regionNodes.slice(0, 1);

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

                {/* Book Shelf */}
                <div className={`${AERO_CONTAINER} mb-4`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-amber-500" />
                            <div>
                                <h2 className="font-semibold text-surface-900 dark:text-surface-0 text-sm">书籍笔记</h2>
                                <p className="text-xs text-surface-500">先看到每一本书，再进入书内章节</p>
                            </div>
                        </div>
                        <button
                            onClick={() => router.push('/dashboard/knowledge/books')}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                        >
                            查看全部
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {loadingBookCollections ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Array.from({ length: 2 }).map((_, index) => (
                                <div key={index} className={`${AERO_CARD} p-4`}>
                                    <div className="h-24 rounded-2xl bg-surface-100 dark:bg-surface-800 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : bookCollections.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {bookCollections.slice(0, 4).map((collection) => (
                                <button
                                    key={collection.slug}
                                    onClick={() => router.push(`/dashboard/knowledge/books/${collection.representativeBook.id}`)}
                                    className={`${AERO_CARD} text-left p-4 active:scale-[0.98]`}
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center shrink-0">
                                            <BookOpen className="w-5 h-5 text-amber-500" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-surface-900 dark:text-surface-0 text-sm line-clamp-1">
                                                    {collection.displayTitle}
                                                </h3>
                                                {collection.chapterCount > 0 && (
                                                    <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[11px] font-semibold">
                                                        {collection.chapterCount} 篇章节
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-surface-500 line-clamp-2">
                                                {collection.summary}
                                            </p>
                                            <div className="flex items-center justify-between mt-3 text-xs text-surface-400">
                                                <span>
                                                    {collection.chapterCount > 0
                                                        ? `总览 + ${collection.chapterCount} 篇分篇`
                                                        : '单篇解读'}
                                                </span>
                                                <span className="text-primary-600">进入本书</span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
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
                    )}
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
                                        {(() => {
                                            const modeCopy = getBodyMapModeCopy(BODY_REGION_LABELS[selectedBodyRegion], bodyMapMode);
                                            const ModeIcon = modeCopy.icon;
                                            return (
                                                <div className="rounded-2xl border border-primary-100 dark:border-primary-900/40 bg-primary-50/70 dark:bg-primary-900/15 p-4">
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-surface-900 text-surface-0 flex items-center justify-center shrink-0">
                                                            <ModeIcon className="w-4 h-4" />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2">
                                                                <h3 className="font-semibold text-surface-900 dark:text-surface-0 text-sm">
                                                                    {modeCopy.title}
                                                                </h3>
                                                                <span className="px-2 py-0.5 rounded-full bg-surface-0 dark:bg-surface-900 text-[10px] font-medium text-primary-600 dark:text-primary-300">
                                                                    {modeCopy.badge}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-surface-600 dark:text-surface-300 mt-1">
                                                                {modeCopy.subtitle}
                                                            </p>
                                                            <div className="grid gap-2 mt-3">
                                                                {modeCopy.steps.map((step, index) => (
                                                                    <div key={step} className="flex items-start gap-2 text-xs text-surface-700 dark:text-surface-200">
                                                                        <CheckCircle2 className="w-3.5 h-3.5 text-primary-500 mt-0.5 shrink-0" />
                                                                        <span>{index + 1}. {step}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* 头部：标题 + 创建按钮 */}
                                        <div className="flex items-center justify-between pb-3 border-b border-surface-200 dark:border-surface-700">
                                            <div>
                                                <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                                                    主文章
                                                </h3>
                                                <p className="text-xs text-surface-400 mt-0.5">
                                                    先用一篇详实文章覆盖筛查、训练和风险边界
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
                                            ) : displayedRegionNodes.length === 0 ? (
                                                <div className="text-sm text-surface-500 bg-surface-50 dark:bg-surface-800/50 rounded-2xl px-4 py-6 text-center animate-in fade-in zoom-in-95 duration-500">
                                                    <p>该模式暂时没有整理好的内容</p>
                                                    <p className="text-xs mt-1">可以先看上方 3 步，或点击"创建文章"补充</p>
                                                </div>
                                            ) : (
                                                displayedRegionNodes.map((node, index) => (
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
                                                                <div className="shrink-0 flex items-center gap-1">
                                                                    <span className="px-1.5 py-0.5 bg-surface-0 dark:bg-surface-900 text-surface-500 dark:text-surface-300 text-[10px] font-medium rounded">
                                                                        {getContentLevelLabel(node.content_summary?.content_level)}
                                                                    </span>
                                                                    {node.is_collaborative && (
                                                                        <span className="px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-[10px] font-medium rounded">
                                                                            共建
                                                                        </span>
                                                                    )}
                                                                </div>
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

                {SHOW_KNOWLEDGE_PILLARS && <div className={AERO_CONTAINER} />}
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
