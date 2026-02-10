"use client";

import { useEffect, useState } from "react";
import { User, Video } from "lucide-react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";
import type { StreetliftingSubmission } from "@/app/api/streetlifting-index/submissions/list/entity";
import { AERO_CARD, AERO_CARD_MUTED } from "@/components/streetlifting-index/aero";

const calculate1RM = (bodyweight: number, addedWeight: number, reps: number, penaltyWeight: number) => {
    const adjustedWeight = addedWeight - penaltyWeight;
    const totalWeight = bodyweight + adjustedWeight;
    if (reps === 1) return adjustedWeight;
    if (reps >= 37) return 0;
    const epley1RM = totalWeight * (1 + 0.0333 * reps);
    const brzycki1RM = totalWeight * (36 / (37 - reps));
    const lombardi1RM = totalWeight * Math.pow(reps, 0.1);
    const totalEstimated1RM = (epley1RM + brzycki1RM + lombardi1RM) / 3;
    return totalEstimated1RM - bodyweight;
};

const qualityLabel = (quality: StreetliftingSubmission["form_quality"]) => {
    switch (quality) {
        case "Competition":
            return "比赛级";
        case "Minor_Cheat":
            return "轻微借力";
        case "Major_Cheat":
            return "严重借力";
        case "Extreme_Cheat":
            return "超严重借力";
        default:
            return quality;
    }
};

export function StreetliftingRecentSubmissions() {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [submissions, setSubmissions] = useState<StreetliftingSubmission[]>([]);

    const fetchRecent = async (showRefresh?: boolean) => {
        if (showRefresh) setRefreshing(true);
        try {
            const data = await streetliftingIndexService.listSubmissions({ limit: 5 });
            setSubmissions(data?.submissions || []);
        } catch (error: any) {
            console.error("[streetlifting-index] recent submissions error:", error);
            showToast({ severity: "error", summary: "获取失败", detail: error.message || "加载失败" });
        } finally {
            setLoading(false);
            if (showRefresh) setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchRecent();
    }, []);

    if (loading) {
        return (
            <Card className={AERO_CARD}>
                <div className="p-4 md:p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <Skeleton width="6rem" height="1rem" />
                        <Skeleton width="3.5rem" height="1.25rem" />
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center justify-between gap-3 py-2 border-t border-surface-100">
                                <Skeleton width="30%" height="0.85rem" />
                                <Skeleton width="40%" height="0.85rem" />
                            </div>
                        ))}
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className={AERO_CARD}>
            <div className="p-4 md:p-5">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-base font-black text-surface-900">最新动态</div>
                        <div className="text-xs text-surface-500 mt-1">来自社区的最近 5 条数据提交</div>
                    </div>
                    <Button
                        text
                        severity="secondary"
                        size="small"
                        icon="pi pi-refresh"
                        label={refreshing ? "刷新中" : "刷新"}
                        className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                        onClick={() => fetchRecent(true)}
                        loading={refreshing}
                    />
                </div>

                {submissions.length === 0 ? (
                    <div className={`${AERO_CARD_MUTED} mt-4 p-6 text-center text-surface-500`}>
                        暂无最新数据，欢迎成为第一位贡献者！
                    </div>
                ) : (
                    <div className="mt-4 divide-y divide-surface-100">
                        {submissions.map((item) => {
                            const rm = calculate1RM(
                                item.bodyweight,
                                item.added_weight,
                                item.reps,
                                item.penalty_weight,
                            );

                            const badges: string[] = [];
                            badges.push(item.gender === "Male" ? "男" : "女");
                            badges.push(qualityLabel(item.form_quality));
                            if (item.pullup_type) badges.push(item.pullup_type === "Overhand" ? "正手" : "反手");

                            return (
                                <div key={item.id} className="py-3 mt-6">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 text-sm font-bold text-surface-900">
                                                <User className="h-4 w-4 text-surface-400" />
                                                <span className="truncate">{item.user_name || "匿名"}</span>
                                                <span className="text-xs font-medium text-surface-400">
                                                    {new Date(item.created_at).toLocaleDateString("zh-CN", {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>
                                            </div>

                                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                                                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 border border-surface-100 px-3 py-2">
                                                    <span className="text-surface-500">体重</span>
                                                    <span className="font-bold text-surface-900">{item.bodyweight} kg</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 border border-surface-100 px-3 py-2">
                                                    <span className="text-surface-500">负重</span>
                                                    <span className="font-bold text-surface-900">{item.added_weight} kg</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 border border-surface-100 px-3 py-2">
                                                    <span className="text-surface-500">次数</span>
                                                    <span className="font-bold text-surface-900">{item.reps}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-0 border border-primary-200/60 px-3 py-2">
                                                    <span className="text-surface-500 flex items-center gap-1.5">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                                        估算1RM
                                                    </span>
                                                    <span className="font-black text-primary-700">{rm.toFixed(1)} kg</span>
                                                </div>
                                            </div>

                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {badges.map((b, idx) => (
                                                    <span
                                                        key={`${b}-${idx}`}
                                                        className="inline-flex items-center rounded-full bg-surface-50 border border-surface-100 px-2.5 py-1 text-[11px] font-bold text-surface-600"
                                                    >
                                                        {b}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="shrink-0">
                                            {item.video_url ? (
                                                <Button
                                                    text
                                                    severity="secondary"
                                                    size="small"
                                                    className="rounded-2xl text-surface-600 hover:text-surface-900 active:scale-[0.98] transition-all"
                                                    onClick={() => window.open(item.video_url || "", "_blank")}
                                                >
                                                    <Video className="h-4 w-4 mr-2" />
                                                    查看视频
                                                </Button>
                                            ) : (
                                                <div className="text-xs text-surface-400 pt-2">无视频</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Card>
    );
}
