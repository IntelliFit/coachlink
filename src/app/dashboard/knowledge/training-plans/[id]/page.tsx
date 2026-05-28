"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
    ArrowLeft,
    BookMarked,
    CalendarDays,
    CheckCircle2,
    Clock3,
    Dumbbell,
    Loader2,
    ShieldCheck,
    Target,
} from "lucide-react";
import knowledgeService, {
    type PublicTrainingPlanDetail,
    type PublicTrainingPlanLevel,
} from "@/app/service/knowledgeService";
import { useToastContext } from "@/context/ToastContext";

const PLAN_LEVEL_LABELS: Record<PublicTrainingPlanLevel, string> = {
    beginner: "入门",
    intermediate: "进阶",
    advanced: "专业",
};

function toNumber(value: unknown) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

function formatMetric(value: unknown, fallback = "按计划") {
    if (value === null || value === undefined || value === "") return fallback;
    return String(value);
}

function formatRest(value: unknown) {
    const seconds = toNumber(value);
    if (seconds === null || seconds <= 0) return "按计划";
    if (seconds % 60 === 0) return `${seconds / 60} 分钟`;
    if (seconds > 120) return `${(seconds / 60).toFixed(1)} 分钟`;
    return `${seconds} 秒`;
}

function getTrainingDayCount(plan: PublicTrainingPlanDetail) {
    if (typeof plan.trainingDayCount === "number") return plan.trainingDayCount;
    return (plan.trainingDays || []).filter((day) => String(day?.type || "training") !== "rest").length;
}

function getActionDetail(action: any) {
    const params = action?.params || {};
    const actionId = String(action?.actionId || action?.action_id || "").trim();
    return {
        actionId,
        actionName: String(
            action?.actionName ||
            action?.action_name ||
            action?.setName ||
            action?.set_name ||
            "",
        ).trim() || "未命名动作",
        sets: formatMetric(params["组数"] ?? params.sets ?? action?.sets ?? 1),
        reps: formatMetric(params["次数"] ?? params.reps ?? action?.reps ?? ""),
        rest: formatRest(params["休息时间"] ?? params.rest_seconds ?? action?.rest_seconds ?? null),
        intensity: formatMetric(params["强度"] ?? params.intensity ?? action?.intensity ?? "", ""),
        load: toNumber(params.load ?? action?.load ?? null),
    };
}

