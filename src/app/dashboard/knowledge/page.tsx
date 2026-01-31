"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookRow } from "@/types";
import type { CoachContentRow } from "@/types";
import { useToastContext } from "@/context/ToastContext";

const KnowledgeBaseHomePage = () => {
    const router = useRouter();
    const { showToast } = useToastContext();
    const [books, setBooks] = useState<KnowledgeBookRow[]>([]);
    const [loadingBooks, setLoadingBooks] = useState(true);
    const [loadingContents, setLoadingContents] = useState(true);
    const [contents, setContents] = useState<Array<{
        content: CoachContentRow;
        coach: { id: string; name: string; avatar_url: string | null; status: string | null };
        accessTier: number;
        canView: boolean;
    }>>([]);

    useEffect(() => {
        // Fetch latest books
        const fetchBooks = async () => {
            try {
                const result = await knowledgeService.listKnowledgeBooks({
                    is_published: true,
                    is_free: true, // Show free books first
                });
                if (result) {
                    // Sort by creation date and take the latest 3
                    const sortedBooks = result.books
                        .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                        .slice(0, 3);
                    setBooks(sortedBooks);
                }
            } catch (error) {
                console.error("获取书籍失败:", error);
            } finally {
                setLoadingBooks(false);
            }
        };

        fetchBooks();
    }, []);

    useEffect(() => {
        const fetchContents = async () => {
            setLoadingContents(true);
            try {
                const res = await fetch("/api/knowledge/list-coach-contents", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ limit: 3, offset: 0 }),
                });
                const json = await res.json();
                if (!json?.success) {
                    setContents([]);
                    showToast({
                        severity: "warn",
                        summary: "文章加载失败",
                        detail: json?.message || "请稍后重试",
                    });
                    return;
                }
                setContents(json.data?.items || []);
            } catch (e: any) {
                setContents([]);
                showToast({
                    severity: "warn",
                    summary: "文章加载失败",
                    detail: e?.message || "请稍后重试",
                });
            } finally {
                setLoadingContents(false);
            }
        };
        fetchContents();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleViewBooks = () => {
        router.push("/dashboard/knowledge/books");
    };

    const handleViewArticles = () => {
        router.push("/dashboard/knowledge/articles");
    };

    return (
        <div className="p-4">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-0 mb-2">
                    知识库
                </h1>
                <p className="text-lg text-surface-600 dark:text-surface-300">
                    以最通俗易懂的方式传授运动训练知识
                </p>
            </div>

            {/* Books Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0">
                        <i className="pi pi-book mr-2 text-blue-500"></i>
                        最新书籍笔记
                    </h2>
                    <Button
                        label="更多书籍"
                        icon="pi pi-arrow-right"
                        className="p-button-text p-button-sm"
                        onClick={handleViewBooks}
                    />
                </div>

                {loadingBooks ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, index) => (
                            <Card key={index} className="border-round-xl">
                                <Skeleton height="120px" borderRadius="16px" className="mb-3" />
                                <Skeleton width="80%" height="1.5rem" className="mb-2" />
                                <Skeleton width="60%" height="1rem" className="mb-2" />
                            </Card>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {books.length > 0 ? (
                            books.map((book) => (
                                <Card
                                    key={book.id}
                                    className="border-round-xl cursor-pointer hover:shadow-md transition-shadow duration-200"
                                    onClick={() => router.push(`/dashboard/knowledge/books/${book.id}`)}
                                >
                                    <div className="flex flex-column align-items-center text-center">
                                        {book.cover_image ? (
                                            <img
                                                src={book.cover_image}
                                                alt={book.title}
                                                className="w-full h-30rem object-cover border-round-md mb-3"
                                                style={{ height: "120px", objectFit: "cover" }}
                                            />
                                        ) : (
                                            <div className="w-full h-30rem bg-surface-200 border-round-md mb-3 flex align-items-center justify-content-center"
                                                style={{ height: "120px" }}>
                                                <i className="pi pi-book text-4xl text-surface-400"></i>
                                            </div>
                                        )}
                                        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-0 line-clamp-1">
                                            {book.title}
                                        </h3>
                                        <p className="text-sm text-surface-600 dark:text-surface-300 line-clamp-2 mb-2">
                                            {book.summary || "暂无简介"}
                                        </p>
                                        <div className="mt-2 w-full">
                                            {book.is_free ? (
                                                <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                                    免费
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                                                    付费
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="col-span-3 text-center py-8">
                                <i className="pi pi-book text-4xl text-surface-300 mb-3"></i>
                                <p className="text-surface-500 dark:text-surface-400">暂无书籍</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Articles Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0">
                        <i className="pi pi-file mr-2 text-purple-500"></i>
                        技术文章
                    </h2>
                    <Button
                        label="更多文章"
                        icon="pi pi-arrow-right"
                        className="p-button-text p-button-sm"
                        onClick={handleViewArticles}
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {loadingContents ? (
                        [...Array(3)].map((_, index) => (
                            <Card key={index} className="border-round-xl">
                                <Skeleton height="120px" borderRadius="16px" className="mb-3" />
                                <Skeleton width="80%" height="1.5rem" className="mb-2" />
                                <Skeleton width="60%" height="1rem" className="mb-2" />
                            </Card>
                        ))
                    ) : contents.length > 0 ? (
                        contents.map((it) => (
                            <Card
                                key={it.content.id}
                                className="border-round-xl cursor-pointer hover:shadow-md transition-shadow duration-200"
                                onClick={() =>
                                    it.canView
                                        ? router.push(`/coach/content/${it.content.id}`)
                                        : router.push(`/coach/profile/${it.content.coach_id}?tab=1#choose-pricing`)
                                }
                            >
                                <div className="flex flex-column">
                                    <div className="text-xs font-black text-surface-400">
                                        {it.coach?.name || "教练"}
                                    </div>
                                    <h3 className="mt-2 text-lg font-semibold text-surface-900 dark:text-surface-0 line-clamp-2">
                                        {it.content.title}
                                    </h3>
                                    <p className="mt-2 text-sm text-surface-600 dark:text-surface-300 line-clamp-3">
                                        {(it.content.content || "").replace(/<[^>]*>/g, "")}
                                    </p>
                                </div>
                            </Card>
                        ))
                    ) : (
                        <div className="col-span-3 text-center py-8">
                            <i className="pi pi-file text-4xl text-surface-300 mb-3"></i>
                            <p className="text-surface-500 dark:text-surface-400">暂无文章</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Videos Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0">
                        <i className="pi pi-video mr-2 text-green-500"></i>
                        最新视频课程
                    </h2>
                </div>

                <Card className="border-round-xl">
                    <div className="text-center py-10">
                        <i className="pi pi-clock text-4xl text-surface-300 mb-3"></i>
                        <h3 className="text-lg font-medium text-surface-700 dark:text-surface-200">
                            敬请期待
                        </h3>
                        <p className="text-surface-500 dark:text-surface-400 mt-2">
                            视频课程正在制作中，完成后将第一时间上线
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default KnowledgeBaseHomePage;

