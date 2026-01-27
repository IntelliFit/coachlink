"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Paginator, PaginatorPageChangeEvent } from "primereact/paginator";
import { Skeleton } from "primereact/skeleton";
import { Lock, ArrowRight } from "lucide-react";
import { useToastContext } from "@/context/ToastContext";
import type { CoachContentRow } from "@/types";

type CoachContentListItem = {
    content: CoachContentRow;
    coach: {
        id: string;
        name: string;
        avatar_url: string | null;
        status: string | null;
    };
    accessTier: number;
    canView: boolean;
};

export default function KnowledgeArticlesPage() {
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [items, setItems] = useState<CoachContentListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [first, setFirst] = useState(0);
    const [rows, setRows] = useState(10);

    const load = async (page: number, limit: number) => {
        setLoading(true);
        try {
            const res = await fetch("/api/knowledge/list-coach-contents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit, offset: page * limit }),
            });
            const json = await res.json();
            if (!json?.success) {
                setItems([]);
                setTotal(0);
                showToast({
                    severity: "error",
                    summary: "加载失败",
                    detail: json?.message || "无法获取文章列表",
                });
                return;
            }
            setItems(json.data?.items || []);
            setTotal(json.data?.total || 0);
        } catch (e: any) {
            setItems([]);
            setTotal(0);
            showToast({
                severity: "error",
                summary: "加载失败",
                detail: e?.message || "无法获取文章列表",
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load(0, rows);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows]);

    const onPageChange = (event: PaginatorPageChangeEvent) => {
        setFirst(event.first);
        setRows(event.rows);
        load(event.page, event.rows);
    };

    const getTierLabel = (tier: number) => {
        switch (tier) {
            case 1:
                return "基础订阅";
            case 2:
                return "进阶订阅";
            case 3:
                return "高级特权";
            default:
                return "公开内容";
        }
    };

    return (
        <div className="p-4">
            <div className="mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-surface-500">知识库</div>
                <h1 className="mt-2 text-3xl font-bold text-surface-900 dark:text-surface-0">
                    技术文章
                </h1>
                <p className="mt-2 text-surface-600 dark:text-surface-300">
                    这里汇总教练在“内容管理”里发布的文章/记录（按权限解锁）。
                </p>
                <div className="mt-2 text-xs font-black text-surface-400">
                    共 {total} 篇
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[...Array(6)].map((_, idx) => (
                        <Card key={idx} className="border-round-xl">
                            <div className="p-4">
                                <Skeleton width="40%" height="1.2rem" className="mb-3" />
                                <Skeleton width="80%" height="1rem" className="mb-2" />
                                <Skeleton width="60%" height="1rem" />
                            </div>
                        </Card>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-surface-500">暂无内容</div>
            ) : (
                <div className="space-y-4">
                    {items.map((it) => {
                        const c = it.content;
                        const requiredTier = (c.required_tier ?? 0) as number;
                        const snippet = (c.content || "").replace(/<[^>]*>/g, "");
                        return (
                            <Card key={c.id} className="border-round-xl">
                                <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[11px] font-black text-surface-500 bg-surface-100 px-2 py-0.5 rounded-lg">
                                                {getTierLabel(requiredTier)}
                                            </span>
                                            <span className="text-xs text-surface-400">
                                                {it.coach?.name || "教练"}
                                            </span>
                                            <span className="ml-auto text-xs text-surface-400">
                                                {c.created_at
                                                    ? new Date(c.created_at).toLocaleDateString("zh-CN")
                                                    : ""}
                                            </span>
                                        </div>
                                        <div className="text-lg font-bold text-surface-900 dark:text-surface-0 line-clamp-1">
                                            {c.title}
                                        </div>
                                        <div className="mt-2 text-sm text-surface-600 dark:text-surface-300 line-clamp-2">
                                            {snippet}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 shrink-0">
                                        {it.canView ? (
                                            <Button
                                                label="阅读"
                                                className="rounded-2xl"
                                                onClick={() => router.push(`/coach/content/${c.id}`)}
                                            />
                                        ) : (
                                            <Button
                                                label="去订阅解锁"
                                                icon={<Lock className="w-4 h-4" />}
                                                className="rounded-2xl p-button-outlined"
                                                onClick={() =>
                                                    router.push(
                                                        `/coach/profile/${c.coach_id}?tab=1#choose-pricing`,
                                                    )
                                                }
                                            />
                                        )}
                                        <Button
                                            label="查看教练"
                                            icon={<ArrowRight className="w-4 h-4" />}
                                            className="rounded-2xl p-button-text"
                                            onClick={() =>
                                                router.push(`/coach/profile/${c.coach_id}?tab=1#choose-pricing`)
                                            }
                                        />
                                    </div>
                                </div>
                            </Card>
                        );
                    })}

                    <Paginator
                        first={first}
                        rows={rows}
                        totalRecords={total}
                        onPageChange={onPageChange}
                        className="mt-6"
                    />
                </div>
            )}

            <div className="mt-6">
                <Button
                    label="返回知识库首页"
                    icon="pi pi-arrow-left"
                    className="p-button-text p-button-secondary"
                    onClick={() => router.push("/dashboard/knowledge")}
                />
            </div>
        </div>
    );
}

