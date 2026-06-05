"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  Library,
  MapPin,
  Search,
  Sparkles,
  Target,
} from "lucide-react";
import AIChatPanel from "@/components/knowledge/AIChatPanel";
import BodyMapCanvas, { BODY_REGION_LABELS, type BodyRegion } from "@/components/knowledge/BodyMap/BodyMapCanvas";
import BodyMapModeSwitch from "@/components/knowledge/BodyMap/BodyMapModeSwitch";
import SpecialtyTrainingPlans from "@/components/knowledge/SpecialtyTrainingPlans";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookCollection, groupKnowledgeBooks } from "@/lib/knowledgeBooks";
import {
  knowledgeCoreTopics,
  type KnowledgeCoreTopic,
  type KnowledgeCoreTopicTag,
  type KnowledgeCoreTopicKey,
} from "@/config/knowledgeCoreTopics";

type BodyMapMode = "screening" | "training";
type KnowledgeShelf = "body-map" | "plans" | "books" | null;

type KnowledgeNode = {
  id: string;
  title: string;
  description: string | null;
  difficulty: number;
  is_free: boolean;
  content_summary?: {
    content_level?: string;
  };
};

const AERO_CONTAINER = "max-w-5xl mx-auto px-4";
const AERO_PANEL = "rounded-[2rem] border border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 shadow-[0_18px_60px_rgba(15,23,42,0.06)]";

const PLAN_LABELS: Record<string, string> = {
  "weighted-pullup-6w-strength": "负重引体 6 周力量专项",
  "weighted-dip-6w-strength": "负重臂屈伸 6 周专项",
  "bench-press-8w-specialization": "卧推 8 周专项提升",
  "squat-8w-depth-and-strength": "深蹲 8 周深度与力量专项",
  "powerlifting-12w-total-base": "力量举 12 周基础周期",
  "round-shoulder-scapula-4w": "圆肩/肩胛控制 4 周",
  "anterior-pelvic-tilt-4w": "骨盆前倾/核心稳定 4 周",
};

function getContentLevelLabel(level?: string) {
  if (level === "formal-guide") return "系统指南";
  if (level === "article-guide") return "延伸阅读";
  if (level === "transcript-pack") return "素材包";
  return "知识点";
}

function getBodyMapModeCopy(region: string, mode: BodyMapMode) {
  if (mode === "screening") {
    return {
      title: `${region} 筛查`,
      subtitle: "先判断疼痛、受限或代偿是否影响当前训练。",
      steps: ["看左右活动范围是否明显不同", "看训练后是否反复在同一区域不适", "看负重时是否出现失控或疼痛升级"],
    };
  }

  return {
    title: `${region} 训练`,
    subtitle: "再选择低风险动作，逐步恢复发力和负荷。",
    steps: ["先用低强度动作找回控制", "再选择能稳定重复的主训练动作", "最后按周增加组数、次数或重量"],
  };
}

