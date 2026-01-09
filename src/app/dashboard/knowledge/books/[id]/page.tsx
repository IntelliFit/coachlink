"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookRow } from "@/types";

const BookDetailPage = () => {
    const [book, setBook] = useState<KnowledgeBookRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { id } = useParams();
    const { showToast } = useToastContext();

    useEffect(() => {
        if (id) {
            fetchBookDetail(id as string);
        }
    }, [id]);

    const fetchBookDetail = async (bookId: string) => {
        try {
            setLoading(true);
            const result = await knowledgeService.getKnowledgeBook({ id: bookId });

            if (result) {
                setBook(result.book);
                setHasAccess(result.hasAccess);
            }
        } catch (err) {
            setError("获取书籍详情失败");
            showToast({
                severity: "error",
                summary: "错误",
                detail: "获取书籍详情失败，请稍后重试",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = () => {
        router.push("/dashboard/knowledge/subscribe");
    };

    if (loading) {
        return (
            <div className="p-4">
                <Skeleton height="2rem" className="mb-4" />
                <Skeleton height="150px" className="mb-4" />
                <Skeleton height="1rem" width="60%" className="mb-2" />
                <Skeleton height="1rem" width="40%" className="mb-4" />
                <Skeleton height="200px" />
                <Skeleton height="40px" className="mt-4" />
            </div>
        );
    }

    if (!book) {
        return (
            <div className="p-4 text-center">
                <i className="pi pi-book text-4xl text-surface-300 mb-3"></i>
                <h3 className="text-lg font-medium text-surface-600 dark:text-surface-300">
                    书籍不存在
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mt-1">
                    您要查找的书籍不存在或已被删除
                </p>
                <Button
                    label="返回书籍列表"
                    icon="pi pi-arrow-left"
                    className="mt-4 p-button-secondary"
                    onClick={() => router.push("/dashboard/knowledge/books")}
                />
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-6">
                <Button
                    label="返回书籍列表"
                    icon="pi pi-arrow-left"
                    className="p-button-text p-button-secondary mb-4"
                    onClick={() => router.push("/dashboard/knowledge/books")}
                />

                <Card className="border-round-xl">
                    <div className="flex flex-column md:flex-row gap-4">
                        <div className="md:w-1/4">
                            {book.cover_image ? (
                                <img
                                    src={book.cover_image}
                                    alt={book.title}
                                    className="w-full border-round-md"
                                />
                            ) : (
                                <div className="w-full bg-surface-200 border-round-md flex align-items-center justify-content-center"
                                    style={{ height: "200px" }}>
                                    <i className="pi pi-book text-4xl text-surface-400"></i>
                                </div>
                            )}
                        </div>

                        <div className="md:w-3/4">
                            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">
                                {book.title}
                            </h1>

                            {book.author && (
                                <p className="text-lg text-surface-600 dark:text-surface-300 mb-2">
                                    作者: {book.author}
                                </p>
                            )}

                            <p className="text-surface-700 dark:text-surface-200 mb-4">
                                {book.summary || "暂无简介"}
                            </p>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {book.is_free ? (
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                        免费内容
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                                        付费内容
                                    </span>
                                )}
                            </div>

                            {book.audio_url && (
                                <div className="mb-4">
                                    <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                                        AI 讲解音频
                                    </h3>
                                    <audio
                                        src={book.audio_url}
                                        controls
                                        className="w-full"
                                    >
                                        您的浏览器不支持音频播放
                                    </audio>
                                </div>
                            )}

                            {!hasAccess && !book.is_free && (
                                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 text-orange-800 rounded">
                                    <p className="mb-2">
                                        <i className="pi pi-lock mr-2"></i>
                                        此内容需要订阅知识库会员才能访问
                                    </p>
                                    <Button
                                        label="立即订阅"
                                        icon="pi pi-shopping-cart"
                                        className="p-button-warning"
                                        onClick={handleSubscribe}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </Card>
            </div>

            {hasAccess || book.is_free ? (
                <Card className="border-round-xl">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-4">
                        内容详情
                    </h2>
                    <div className="prose dark:prose-invert max-w-none">
                        {book.content && typeof book.content === "object" ? (
                            // 如果内容是结构化的，渲染为 Markdown 或其他格式
                            <div dangerouslySetInnerHTML={{
                                __html: typeof book.content === "string" ? book.content : JSON.stringify(book.content)
                            }} />
                        ) : (
                            <p className="text-surface-700 dark:text-surface-200">
                                {book.content || "暂无详细内容"}
                            </p>
                        )}
                    </div>
                </Card>
            ) : (
                <Card className="border-round-xl text-center p-6">
                    <i className="pi pi-lock text-4xl text-orange-400 mb-3"></i>
                    <h3 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-2">
                        需要订阅访问
                    </h3>
                    <p className="text-surface-600 dark:text-surface-300 mb-4">
                        此内容需要知识库会员权限才能查看完整内容
                    </p>
                    <Button
                        label="订阅知识库会员"
                        icon="pi pi-shopping-cart"
                        className="p-button-warning"
                        onClick={handleSubscribe}
                    />
                </Card>
            )}
        </div>
    );
};

export default BookDetailPage;

