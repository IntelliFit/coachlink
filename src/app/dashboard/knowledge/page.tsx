"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  Dumbbell,
  Search,
  Sparkles,
} from "lucide-react";
import AIChatPanel from "@/components/knowledge/AIChatPanel";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookCollection, groupKnowledgeBooks } from "@/lib/knowledgeBooks";

const PAGE_CONTAINER = "mx-auto max-w-5xl px-4";
const PANEL =
  "rounded-3xl border border-surface-100 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.06)] dark:border-surface-800 dark:bg-surface-900";

const QUICK_TAGS = ["平台期", "动作标准", "肩腕腰痛", "训练计划", "书籍笔记"];

const FOCUS_TOPICS = [
  {
    title: "训练计划与平台期",
    description: "优先整理负重引体、卧推、深蹲、力量举与体态纠正等高需求方向，帮助用户快速找到可执行方案。",
    actionLabel: "搜索相关计划",
    query: "平台期 训练计划 负重引体 卧推 深蹲",
    icon: Dumbbell,
  },
  {
    title: "动作标准与自查",
    description: "围绕引体、臂屈伸、深蹲、卧推、硬拉等基础动作，沉淀检查表、拍摄角度和常见代偿。",
    actionLabel: "查看动作自查",
    query: "动作标准 自查 引体 臂屈伸 深蹲 卧推 硬拉",
    icon: ClipboardCheck,
  },
  {
    title: "伤病避险与恢复",
    description: "聚焦肩、腕、肘、腰背等高频不适，提供训练调整、避险边界和恢复资料索引。",
    actionLabel: "查看避险资料",
    query: "伤病 康复 疼痛 肩 手腕 肘 腰背",
    icon: AlertTriangle,
  },
];

const FEATURED_PLAN_IDS = [
  "weighted-pullup-6w-strength",
  "weighted-dip-6w-strength",
  "bench-press-8w-specialization",
  "squat-8w-depth-and-strength",
  "round-shoulder-scapula-4w",
  "anterior-pelvic-tilt-4w",
];

const PLAN_LABELS: Record<string, string> = {
  "weighted-pullup-6w-strength": "负重引体 6 周力量专项",
  "weighted-dip-6w-strength": "负重臂屈伸 6 周专项",
  "bench-press-8w-specialization": "卧推 8 周专项提升",
  "squat-8w-depth-and-strength": "深蹲 8 周深度与力量专项",
  "powerlifting-12w-total-base": "力量举 12 周基础周期",
  "round-shoulder-scapula-4w": "圆肩 / 肩胛控制 4 周",
  "anterior-pelvic-tilt-4w": "骨盆前倾 / 核心稳定 4 周",
};

const PLAN_DESCRIPTIONS: Record<string, string> = {
  "weighted-pullup-6w-strength": "面向负重引体平台期，围绕强度日、容量日和辅助拉力组织训练。",
  "weighted-dip-6w-strength": "用于提升推力基础，适合负重臂屈伸、俄挺塔基和上肢推力专项。",
  "bench-press-8w-specialization": "以卧推专项进步为目标，兼顾做组能力、技术稳定和辅助动作。",
  "squat-8w-depth-and-strength": "用于改善深蹲深度、发力路径和基础力量储备。",
  "round-shoulder-scapula-4w": "围绕肩胛控制、胸椎活动度和上背激活做轻量纠正。",
  "anterior-pelvic-tilt-4w": "围绕核心稳定、髋屈肌放松和臀腿发力重建训练节奏。",
};

