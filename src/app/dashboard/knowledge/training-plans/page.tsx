"use client";

import React, { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Dumbbell, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import knowledgeService, {
    type PublicTrainingPlanLevel,
    type PublicTrainingPlanListItem,
} from "@/app/service/knowledgeService";

const LEVELS: Array<{ value: "all" | PublicTrainingPlanLevel; label: string }> = [
    { value: "all", label: "全部" },
    { value: "beginner", label: "入门" },
    { value: "intermediate", label: "进阶" },
    { value: "advanced", label: "高阶" },
];

const LEVEL_LABELS = {
    beginner: "入门",
    intermediate: "进阶",
    advanced: "高阶",
} as const;

const PAGE_SIZE = 24;

export default function TrainingPlanLibraryPage() {
    const router = useRouter();
    const [plans, setPlans] = useState<PublicTrainingPlanListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [level, setLevel] = useState<"all" | PublicTrainingPlanLevel>("all");
    const [query, setQuery] = useState("");
    const [activeQuery, setActiveQuery] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        async function loadPlans() {
            setLoading(true);
            try {
                const result = await knowledgeService.listTrainingPlans({
                    level,
                    limit: PAGE_SIZE,
                    offset: page * PAGE_SIZE,
                    search: activeQuery || undefined,
                });
                if (!cancelled) {
                    setPlans(result?.plans || []);
                    setTotal(result?.total || 0);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void loadPlans();
        return () => {
            cancelled = true;
        };
    }, [activeQuery, level, page]);

    function submitSearch(event: React.FormEvent) {
        event.preventDefault();
        setPage(0);
        setActiveQuery(query.trim());
    }

    function openPlan(plan: PublicTrainingPlanListItem) {
        if (plan.entryKind === "reference" && plan.sourceUrl) {
            window.open(plan.sourceUrl, "_blank", "noopener,noreferrer");
            return;
        }
        router.push(`/dashboard/knowledge/training-plans/${encodeURIComponent(plan.slug || plan.id)}`);
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="min-h-screen bg-surface-50 pb-24 dark:bg-surface-950">
            <div className="mx-auto max-w-6xl px-4 py-7">
                <button
                    type="button"
                    onClick={() => router.push("/dashboard/knowledge")}
                    className="mb-5 inline-flex items-center gap-2 text-sm font-black text-surface-500 transition hover:text-[#CF6D4E]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    返回知识库
                </button>

                <div className="mb-6 flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FDF2EC]">
                        <Dumbbell className="h-5 w-5 text-[#CF6D4E]" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-surface-950 dark:text-white">训练计划</h1>
                        <p className="mt-1 text-sm text-surface-500">共 {total} 套已发布计划，按目标和训练水平筛选。</p>
                    </div>
                </div>

                <div className="mb-6 rounded-3xl border border-surface-100 bg-white p-4 shadow-sm dark:border-surface-800 dark:bg-surface-900">
                    <form onSubmit={submitSearch} className="flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-surface-50 px-3 dark:bg-surface-800">
                            <Search className="h-4 w-4 shrink-0 text-surface-400" />
                            <input
                                type="search"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="搜索计划名称、运动或目标"
                                className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-surface-900 focus:outline-none dark:text-white"
                            />
                        </div>
                        <button
                            type="submit"
                            className="rounded-2xl bg-[#CF6D4E] px-5 py-3 text-sm font-black text-white transition hover:bg-[#b95f43] active:opacity-90"
                        >
                            搜索
                        </button>
                    </form>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {LEVELS.map((option) => (
                            <button
                                type="button"
                                key={option.value}
                                onClick={() => {
                                    setPage(0);
                                    setLevel(option.value);
                                }}
                                className={`rounded-full border px-3 py-1.5 text-xs font-black transition ${
                                    level === option.value
                                        ? "border-[#CF6D4E] bg-[#CF6D4E] text-white"
                                        : "border-surface-200 bg-white text-surface-500 hover:border-[#CF6D4E]/40 dark:border-surface-700 dark:bg-surface-900"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 9 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-48 animate-pulse rounded-3xl border border-surface-100 bg-white dark:border-surface-800 dark:bg-surface-900"
                            />
                        ))}
                    </div>
                ) : plans.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {plans.map((plan) => (
                            <button
                                type="button"
                                key={plan.id}
                                onClick={() => openPlan(plan)}
                                className="rounded-3xl border border-surface-100 bg-white p-5 text-left shadow-[0_14px_45px_rgba(15,23,42,0.05)] transition hover:border-[#CF6D4E]/30 hover:shadow-lg active:opacity-90 dark:border-surface-800 dark:bg-surface-900"
                            >
                                <div className="flex items-center justify-between gap-2 text-[11px] font-black">
                                    <span className="rounded-full bg-[#FDF2EC] px-2.5 py-1 text-[#B85D40]">
                                        {plan.specialtyLabel || plan.goal}
                                    </span>
                                    <span className="text-surface-400">{LEVEL_LABELS[plan.level]}</span>
                                </div>
                                {plan.entryKind === "reference" && (
                                    <p className="mt-2 text-[11px] font-bold text-surface-400">
                                        来源索引 · {plan.author || plan.sourceName || "原作者"}
                                    </p>
                                )}
                                <h2 className="mt-4 line-clamp-2 text-base font-black text-surface-950 dark:text-white">
                                    {plan.name}
                                </h2>
                                <p className="mt-2 line-clamp-3 text-xs leading-5 text-surface-500">
                                    {plan.description || "查看完整训练安排与适用人群。"}
                                </p>
                                <div className="mt-4 flex items-center justify-between text-xs font-bold">
                                    <div className="flex gap-3 text-surface-400">
                                        <span>{plan.weeks} 周</span>
                                        <span>{plan.daysPerWeek} 天/周</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-[#CF6D4E]" />
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    <div className="rounded-3xl border border-surface-100 bg-white p-10 text-center text-sm text-surface-500 dark:border-surface-800 dark:bg-surface-900">
                        没有找到匹配的训练计划。
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="mt-7 flex items-center justify-center gap-3">
                        <button
                            type="button"
                            disabled={page === 0}
                            onClick={() => setPage((value) => Math.max(0, value - 1))}
                            className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-black text-surface-600 disabled:opacity-40 dark:border-surface-700 dark:bg-surface-900"
                        >
                            上一页
                        </button>
                        <span className="text-sm text-surface-500">
                            {page + 1} / {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage((value) => value + 1)}
                            className="rounded-xl border border-surface-200 bg-white px-4 py-2 text-sm font-black text-surface-600 disabled:opacity-40 dark:border-surface-700 dark:bg-surface-900"
                        >
                            下一页
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