export default function KnowledgeBaseHomePage() {
  const router = useRouter();

  const [showAIChat, setShowAIChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTopicKey, setActiveTopicKey] = useState<KnowledgeCoreTopicKey>("injury");
  const [expandedShelf, setExpandedShelf] = useState<KnowledgeShelf>(null);
  const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection[]>([]);
  const [loadingBookCollections, setLoadingBookCollections] = useState(true);
  const [bodyMapMode, setBodyMapMode] = useState<BodyMapMode>("screening");
  const [selectedBodyRegion, setSelectedBodyRegion] = useState<BodyRegion | null>(null);
  const [regionNodes, setRegionNodes] = useState<KnowledgeNode[]>([]);
  const [loadingRegionNodes, setLoadingRegionNodes] = useState(false);

  const activeTopic = knowledgeCoreTopics.find((topic) => topic.topicKey === activeTopicKey) || knowledgeCoreTopics[0];

  useEffect(() => {
    let cancelled = false;

    async function fetchBookCollections() {
      try {
        const result = await knowledgeService.listKnowledgeBooks({ is_published: true });
        if (!cancelled) setBookCollections(groupKnowledgeBooks(result?.books || []));
      } catch (error) {
        console.error("[knowledge] load failed:", error);
        if (!cancelled) setBookCollections([]);
      } finally {
        if (!cancelled) setLoadingBookCollections(false);
      }
    }

    fetchBookCollections();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedBodyRegion) {
      setRegionNodes([]);
      return;
    }

    let cancelled = false;
    async function fetchRegionNodes() {
      setLoadingRegionNodes(true);
      try {
        const params = new URLSearchParams({
          body_region: selectedBodyRegion,
          mode: bodyMapMode,
          limit: "6",
        });
        const res = await fetch(`/api/knowledge/nodes?${params.toString()}`);
        const json = await res.json();
        if (!cancelled) setRegionNodes(json.nodes || []);
      } catch (error) {
        console.error("[knowledge] load failed:", error);
        if (!cancelled) setRegionNodes([]);
      } finally {
        if (!cancelled) setLoadingRegionNodes(false);
      }
    }

    fetchRegionNodes();
    return () => {
      cancelled = true;
    };
  }, [selectedBodyRegion, bodyMapMode]);

  function handleSearch(query?: string) {
    const q = (query || searchQuery).trim();
    if (q) router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(q)}`);
  }

  function handleTopicAction(kind: KnowledgeCoreTopicTag["kind"], value: string, topic?: KnowledgeCoreTopic) {
    if (topic) setActiveTopicKey(topic.topicKey);
    if (kind === "search") {
      setSearchQuery(value);
      return;
    }
    if (kind === "plans") {
      setExpandedShelf("plans");
      return;
    }
    if (kind === "books") {
      setExpandedShelf("books");
      return;
    }
    setBodyMapMode("screening");
    setExpandedShelf("body-map");
  }

  function selectTopic(topic: KnowledgeCoreTopic) {
    setActiveTopicKey(topic.topicKey);
    setExpandedShelf(null);
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="relative z-10">
        <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
                <BookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-surface-950 dark:text-surface-0">知识库</h1>
                <p className="mt-1 text-sm text-surface-500">先选问题，再看资料和计划。</p>
              </div>
            </div>
          </div>

          <div className="flex items-center overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <Search className="ml-4 h-4 w-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              placeholder="搜索知识点、部位或动作..."
              className="flex-1 bg-transparent px-3 py-3.5 text-sm text-surface-900 placeholder-surface-400 focus:outline-none dark:text-surface-0"
            />
            <button
              onClick={() => handleSearch()}
              disabled={!searchQuery.trim()}
              className="mr-1.5 rounded-xl bg-[#CF6D4E] px-4 py-2 text-sm font-black text-white transition disabled:bg-surface-200 disabled:text-surface-400"
            >
              搜索
            </button>
          </div>
        </div>

        <section className={`${AERO_CONTAINER} mb-5`} data-section="knowledge-under-construction">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-black">知识库正在建设中</p>
            <p className="mt-1 leading-6">这里先放最核心的入口和部分资料，后续会继续补齐文章、计划和人体地图。涉及疼痛或伤病时，请优先线下就医或做运动康复评估。</p>
          </div>
        </section>

        <section className={`${AERO_CONTAINER} mb-5`}>
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600">Start Here</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-surface-950 dark:text-surface-0">你现在最想解决什么？</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {knowledgeCoreTopics.map((topic) => {
              const isActive = topic.topicKey === activeTopicKey;
              return (
                <article
                  key={topic.topicKey}
                  className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl dark:bg-surface-900 ${
                    isActive ? "border-primary-300 ring-2 ring-primary-100" : "border-surface-100 dark:border-surface-800"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => selectTopic(topic)}
                    className="block w-full text-left"
                  >
                    <div className="h-28 w-full overflow-hidden bg-surface-100 sm:h-32">
                      <img src={topic.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="p-3 sm:p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="truncate rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-black text-primary-700">
                          {topic.eyebrow}
                        </span>
                        {isActive && <CheckCircle2 className="h-4 w-4 text-primary-600" />}
                      </div>
                      <h3 className="text-base font-black leading-tight text-surface-950 dark:text-surface-0 sm:text-lg">{topic.shortTitle}</h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-surface-500 sm:text-sm">{topic.description}</p>
                    </div>
                  </button>
                  <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                    <button
                      onClick={() => selectTopic(topic)}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-black transition active:scale-[0.98] sm:text-sm ${
                        isActive ? "bg-[#CF6D4E] text-white" : "bg-surface-100 text-surface-700 hover:bg-surface-200"
                      }`}
                    >
                      {isActive ? "正在查看" : "查看推荐"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`${AERO_CONTAINER} mb-5`}>
          <div className={`${AERO_PANEL} p-5`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
                  <Target className="h-3.5 w-3.5" />
                  褰撳墠鎺ㄨ崘
                </div>
                <h2 className="mt-3 text-xl font-black text-surface-950 dark:text-surface-0">{activeTopic.title}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-surface-500">{activeTopic.description}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/60">
                <p className="text-xs font-black text-surface-400">鏂囩珷</p>
                <div className="mt-2 space-y-2">
                  {activeTopic.linkedArticles.map((item) => (
                    <button key={item} onClick={() => setSearchQuery(item)} className="block text-left text-sm font-bold text-surface-800 hover:text-primary-700 dark:text-surface-100">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/60">
                <p className="text-xs font-black text-surface-400">璁″垝</p>
                <div className="mt-2 space-y-2">
                  {activeTopic.linkedPlans.slice(0, 4).map((item) => (
                    <button
                      key={item}
                      onClick={() => router.push(`/dashboard/knowledge/training-plans/${encodeURIComponent(item)}`)}
                      className="block text-left text-sm font-bold text-surface-800 hover:text-primary-700 dark:text-surface-100"
                    >
                      {PLAN_LABELS[item] || item}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-surface-50 p-4 dark:bg-surface-800/60">
                <p className="text-xs font-black text-surface-400">娣卞害璧勬枡</p>
                <div className="mt-2 space-y-2">
                  {activeTopic.linkedBooks.map((item) => (
                    <button key={item} onClick={() => setExpandedShelf("books")} className="block text-left text-sm font-bold text-surface-800 hover:text-primary-700 dark:text-surface-100">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              <button
                onClick={() => setExpandedShelf(expandedShelf === "body-map" ? null : "body-map")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-black text-surface-800 transition hover:border-primary-200 hover:text-primary-700"
              >
                <MapPin className="h-4 w-4 text-primary-600" />
                {expandedShelf === "body-map" ? "收起人体地图" : "展开人体地图"}
              </button>
              <button
                onClick={() => setExpandedShelf(expandedShelf === "plans" ? null : "plans")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-black text-surface-800 transition hover:border-primary-200 hover:text-primary-700"
              >
                <Dumbbell className="h-4 w-4 text-primary-600" />
                {expandedShelf === "plans" ? "收起计划库" : "展开计划库"}
              </button>
              <button
                onClick={() => setExpandedShelf(expandedShelf === "books" ? null : "books")}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-black text-surface-800 transition hover:border-primary-200 hover:text-primary-700"
              >
                <Library className="h-4 w-4 text-primary-600" />
                {expandedShelf === "books" ? "收起书籍" : "展开书籍"}
              </button>
            </div>
          </div>
        </section>

        {expandedShelf === "body-map" && <div className={`${AERO_CONTAINER} mb-5`}>
          <div className={`${AERO_PANEL} overflow-hidden p-4 md:p-6`}>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary-600" />
                  <h2 className="text-lg font-black text-surface-950 dark:text-surface-0">不舒服时先看这里</h2>
                </div>
                <p className="mt-1 text-sm text-surface-500">人体地图保留筛查/训练两种模式，适合承接疼痛、受限和代偿问题。</p>
              </div>
              <BodyMapModeSwitch mode={bodyMapMode} onChange={setBodyMapMode} />
            </div>

            <div className="lg:grid lg:grid-cols-12 lg:gap-8">
              <div className="lg:col-span-5">
                <BodyMapCanvas
                  mode={bodyMapMode}
                  selectedRegion={selectedBodyRegion}
                  onRegionClick={(region) => setSelectedBodyRegion((prev) => (prev === region ? null : region))}
                  isFocusMode={!!selectedBodyRegion}
                />
              </div>

              <div className="mt-6 lg:col-span-7 lg:mt-0">
                {selectedBodyRegion ? (
                  <BodyRegionPanel
                    region={selectedBodyRegion}
                    mode={bodyMapMode}
                    nodes={regionNodes}
                    loading={loadingRegionNodes}
                  />
                ) : (
                  <div className="rounded-3xl bg-primary-50/70 p-5 dark:bg-primary-900/15">
                    <h3 className="text-base font-black text-surface-950 dark:text-surface-0">选择一个部位开始</h3>
                    <p className="mt-2 text-sm leading-6 text-surface-600 dark:text-surface-300">
                      第一版优先承接肩、腕、肘、腰背、髋膝踝等高频问题。涉及持续疼痛、麻木、放射痛或急性损伤时，应优先线下就医或康复评估。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>}

        {expandedShelf === "plans" && <div>
          <SpecialtyTrainingPlans />
        </div>}

        {expandedShelf === "books" && <section className={`${AERO_CONTAINER} mb-5`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-surface-950 dark:text-surface-0">深度资料</h2>
              <p className="mt-1 text-sm text-surface-500">书籍笔记下沉为延伸阅读，不再抢首屏主入口。</p>
            </div>
            <button
              onClick={() => router.push("/dashboard/knowledge/books")}
              className="inline-flex items-center gap-1 text-sm font-black text-primary-600"
            >
              全部书籍
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {loadingBookCollections ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className={`${AERO_PANEL} h-28 animate-pulse`} />
              ))}
            </div>
          ) : bookCollections.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {bookCollections.slice(0, 4).map((collection) => (
                <button
                  key={collection.slug}
                  onClick={() => router.push(`/dashboard/knowledge/books/${collection.representativeBook.id}`)}
                  className={`${AERO_PANEL} p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98]`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50">
                      <BookOpen className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-black text-surface-950 dark:text-surface-0">{collection.displayTitle}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-surface-500">{collection.summary}</p>
                      <p className="mt-2 text-xs font-black text-primary-600">进入本书</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={`${AERO_PANEL} p-6 text-center text-sm text-surface-500`}>暂无书籍笔记。</div>
          )}
        </section>}
      </div>

      <button
        onClick={() => setShowAIChat(true)}
        className="fixed bottom-24 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-900 text-white shadow-lg transition hover:scale-110 active:scale-95 dark:bg-surface-700"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <AIChatPanel isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </div>
  );
}

function BodyRegionPanel({
  region,
  mode,
  nodes,
  loading,
}: {
  region: BodyRegion;
  mode: BodyMapMode;
  nodes: KnowledgeNode[];
  loading: boolean;
}) {
  const router = useRouter();
  const copy = getBodyMapModeCopy(BODY_REGION_LABELS[region] || region, mode);

  return (
    <div className="space-y-3">
      <div className="rounded-3xl border border-primary-100 bg-primary-50/70 p-5 dark:border-primary-900/40 dark:bg-primary-900/15">
        <h3 className="text-base font-black text-surface-950 dark:text-surface-0">{copy.title}</h3>
        <p className="mt-1 text-sm text-surface-600 dark:text-surface-300">{copy.subtitle}</p>
        <div className="mt-4 grid gap-2">
          {copy.steps.map((step, index) => (
            <div key={step} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-200">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" />
              <span>{index + 1}. {step}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-surface-100 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-black text-surface-950 dark:text-surface-0">相关资料</h3>
          <button
            onClick={() => router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(region)}`)}
            className="text-xs font-black text-primary-600"
          >
            搜索更多
          </button>
        </div>
        {loading ? (
          <div className="h-20 animate-pulse rounded-2xl bg-surface-100 dark:bg-surface-800" />
        ) : nodes.length === 0 ? (
          <p className="rounded-2xl bg-surface-50 px-4 py-5 text-center text-sm text-surface-500 dark:bg-surface-800/60">
            这个部位暂时还没有整理好的内容。
          </p>
        ) : (
          <div className="space-y-2">
            {nodes.slice(0, 4).map((node) => (
              <button
                key={node.id}
                onClick={() => router.push(`/dashboard/knowledge/nodes/${node.id}`)}
                className="flex w-full items-center justify-between gap-3 rounded-2xl bg-surface-50 px-4 py-3 text-left transition hover:bg-primary-50 dark:bg-surface-800/60"
              >
                <div className="min-w-0">
                  <p className="line-clamp-1 text-sm font-black text-surface-900 dark:text-surface-0">{node.title}</p>
                  {node.description && <p className="mt-1 line-clamp-1 text-xs text-surface-500">{node.description}</p>}
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-surface-500 dark:bg-surface-900">
                  {getContentLevelLabel(node.content_summary?.content_level)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
