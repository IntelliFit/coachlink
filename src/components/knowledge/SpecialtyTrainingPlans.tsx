"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, Dumbbell, Loader2, Target } from "lucide-react";
import knowledgeService, {
    type PublicTrainingPlanLevel,
    type PublicTrainingPlanListItem,
} from "@/app/service/knowledgeService";

const PLAN_SPECIALTY_FILTERS = [
    { key: "all", label: "专项精选" },
    { key: "bench_press", label: "卧推" },
    { key: "squat", label: "深蹲" },
    { key: "powerlifting", label: "力量举" },
    { key: "weighted_pullup", label: "负重引体" },
    { key: "weighted_dip", label: "负重双杠" },
    { key: "posture", label: "体态纠正" },
    { key: "foundation", label: "基础入门" },
];

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
    beginner: "入门",
    intermediate: "进阶",
    advanced: "专业",
};

function getLevelClass(level: PublicTrainingPlanLevel) {
    if (level === "beginner") return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (level === "intermediate") return "bg-amber-50 text-amber-700 border-amber-100";
    return "bg-rose-50 text-rose-700 border-rose-100";
}

export default function SpecialtyTrainingPlans() {
    const router = useRouter();
    const [specialty, setSpecialty] = useState("all");
    const [plans, setPlans] = useState<PublicTrainingPlanListItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function loadPlans() {
            setLoading(true);
            try {
                const res = await knowledgeService.listTrainingPlans({
                    level: "all",
                    specialty,
                    limit: specialty === "all" ? 12 : 16,
                    offset: 0,
                });
                if (!cancelled) setPlans(res?.plans || []);
            } catch (error) {
                console.error("获取专项训练计划失败:", error);
                if (!cancelled) setPlans([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadPlans();
        return () => {
            cancelled = true;
        };
    }, [specialty]);

    return (
        <section className="max-w-5xl mx-auto px-4 mb-4">
            <div className="rounded-[2rem] border border-surface-100 bg-surface-0 shadow-[0_18px_60px_rgba(15,23,42,0.06)] overflow-hidden">
                <div className="p-5 md:p-6 border-b border-surface-100 bg-[#fffaf6]">
                    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
                                <Target className="h-3.5 w-3.5" />
                                专项训练计划库
                            </div>
                            <h2 className="mt-3 text-2xl font-black tracking-tight text-surface-950">
                                先选目标，再选计划
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm text-surface-500">
                                主推卧推、深蹲、力量举、负重引体、负重双杠和体态纠正；基础计划只作为补充入口。
                            </p>
                        </div>
                        <button
                            onClick={() => router.push("/me/plan-lib")}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-black text-white transition hover:bg-primary-700 active:scale-[0.98]"
                        >
                            去我的计划库
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
                        {PLAN_SPECIALTY_FILTERS.map((filter) => (
                            <button
                                key={filter.key}
                                onClick={() => setSpecialty(filter.key)}
                                className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-black transition active:scale-[0.98] ${
                                    specialty === filter.key
                                        ? "border-primary-600 bg-primary-600 text-white"
                                        : "border-surface-200 bg-white text-surface-600 hover:border-primary-200 hover:text-primary-700"
                                }`}
                            >
                                {filter.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="p-4 md:p-5">
                    {loading ? (
                        <div className="flex h-48 items-center justify-center rounded-3xl bg-surface-50 text-surface-400">
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            加载专项计划中...
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="flex h-48 flex-col items-center justify-center rounded-3xl bg-surface-50 text-center">
                            <Dumbbell className="h-8 w-8 text-surface-300" />
                            <p className="mt-3 text-sm font-bold text-surface-600">暂无该专项计划</p>
                            <p className="mt-1 text-xs text-surface-400">可以先切回专项精选看看其他模板</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {plans.map((plan) => (
                                <button
                                    key={plan.id}
                                    onClick={() => router.push(`/dashboard/knowledge/training-plans/${encodeURIComponent(plan.slug || plan.id)}`)}
                                    className="group flex min-h-[240px] flex-col rounded-3xl border border-surface-100 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-xl"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-primary-600">
                                                {plan.specialtyLabel || plan.goal}
                                            </div>
                                            <h3 className="mt-2 line-clamp-2 text-lg font-black leading-tight text-surface-950">
                                                {plan.name}
                                            </h3>
                                        </div>
                                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${getLevelClass(plan.level)}`}>
                                            {PLAN_LEVEL_LABELS[plan.level]}
                                        </span>
                                    </div>

                                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-surface-500">
                                        {plan.description}
                                    </p>

                                    <div className="mt-4 grid grid-cols-3 gap-2">
                                        <div className="rounded-2xl bg-surface-50 px-3 py-2">
                                            <CalendarDays className="h-4 w-4 text-primary-600" />
                                            <div className="mt-1 text-sm font-black text-surface-900">{plan.weeks}周</div>
                                            <div className="text-[10px] text-surface-400">周期</div>
                                        </div>
                                        <div className="rounded-2xl bg-surface-50 px-3 py-2">
                                            <Clock3 className="h-4 w-4 text-primary-600" />
                                            <div className="mt-1 text-sm font-black text-surface-900">{plan.daysPerWeek}天</div>
                                            <div className="text-[10px] text-surface-400">每周</div>
                                        </div>
                                        <div className="rounded-2xl bg-surface-50 px-3 py-2">
                                            <CheckCircle2 className="h-4 w-4 text-primary-600" />
                                            <div className="mt-1 text-sm font-black text-surface-900">{plan.trainingDayCount || "-"}</div>
                                            <div className="text-[10px] text-surface-400">训练日</div>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {[plan.goal, ...plan.tags].filter(Boolean).slice(0, 3).map((tag) => (
                                            <span key={tag} className="rounded-full bg-surface-50 px-2.5 py-1 text-[11px] font-bold text-surface-500">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-auto flex items-center justify-between pt-4 text-sm font-black text-primary-600">
                                        <span>查看动作结构</span>
                                        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