export default function TrainingPlanDetailPage() {
    const router = useRouter();
    const params = useParams<{ id: string }>();
    const { status } = useSession();
    const { showToast } = useToastContext();
    const planId = useMemo(() => decodeURIComponent(String(params?.id || "")), [params?.id]);
    const [plan, setPlan] = useState<PublicTrainingPlanDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadPlan() {
            if (!planId) {
                setLoading(false);
                return;
            }
            setLoading(true);
            try {
                const result = await knowledgeService.getTrainingPlan(planId);
                if (!cancelled) setPlan(result);
            } catch (error) {
                console.error("获取训练计划详情失败:", error);
                if (!cancelled) setPlan(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        loadPlan();
        return () => {
            cancelled = true;
        };
    }, [planId]);

    async function handleCopyPlan() {
        if (!plan || saving) return;
        if (status !== "authenticated") {
            showToast({ severity: "warn", summary: "请先登录", detail: "登录后可以加入我的计划库" });
            router.push("/login");
            return;
        }

        setSaving(true);
        try {
            const result = await knowledgeService.copyTrainingPlanToFavorite(plan.slug || plan.id);
            if (!result?.favorite) throw new Error("加入失败");
            showToast({
                severity: "success",
                summary: "已加入我的计划",
                detail: "缺失动作会自动补到你的动作库，可继续编辑或应用执行。",
            });
        } catch (error: any) {
            showToast({
                severity: "error",
                summary: "加入失败",
                detail: error?.message || "请稍后再试",
            });
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center text-surface-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                加载训练计划...
            </div>
        );
    }

    if (!plan) {
        return (
            <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 text-center">
                <BookMarked className="h-12 w-12 text-surface-300" />
                <h1 className="mt-4 text-2xl font-black text-surface-950">计划不存在或已下线</h1>
                <button
                    onClick={() => router.push("/dashboard/knowledge")}
                    className="mt-6 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-black text-white"
                >
                    返回知识库
                </button>
            </div>
        );
    }

    const trainingDayCount = getTrainingDayCount(plan);
    const previewDays = (plan.trainingDays || []).slice(0, 14);

    return (
        <div className="min-h-screen bg-[#f7f2ee] pb-24">
            <div className="mx-auto max-w-5xl px-4 py-6">
                <button
                    onClick={() => router.back()}
                    className="mb-4 inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-bold text-surface-600 shadow-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    返回
                </button>

                <div className="rounded-[2rem] border border-surface-100 bg-white p-5 shadow-[0_18px_60px_rgba(15,23,42,0.06)] md:p-7">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-3 py-1 text-xs font-black text-primary-700">
                                <Target className="h-3.5 w-3.5" />
                                {plan.specialtyLabel || plan.goal}
                            </div>
                            <h1 className="mt-4 text-3xl font-black tracking-tight text-surface-950 md:text-4xl">
                                {plan.name}
                            </h1>
                            <p className="mt-3 max-w-3xl text-sm leading-7 text-surface-500 md:text-base">
                                {plan.description}
                            </p>
                        </div>
                        <span className="w-fit rounded-full border border-rose-100 bg-rose-50 px-3 py-1 text-xs font-black text-rose-700">
                            {PLAN_LEVEL_LABELS[plan.level]}
                        </span>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                        <div className="rounded-3xl bg-[#fff7ed] p-4">
                            <CalendarDays className="h-5 w-5 text-primary-600" />
                            <div className="mt-2 text-2xl font-black text-surface-950">{plan.weeks} 周</div>
                            <div className="text-xs text-surface-400">计划周期</div>
                        </div>
                        <div className="rounded-3xl bg-[#fff7ed] p-4">
                            <Clock3 className="h-5 w-5 text-primary-600" />
                            <div className="mt-2 text-2xl font-black text-surface-950">{plan.daysPerWeek} 天/周</div>
                            <div className="text-xs text-surface-400">训练频率</div>
                        </div>
                        <div className="rounded-3xl bg-[#fff7ed] p-4">
                            <CheckCircle2 className="h-5 w-5 text-primary-600" />
                            <div className="mt-2 text-2xl font-black text-surface-950">{trainingDayCount} 天</div>
                            <div className="text-xs text-surface-400">训练日数</div>
                        </div>
                        <div className="rounded-3xl bg-[#fff7ed] p-4">
                            <Dumbbell className="h-5 w-5 text-primary-600" />
                            <div className="mt-2 text-lg font-black text-surface-950">{plan.sport}</div>
                            <div className="text-xs text-surface-400">方向</div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
                    <div className="space-y-4">
                        <section className="rounded-[2rem] border border-surface-100 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-surface-950">适合谁</h2>
                            <p className="mt-2 text-sm leading-7 text-surface-500">{plan.audience}</p>
                        </section>

                        <section className="rounded-[2rem] border border-surface-100 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-surface-950">训练安排</h2>
                            <div className="mt-4 space-y-3">
                                {previewDays.map((day: any) => (
                                    <div key={day.dayIndex} className={`rounded-3xl border p-4 ${day.type === "rest" ? "border-surface-100 bg-surface-50" : "border-primary-100 bg-white"}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <h3 className="font-black text-surface-950">第 {day.dayIndex} 天</h3>
                                                {day.note && <p className="mt-1 text-sm text-surface-500">{day.note}</p>}
                                            </div>
                                            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-black text-primary-700">
                                                {day.type === "rest" ? "休息" : `${day.actionSets?.length || 0} 项训练`}
                                            </span>
                                        </div>

                                        {day.type !== "rest" && Array.isArray(day.actionSets) && (
                                            <div className="mt-4 space-y-3">
                                                {day.actionSets.slice(0, 5).map((action: any, index: number) => {
                                                    const detail = getActionDetail(action);
                                                    return (
                                                        <div key={`${day.dayIndex}-${index}`} className="rounded-2xl bg-surface-50 p-4">
                                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                                <div className="font-black text-surface-900">
                                                                    {index + 1}. {detail.actionName}
                                                                </div>
                                                                <span className="w-fit rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-surface-500">
                                                                    {detail.actionId ? "已绑定动作库" : "加入后自动补齐"}
                                                                </span>
                                                            </div>
                                                            <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                                                                <div className="rounded-xl bg-white px-3 py-2">
                                                                    <div className="text-[11px] text-surface-400">组数</div>
                                                                    <div className="font-black text-surface-900">{detail.sets}</div>
                                                                </div>
                                                                <div className="rounded-xl bg-white px-3 py-2">
                                                                    <div className="text-[11px] text-surface-400">次数</div>
                                                                    <div className="font-black text-surface-900">{detail.reps || "按计划"}</div>
                                                                </div>
                                                                <div className="rounded-xl bg-white px-3 py-2">
                                                                    <div className="text-[11px] text-surface-400">休息</div>
                                                                    <div className="font-black text-surface-900">{detail.rest}</div>
                                                                </div>
                                                                <div className="rounded-xl bg-white px-3 py-2">
                                                                    <div className="text-[11px] text-surface-400">强度</div>
                                                                    <div className="font-black text-surface-900">{detail.intensity || "按计划"}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>

                    <aside className="space-y-4">
                        <section className="rounded-[2rem] border border-surface-100 bg-white p-5 shadow-sm">
                            <h2 className="text-lg font-black text-surface-950">器械与标签</h2>
                            <div className="mt-4 flex flex-wrap gap-2">
                                {[...plan.equipment, ...plan.tags].map((tag) => (
                                    <span key={tag} className="rounded-full bg-surface-50 px-3 py-1.5 text-xs font-bold text-surface-500">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </section>

                        <section className="rounded-[2rem] border border-primary-100 bg-white p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="rounded-2xl bg-primary-50 p-2 text-primary-600">
                                    <ShieldCheck className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="font-black text-surface-950">动作库说明</h2>
                                    <p className="mt-2 text-sm leading-6 text-surface-500">
                                        加入我的计划时会优先复用你已有动作；模板里缺失的动作会自动补进你的动作库，再保存到我的计划。
                                    </p>
                                </div>
                            </div>
                        </section>

                        <div className="sticky top-4 rounded-[2rem] border border-surface-100 bg-white p-4 shadow-xl">
                            <button
                                onClick={handleCopyPlan}
                                disabled={saving}
                                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-3 text-sm font-black text-white transition hover:bg-primary-700 disabled:opacity-60"
                            >
                                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookMarked className="h-4 w-4" />}
                                加入我的计划
                            </button>
                            <button
                                onClick={() => router.push("/me/plan-lib")}
                                className="mt-3 w-full rounded-2xl border border-surface-200 bg-white px-5 py-3 text-sm font-black text-surface-600 transition hover:border-primary-200 hover:text-primary-700"
                            >
                                去我的计划库查看
                            </button>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
