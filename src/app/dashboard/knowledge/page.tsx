"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowRight,
    BookOpen,
    CalendarDays,
    ChevronRight,
    Dumbbell,
    FileText,
    Search,
    UserRound,
} from "lucide-react";
import knowledgeService, {
    type PublicTrainingPlanListItem,
} from "@/app/service/knowledgeService";
import {
    type KnowledgeBookCollection,
    groupKnowledgeBooks,
} from "@/lib/knowledgeBooks";

type PublicArticle = {
    id: string;
    coachName: string;
    coachAvatarUrl: string | null;
    title: string;
    summary: string;
    requiredTier: number;
    priceCents: number;
    featured: boolean;
    publishedAt: string | null;
};

const PAGE_CONTAINER = "mx-auto max-w-5xl px-4";
const PANEL =
    "rounded-3xl border border-surface-100 bg-white shadow-[0_14px_45px_rgba(15,23,42,0.05)] dark:border-surface-800 dark:bg-surface-900";

const LEVEL_LABELS = {
    beginner: "入门",
    intermediate: "进阶",
    advanced: "高阶",
} as const;

function formatDate(value: string | null) {
    if (!value) return "";
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? new Date(time).toLocaleDateString("zh-CN") : "";
}

export default function KnowledgeBaseHomePage() {
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState("");
    const [trainingPlans, setTrainingPlans] = useState<PublicTrainingPlanListItem[]>([]);
    const [trainingPlanTotal, setTrainingPlanTotal] = useState(0);
    const [articles, setArticles] = useState<PublicArticle[]>([]);
    const [articleTotal, setArticleTotal] = useState(0);
    const [bookCollections, setBookCollections] = useState<KnowledgeBookCollection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadKnowledgeHome() {
            const [planResult, articleResult, bookResult] = await Promise.allSettled([
                knowledgeService.listTrainingPlans({ level: "all", limit: 6, offset: 0 }),
                fetch("/api/public/articles/list?limit=4&offset=0").then((response) => response.json()),
                knowledgeService.listKnowledgeBooks({ is_published: true, page: 0, limit: 1000 }),
            ]);
            if (cancelled) return;

            if (planResult.status === "fulfilled" && planResult.value) {
                setTrainingPlans(planResult.value.plans || []);
                setTrainingPlanTotal(planResult.value.total || 0);
            }
            if (articleResult.status === "fulfilled" && articleResult.value?.success) {
                setArticles(articleResult.value.data?.items || []);
                setArticleTotal(articleResult.value.data?.total || 0);
            }
            if (bookResult.status === "fulfilled") {
                setBookCollections(groupKnowledgeBooks(bookResult.value?.books || []));
            }
            setLoading(false);
        }

        void loadKnowledgeHome();
        return () => {
            cancelled = true;
        };
    }, []);

    function handleSearch() {
        const query = searchQuery.trim();
        if (!query) return;
        router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(query)}`);
    }

    function openPlan(plan: PublicTrainingPlanListItem) {
        if (plan.entryKind === "reference" && plan.sourceUrl) {
            window.open(plan.sourceUrl, "_blank", "noopener,noreferrer");
            return;
        }
        router.push(`/dashboard/knowledge/training-plans/${encodeURIComponent(plan.slug || plan.id)}`);
    }

    return (
        <div className="min-h-screen bg-surface-50 pb-24 dark:bg-surface-950">
            <section className={`${PAGE_CONTAINER} pt-7 pb-5`}>
                <div className="mb-5">
                    <h1 className="text-3xl font-black tracking-tight text-surface-950 dark:text-white">
                        知识库
                    </h1>
                    <p className="mt-2 text-sm leading-6 text-surface-500">
                        训练计划、精选好文和书籍笔记，三类内容集中在这里。
                    </p>
                </div>

                <div className="flex items-center overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm dark:border-surface-800 dark:bg-surface-900">
                    <Search className="ml-4 h-4 w-4 text-surface-400" />
                    <input
                        type="search"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                        placeholder="搜索计划、文章或书籍"
                        className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-sm text-surface-900 placeholder-surface-400 focus:outline-none dark:text-white"
                    />
                    <button
                        type="button"
                        onClick={handleSearch}
                        disabled={!searchQuery.trim()}
                        className="mr-1.5 rounded-xl bg-[#CF6D4E] px-4 py-2 text-sm font-black text-white transition hover:bg-[#b95f43] active:opacity-90 disabled:cursor-not-allowed disabled:bg-surface-200 disabled:text-surface-400"
                    >
                        搜索
                    </button>
                </div>
            </section>

            <section className={`${PAGE_CONTAINER} mb-8`}>
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <Dumbbell className="h-5 w-5 text-[#CF6D4E]" />
                            <h2 className="text-xl font-black text-surface-950 dark:text-white">训练计划</h2>
                        </div>
                        <p className="mt-1 text-sm text-surface-500">
                            {trainingPlanTotal > 0 ? `${trainingPlanTotal} 套已发布计划，可查看并加入自己的计划库。` : "按目标与水平挑选可执行计划。"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard/knowledge/training-plans")}
                        className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-[#CF6D4E]"
                    >
                        全部计划
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className={`${PANEL} h-32 animate-pulse`} />
                        ))}
                    </div>
                ) : trainingPlans.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {trainingPlans.map((plan) => (
                            <button
                                type="button"
                                key={plan.id}
                                onClick={() => openPlan(plan)}
                                className={`${PANEL} p-4 text-left transition hover:border-[#CF6D4E]/30 hover:shadow-lg active:opacity-90`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
                                            <span className="rounded-full bg-[#FDF2EC] px-2.5 py-1 text-[#B85D40]">
                                                {plan.specialtyLabel || plan.goal}
                                            </span>
                                            <span className="text-surface-400">{LEVEL_LABELS[plan.level]}</span>
                                            {plan.entryKind === "reference" && (
                                                <span className="text-surface-400">来源索引</span>
                                            )}
                                        </div>
                                        <h3 className="mt-3 line-clamp-1 text-base font-black text-surface-950 dark:text-white">
                                            {plan.name}
                                        </h3>
                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-surface-500">
                                            {plan.description || "查看完整训练安排与适用人群。"}
                                        </p>
                                        <div className="mt-3 flex items-center gap-3 text-xs font-bold text-surface-400">
                                            <span>{plan.weeks} 周</span>
                                            <span>{plan.daysPerWeek} 天/周</span>
                                        </div>
                                    </div>
                                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#CF6D4E]" />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className={`${PANEL} p-7 text-center text-sm text-surface-500`}>
                        暂无已发布训练计划。
                    </div>
                )}
            </section>

            <section className={`${PAGE_CONTAINER} mb-8`}>
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <FileText className="h-5 w-5 text-[#CF6D4E]" />
                            <h2 className="text-xl font-black text-surface-950 dark:text-white">精选好文</h2>
                        </div>
                        <p className="mt-1 text-sm text-surface-500">
                            {articleTotal > 0 ? `${articleTotal} 篇平台与教练发布内容。` : "汇集平台编辑与教练的训练经验。"}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard/knowledge/articles")}
                        className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-[#CF6D4E]"
                    >
                        全部好文
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                            <div key={index} className={`${PANEL} h-28 animate-pulse`} />
                        ))}
                    </div>
                ) : articles.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {articles.map((article) => (
                            <button
                                type="button"
                                key={article.id}
                                onClick={() => router.push(`/articles/${article.id}`)}
                                className={`${PANEL} p-4 text-left transition hover:border-[#CF6D4E]/30 hover:shadow-lg active:opacity-90`}
                            >
                                <div className="flex items-center gap-2 text-xs text-surface-500">
                                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-surface-100 dark:bg-surface-800">
                                        {article.coachAvatarUrl ? (
                                            <img src={article.coachAvatarUrl} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <UserRound className="h-3.5 w-3.5" />
                                        )}
                                    </div>
                                    <span className="min-w-0 truncate font-bold">{article.coachName}</span>
                                    {article.featured && (
                                        <span className="ml-auto rounded-full bg-[#FDF2EC] px-2 py-0.5 font-black text-[#B85D40]">精选</span>
                                    )}
                                </div>
                                <h3 className="mt-3 line-clamp-2 text-base font-black text-surface-950 dark:text-white">
                                    {article.title}
                                </h3>
                                <p className="mt-1 line-clamp-2 text-xs leading-5 text-surface-500">
                                    {article.summary || "阅读全文"}
                                </p>
                                <div className="mt-3 flex items-center gap-1 text-xs text-surface-400">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    <span>{formatDate(article.publishedAt)}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className={`${PANEL} p-7 text-center text-sm text-surface-500`}>
                        教练发布文字内容后，会自动汇入这里。
                    </div>
                )}
            </section>

            <section className={`${PAGE_CONTAINER} mb-8`}>
                <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                        <div className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5 text-[#CF6D4E]" />
                            <h2 className="text-xl font-black text-surface-950 dark:text-white">书籍笔记</h2>
                        </div>
                        <p className="mt-1 text-sm text-surface-500">把经典训练书籍整理成更容易查阅的笔记。</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard/knowledge/books")}
                        className="inline-flex shrink-0 items-center gap-1 text-sm font-black text-[#CF6D4E]"
                    >
                        全部书籍
                        <ChevronRight className="h-4 w-4" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, index) => (
                            <div key={index} className={`${PANEL} h-28 animate-pulse`} />
                        ))}
                    </div>
                ) : bookCollections.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                        {bookCollections.slice(0, 4).map((collection) => (
                            <button
                                type="button"
                                key={collection.slug}
                                onClick={() => router.push(`/dashboard/knowledge/books/${collection.representativeBook.id}`)}
                                className={`${PANEL} p-4 text-left transition hover:border-[#CF6D4E]/30 hover:shadow-lg active:opacity-90`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FDF2EC]">
                                        <BookOpen className="h-5 w-5 text-[#CF6D4E]" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="line-clamp-1 text-sm font-black text-surface-950 dark:text-white">
                                            {collection.displayTitle}
                                        </h3>
                                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-surface-500">
                                            {collection.summary}
                                        </p>
                                        <p className="mt-2 text-xs font-black text-[#CF6D4E]">
                                            {collection.chapterCount > 0 ? `${collection.chapterCount} 篇笔记` : "进入阅读"}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className={`${PANEL} p-7 text-center text-sm text-surface-500`}>
                        暂无书籍笔记。
                    </div>
                )}
            </section>
        </div>
    );
}
