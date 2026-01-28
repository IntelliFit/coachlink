"use client";

import { useEffect, useState } from "react";
import { User, Video, RefreshCw } from "lucide-react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";
import { streetliftingIndexService } from "@/app/service/streetliftingIndexService";
import type { StreetliftingSubmission } from "@/app/api/streetlifting-index/submissions/list/entity";

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

const qualityTag = (quality: StreetliftingSubmission["form_quality"]) => {
    switch (quality) {
        case "Competition":
            return { severity: "success" as const, label: "比赛级" };
        case "Minor_Cheat":
            return { severity: "warning" as const, label: "轻微借力" };
        case "Major_Cheat":
            return { severity: "danger" as const, label: "严重借力" };
        case "Extreme_Cheat":
            return { severity: "danger" as const, label: "超严重借力" };
        default:
            return { severity: "info" as const, label: quality };
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, index) => (
                    <Card key={index} className="rounded-2xl border border-surface-100 shadow-sm">
                        <div className="p-4 space-y-3">
                            <Skeleton width="60%" height="1rem" />
                            <Skeleton width="100%" height="0.75rem" />
                            <Skeleton width="80%" height="0.75rem" />
                            <Skeleton width="100%" height="2rem" />
                        </div>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-surface-900">最新动态</div>
                <Button
                    text
                    size="small"
                    icon="pi pi-refresh"
                    label="刷新"
                    onClick={() => fetchRecent(true)}
                    loading={refreshing}
                />
            </div>
            {submissions.length === 0 ? (
                <div className="rounded-2xl border border-surface-100 bg-surface-50 p-6 text-center text-surface-500">
                    暂无最新数据，欢迎成为第一位贡献者！
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    {submissions.map((item) => {
                        const rm = calculate1RM(
                            item.bodyweight,
                            item.added_weight,
                            item.reps,
                            item.penalty_weight,
                        );
                        const tagInfo = qualityTag(item.form_quality);

                        return (
                            <Card key={item.id} className="rounded-2xl border border-surface-100 shadow-sm">
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-xs text-surface-500">
                                            <User className="h-4 w-4" />
                                            <span className="max-w-[80px] truncate">{item.user_name || "匿名"}</span>
                                        </div>
                                        <Tag
                                            severity={item.gender === "Male" ? "info" : "success"}
                                            value={item.gender === "Male" ? "男" : "女"}
                                        />
                                    </div>
                                    <div className="text-xs text-surface-600 space-y-1">
                                        <div className="flex justify-between">
                                            <span>体重</span>
                                            <span className="font-medium text-surface-900">{item.bodyweight} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>负重</span>
                                            <span className="font-medium text-surface-900">{item.added_weight} kg</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>次数</span>
                                            <span className="font-medium text-surface-900">{item.reps}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-surface-100 pt-2">
                                            <span>估算1RM</span>
                                            <span className="font-semibold text-primary-600">{rm.toFixed(1)} kg</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <Tag severity={tagInfo.severity} value={tagInfo.label} />
                                        {item.pullup_type && (
                                            <Tag value={item.pullup_type === "Overhand" ? "正手" : "反手"} />
                                        )}
                                    </div>
                                    {item.video_url && (
                                        <Button
                                            outlined
                                            size="small"
                                            className="w-full"
                                            onClick={() => window.open(item.video_url || "", "_blank")}
                                        >
                                            <Video className="h-4 w-4 mr-2" />
                                            查看视频
                                        </Button>
                                    )}
                                    <div className="text-[11px] text-surface-400 text-center">
                                        {new Date(item.created_at).toLocaleDateString("zh-CN", {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