export default function KnowledgeBaseHomePage() {
  const router = useRouter();
  const [showAIChat, setShowAIChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection[]>([]);
  const [loadingBookCollections, setLoadingBookCollections] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchBookCollections() {
      try {
        const result = await knowledgeService.listKnowledgeBooks({ is_published: true });
        if (!cancelled) setBookCollections(groupKnowledgeBooks(result?.books || []));
      } catch (error) {
        console.error("[knowledge] load books failed:", error);
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

  function handleSearch(query?: string) {
    const q = (query || searchQuery).trim();
    if (!q) return;
    router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen bg-surface-50 pb-24 dark:bg-surface-950">
      <div className="relative z-10">
        <section className={`${PAGE_CONTAINER} pt-6 pb-4`}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
              <BookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-surface-950 dark:text-surface-0">知识库</h1>
              <p className="mt-1 text-sm text-surface-500">优先呈现训练计划、动作标准、伤病避险与书籍资料。</p>
            </div>
          </div>

          <div className="flex items-center overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
            <Search className="ml-4 h-4 w-4 text-surface-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSearch()}
              placeholder="搜索动作、计划、伤病或书籍..."
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

          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => handleSearch(tag)}
                className="rounded-full border border-surface-200 bg-white px-3 py-1.5 text-xs font-bold text-surface-600 transition hover:border-primary-200 hover:text-primary-700 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-300"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        <section className={`${PAGE_CONTAINER} mb-5`}>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
            <p className="font-black">知识库仍在建设中</p>
            <p className="mt-1 leading-6">
              当前先开放最核心的训练与学习资料，后续会持续补齐文章、计划和专题。涉及疼痛、麻木、放射痛、急性损伤或长期不适时，本页内容不能替代医疗诊断，应优先线下就医或做运动康复评估。
            </p>
          </div>
        </section>

        <section className={`${PAGE_CONTAINER} mb-6`}>
          <div className="mb-3">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary-600">精选专题</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-surface-950 dark:text-surface-0">先看最常见、最值得解决的问题</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {FOCUS_TOPICS.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.title} className={`${PANEL} p-4`}>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-900/30">
                      <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-black text-surface-950 dark:text-surface-0">{topic.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-surface-500">{topic.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSearch(topic.query)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#CF6D4E] px-4 py-3 text-sm font-black text-white transition hover:bg-[#b95f43] active:opacity-90"
                  >
                    {topic.actionLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        <section className={`${PAGE_CONTAINER} mb-6`}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-surface-950 dark:text-surface-0">重点训练计划</h2>
              <p className="mt-1 text-sm text-surface-500">先放高频目标，减少用户在计划库里自行筛选的成本。</p>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {FEATURED_PLAN_IDS.map((planId) => (
              <button
                key={planId}
                onClick={() => router.push(`/dashboard/knowledge/training-plans/${encodeURIComponent(planId)}`)}
                className={`${PANEL} p-4 text-left transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-xl active:scale-[0.99]`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-black text-surface-950 dark:text-surface-0">{PLAN_LABELS[planId] || planId}</h3>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-surface-500">{PLAN_DESCRIPTIONS[planId]}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary-600" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={`${PAGE_CONTAINER} mb-6`}>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-surface-950 dark:text-surface-0">书籍笔记</h2>
              <p className="mt-1 text-sm text-surface-500">保留深度资料入口，适合需要理解原理时再阅读。</p>
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
                <div key={index} className={`${PANEL} h-28 animate-pulse`} />
              ))}
            </div>
          ) : bookCollections.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {bookCollections.slice(0, 4).map((collection) => (
                <button
                  key={collection.slug}
                  onClick={() => router.push(`/dashboard/knowledge/books/${collection.representativeBook.id}`)}
                  className={`${PANEL} p-4 text-left transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-xl active:scale-[0.99]`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-900/20">
                      <BookOpen className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="line-clamp-1 text-sm font-black text-surface-950 dark:text-surface-0">{collection.displayTitle}</h3>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-surface-500">{collection.summary}</p>
                      <p className="mt-2 text-xs font-black text-primary-600">进入阅读</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={`${PANEL} p-6 text-center text-sm text-surface-500`}>暂无书籍笔记。</div>
          )}
        </section>
      </div>

      <button
        onClick={() => setShowAIChat(true)}
        aria-label="打开知识库 AI 助手"
        className="fixed bottom-24 right-4 flex h-12 w-12 items-center justify-center rounded-full bg-surface-900 text-white shadow-lg transition hover:scale-110 active:scale-95 dark:bg-surface-700"
      >
        <Sparkles className="h-5 w-5" />
      </button>

      <AIChatPanel isOpen={showAIChat} onClose={() => setShowAIChat(false)} />
    </div>
  );
}
