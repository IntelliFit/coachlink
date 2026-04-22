"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ArrowLeft, ArrowRight, Lock, LockOpen } from "lucide-react";
import { useToastContext } from "@/context/ToastContext";
import KnowledgeHeader from "@/components/knowledge/KnowledgeHeader";
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
    const [page, setPage] = useState(0);
    const [rows] = useState(10);

    const load = async (currentPage: number, limit: number) => {
        setLoading(true);
        try {
            const res = await fetch("/api/knowledge/list-coach-contents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit, offset: currentPage * limit }),
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
    }, [rows]);

    const onPageChange = (newPage: number) => {
        setPage(newPage);
        load(newPage, rows);
    };

    const totalPages = Math.ceil(total / rows);

    return (
        <div className="min-h-screen pb-32">
            <KnowledgeHeader
                title="技术文章"
                subtitle={`共 ${total} 篇教练精选文章`}
                icon={FileText}
                showBackButton={true}
            />

            <div className="px-4 py-6 max-w-3xl mx-auto">
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[...Array(4)].map((_, idx) => (
                            <div key={idx} className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-5 h-5 rounded-full bg-surface-200 dark:bg-surface-700 animate-pulse" />
                                    <div className="h-3 w-16 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                                </div>
                                <div className="h-5 w-3/4 bg-surface-200 dark:bg-surface-700 rounded mb-2 animate-pulse" />
                                <div className="h-4 w-full bg-surface-200 dark:bg-surface-700 rounded mb-1 animate-pulse" />
                                <div className="h-4 w-2/3 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl">
                        <FileText size={48} className="mx-auto text-surface-300 mb-4" />
                        <p className="text-surface-500">暂无内容</p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {items.map((it) => {
                                const c = it.content;
                                const snippet = (c.content || "").replace(/<[^>]*>/g, "");
                                const priceCents = (c as any).price_cents ?? 0;

                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => router.push(`/articles/${c.id}`)}
                                        className="text-left bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all"
                                    >
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className="w-6 h-6 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden shrink-0">
                                                {it.coach.avatar_url ? (
                                                    <img src={it.coach.avatar_url} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-surface-500">
                                                        {it.coach.name?.[0]}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-xs text-surface-500 font-medium truncate">{it.coach.name}</span>
                                            {priceCents > 0 ? (
                                                <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded">
                                                    <Lock size={10} />
                                                    付费
                                                </span>
                                            ) : (
                                                <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-[10px] font-bold rounded">
                                                    <LockOpen size={10} />
                                                    免费
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-sm font-bold text-surface-900 dark:text-surface-100 line-clamp-2 mb-2">
                                            {c.title || "未命名文章"}
                                        </h3>
                                        <p className="text-xs text-surface-500 line-clamp-3 mb-3">
                                            {snippet || "暂无预览"}
                                        </p>
                                        <div className="flex items-center justify-between text-[10px] text-surface-400">
                                            <span>{c.created_at ? new Date(c.created_at).toLocaleDateString('zh-CN') : ''}</span>
                                            <span className="flex items-center gap-1 text-primary-600 font-bold">
                                                阅读 <ArrowRight size={10} />
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-6">
                                <button
                                    onClick={() => onPageChange(page - 1)}
                                    disabled={page === 0}
                                    className="p-2 rounded-lg bg-white dark:bg-surface-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-50"
                                >
                                    <ArrowLeft size={16} />
                                </button>
                                <span className="text-sm text-surface-600 dark:text-surface-400">
                                    第 {page + 1} / {totalPages} 页
                                </span>
                                <button
                                    onClick={() => onPageChange(page + 1)}
                                    disabled={page >= totalPages - 1}
                                    className="p-2 rounded-lg bg-white dark:bg-surface-800 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-surface-50"
                                >
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
