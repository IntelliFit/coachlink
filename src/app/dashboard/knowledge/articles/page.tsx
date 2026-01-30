"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Paginator, PaginatorPageChangeEvent } from "primereact/paginator";
import { Skeleton } from "primereact/skeleton";
import { ArrowRight } from "lucide-react";
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

    return (
        <div className="p-4">
            <div className="mb-6">
                <div className="text-xs font-black uppercase tracking-widest text-surface-500">知识库</div>
                <h1 className="mt-2 text-3xl font-bold text-surface-900 dark:text-surface-0">
                    技术文章
                </h1>
                <p className="mt-2 text-surface-600 dark:text-surface-300">
                    这里汇总教练在“内容管理”里发布的文章/记录。
                </p>
                <div className="mt-2 text-xs font-black text-surface-400">
                    共 {total} 篇
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {[...Array(6)].map((_, idx) => (
                        <div key={idx} className="bg-surface-0 rounded-2xl p-4 border border-surface-100 h-[240px] flex flex-col justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <Skeleton shape="circle" size="20px" />
                                    <Skeleton width="60px" height="12px" />
                                </div>
                                <Skeleton width="90%" height="1.2rem" className="mb-2" />
                                <Skeleton width="60%" height="1.2rem" className="mb-3" />
                                <Skeleton width="100%" height="0.8rem" className="mb-1" />
                                <Skeleton width="80%" height="0.8rem" />
                            </div>
                            <div className="pt-3 border-t border-surface-50 flex justify-between">
                                 <Skeleton width="60px" height="10px" />
                                 <Skeleton width="40px" height="10px" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-surface-500">暂无内容</div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {items.map((it) => {
                        const c = it.content;
                        // const requiredTier = (c.required_tier ?? 0) as number; // 不再强调 Tier，而是强调付不付费
                        const snippet = (c.content || "").replace(/<[^>]*>/g, "");
                        const priceCents = (c as any).price_cents ?? 0; // 确保取到价格

                        return (
                            <div 
                                key={c.id} 
                                className="bg-surface-0 rounded-2xl p-4 border border-surface-100 hover:border-primary-200 transition-all cursor-pointer flex flex-col justify-between h-full min-h-[180px]"
                                onClick={() => router.push(`/articles/${c.id}`)}
                            >
                                <div>
                                     <div className="flex items-center gap-2 mb-2">
                                        <div className="w-5 h-5 rounded-full bg-surface-100 overflow-hidden shrink-0">
                                            {it.coach.avatar_url ? (
                                                <img src={it.coach.avatar_url} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-surface-500">
                                                    {it.coach.name?.[0]}
                                                </div>
                                            )}
                                        </div>
                                        <span className="text-xs text-surface-500 font-medium truncate max-w-[120px]">{it.coach.name}</span>
                                        {priceCents > 0 ? (
                                            <span className="ml-auto px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded">
                                                付费
                                            </span>
                                        ) : (
                                            <span className="ml-auto px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">
                                                免费
                                            </span>
                                        )}
                                     </div>
                                     <h3 className="text-sm font-bold text-surface-900 line-clamp-2 leading-snug mb-2 min-h-[2.5em]">
                                         {c.title || "未命名文章"}
                                     </h3>
                                     <p className="text-xs text-surface-500 line-clamp-3 h-12 mb-0">
                                         {snippet || "暂无预览"}
                                     </p>
                                </div>
                                <div className="mt-3 pt-3 border-t border-surface-50 flex items-center justify-between text-[10px] text-surface-400">
                                     <span>{c.created_at ? new Date(c.created_at).toLocaleDateString('zh-CN') : ''}</span>
                                     <div className="flex items-center gap-1 text-primary-600 font-bold hover:underline">
                                        <span>阅读</span>
                                        <ArrowRight size={10} />
                                     </div>
                                </div>
                            </div>
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

