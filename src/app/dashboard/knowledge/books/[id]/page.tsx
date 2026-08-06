"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookRow } from "@/types";
import { KnowledgeBookCollection, getKnowledgeBookSource, groupKnowledgeBooks } from "@/lib/knowledgeBooks";
import KnowledgeMindMap from "@/components/knowledge/KnowledgeMindMap";
import BookDiscussion from "@/components/knowledge/BookDiscussion";
import type {
    KnowledgeBookCitation,
    KnowledgeBookMindMap,
    KnowledgeBookReadingGuide,
} from "@/content/knowledgeBooks/schema";

let DOMPurify: any;
let MarkdownIt: any;

try {
    DOMPurify = require("dompurify").default || require("dompurify");
    MarkdownIt = require("markdown-it");
} catch {
    DOMPurify = null;
    MarkdownIt = null;
}

const markdownRenderer = MarkdownIt
    ? new MarkdownIt({
        breaks: true,
        html: true,
        linkify: true,
    })
    : null;

type BookImagePrompt = {
    title?: string;
    intent?: string;
    prompt?: string;
};

type StructuredBookContent = {
    format?: string;
    noteStyle?: string;
    disclaimer?: string;
    markdown?: string;
    html?: string;
    imagePrompts?: BookImagePrompt[];
    mindMap?: KnowledgeBookMindMap;
    readingGuide?: KnowledgeBookReadingGuide;
    keyTakeaways?: string[];
    discussionPrompts?: string[];
    citations?: KnowledgeBookCitation[];
    source?: {
        title?: string;
        authors?: string[];
        copyrightMode?: string;
        collectionSlug?: string;
        collectionTitle?: string;
        noteType?: "overview" | "chapter";
        chapterOrder?: number;
        chapterTitle?: string;
    };
};

function normalizeStructuredExtras(structured: StructuredBookContent) {
    const mindMap = structured.mindMap?.data?.length ? structured.mindMap : null;
    return {
        mindMap,
        readingGuide: structured.readingGuide || null,
        keyTakeaways: Array.isArray(structured.keyTakeaways)
            ? structured.keyTakeaways.filter((item) => typeof item === "string" && item.trim())
            : [],
        discussionPrompts: Array.isArray(structured.discussionPrompts)
            ? structured.discussionPrompts.filter((item) => typeof item === "string" && item.trim())
            : [],
        citations: Array.isArray(structured.citations)
            ? structured.citations.filter((item) => item && item.title)
            : [],
    };
}

const EMPTY_STRUCTURED_EXTRAS = {
    mindMap: null,
    readingGuide: null,
    keyTakeaways: [] as string[],
    discussionPrompts: [] as string[],
    citations: [] as KnowledgeBookCitation[],
};

function sanitizeHtml(html: string) {
    if (!html) return "";
    return DOMPurify?.sanitize ? DOMPurify.sanitize(html) : html;
}

function escapeHtml(text: string) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeBookContent(content: KnowledgeBookRow["content"]) {
    const fallbackHtml = "<p>暂无详细内容</p>";

    if (typeof content === "string") {
        if (!content.trim()) {
            return { html: fallbackHtml, prompts: [] as BookImagePrompt[], disclaimer: "", source: null as StructuredBookContent["source"] | null, ...EMPTY_STRUCTURED_EXTRAS };
        }

        const rendered = markdownRenderer?.render(content) || `<p>${escapeHtml(content)}</p>`;
        return {
            html: sanitizeHtml(rendered),
            prompts: [] as BookImagePrompt[],
            disclaimer: "",
            source: null as StructuredBookContent["source"] | null,
            ...EMPTY_STRUCTURED_EXTRAS,
        };
    }

    if (content && typeof content === "object") {
        const structured = content as StructuredBookContent;
        const markdown = typeof structured.markdown === "string" ? structured.markdown.trim() : "";
        const html = typeof structured.html === "string" ? structured.html.trim() : "";
        const promptList = Array.isArray(structured.imagePrompts)
            ? structured.imagePrompts.filter((item) => item && (item.title || item.prompt))
            : [];
        const extras = normalizeStructuredExtras(structured);

        if (markdown) {
            return {
                html: sanitizeHtml(markdownRenderer?.render(markdown) || `<p>${escapeHtml(markdown)}</p>`),
                prompts: promptList,
                disclaimer: structured.disclaimer || "",
                source: structured.source || null,
                ...extras,
            };
        }

        if (html) {
            return {
                html: sanitizeHtml(html),
                prompts: promptList,
                disclaimer: structured.disclaimer || "",
                source: structured.source || null,
                ...extras,
            };
        }

        return {
            html: sanitizeHtml(`<pre>${escapeHtml(JSON.stringify(content, null, 2))}</pre>`),
            prompts: promptList,
            disclaimer: structured.disclaimer || "",
            source: structured.source || null,
            ...extras,
        };
    }

    return { html: fallbackHtml, prompts: [] as BookImagePrompt[], disclaimer: "", source: null as StructuredBookContent["source"] | null, ...EMPTY_STRUCTURED_EXTRAS };
}

const BookDetailPage = () => {
    const [book, setBook] = useState<KnowledgeBookRow | null>(null);
    const [bookCollection, setBookCollection] = useState<KnowledgeBookCollection | null>(null);
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
                const currentSource = getKnowledgeBookSource(result.book.content);

                if (currentSource?.collectionSlug && result.collectionBooks?.length) {
                    const collection = groupKnowledgeBooks(result.collectionBooks).find(
                        (candidate) => candidate.slug === currentSource.collectionSlug
                    ) || null;
                    setBookCollection(collection);
                } else {
                    setBookCollection(null);
                }
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

    const normalizedContent = normalizeBookContent(book.content);
    const source = getKnowledgeBookSource(book.content);
    const isOverview = source?.noteType === "overview";
    const overviewBook = bookCollection?.overviewBook || null;
    const siblingBooks = bookCollection
        ? bookCollection.books.filter((candidate) => candidate.id !== book.id)
        : [];
    const sectionBooks = isOverview
        ? bookCollection?.chapterBooks || []
        : [
            ...(overviewBook && overviewBook.id !== book.id ? [overviewBook] : []),
            ...siblingBooks.filter((candidate) => candidate.id !== overviewBook?.id),
        ];
    const sectionTitle = isOverview
        ? "本书章节"
        : `${bookCollection?.displayTitle || normalizedContent.source?.title || "本书"} · 继续阅读`;
    const sectionDescription = isOverview
        ? "现在点进来看到的是这本书的总览页，下面按顺序放书内章节与专题分篇。"
        : "你现在看到的是书内某一篇，下面可以回到总览，或者继续读同一本书的其它章节。";

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
                                {normalizedContent.source?.noteType === "overview" && (
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                        专题总览
                                    </span>
                                )}
                                {normalizedContent.source?.noteType === "chapter" && (
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                                        {normalizedContent.source.chapterTitle || "专题分篇"}
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
                <div className="space-y-4">
                    {normalizedContent.disclaimer && (
                        <Card className="border-round-xl border-1 border-orange-200 bg-orange-50">
                            <div className="flex flex-column gap-2">
                                <span className="inline-flex w-fit px-3 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                                    解读型笔记
                                </span>
                                <p className="m-0 text-sm line-height-3 text-orange-900">
                                    {normalizedContent.disclaimer}
                                </p>
                                {normalizedContent.source?.title && (
                                    <p className="m-0 text-xs text-orange-700">
                                        来源书目：{normalizedContent.source.title}
                                        {normalizedContent.source?.authors?.length
                                            ? ` · ${normalizedContent.source.authors.join("、")}`
                                            : ""}
                                    </p>
                                )}
                            </div>
                        </Card>
                    )}

                    {normalizedContent.readingGuide && (
                        <Card className="border-round-xl">
                            <div className="flex flex-column gap-3">
                                <div className="flex flex-wrap align-items-center gap-2">
                                    <h2 className="m-0 text-xl font-semibold text-surface-900 dark:text-surface-0">
                                        阅读导航
                                    </h2>
                                    {normalizedContent.readingGuide.estimatedMinutes && (
                                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-200">
                                            约 {normalizedContent.readingGuide.estimatedMinutes} 分钟
                                        </span>
                                    )}
                                </div>
                                {normalizedContent.readingGuide.suitableFor?.length ? (
                                    <div>
                                        <h3 className="m-0 mb-2 text-sm font-semibold text-surface-700 dark:text-surface-200">适合谁读</h3>
                                        <div className="flex flex-wrap gap-2">
                                            {normalizedContent.readingGuide.suitableFor.map((item) => (
                                                <span key={item} className="px-3 py-1 text-xs rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-200">
                                                    {item}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}
                                {normalizedContent.readingGuide.goals?.length ? (
                                    <div>
                                        <h3 className="m-0 mb-2 text-sm font-semibold text-surface-700 dark:text-surface-200">读完应带走什么</h3>
                                        <ul className="m-0 pl-4 text-sm line-height-3 text-surface-600 dark:text-surface-300">
                                            {normalizedContent.readingGuide.goals.map((item) => <li key={item}>{item}</li>)}
                                        </ul>
                                    </div>
                                ) : null}
                            </div>
                        </Card>
                    )}

                    {normalizedContent.keyTakeaways.length > 0 && (
                        <Card className="border-round-xl">
                            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mt-0 mb-3">
                                本页要点
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {normalizedContent.keyTakeaways.map((item, index) => (
                                    <div key={`${item}-${index}`} className="flex gap-3 p-3 border-1 border-surface-200 dark:border-surface-700 border-round-lg bg-surface-50 dark:bg-surface-800">
                                        <span className="inline-flex align-items-center justify-content-center flex-shrink-0 w-2rem h-2rem border-round bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 font-semibold">
                                            {index + 1}
                                        </span>
                                        <span className="text-sm line-height-3 text-surface-700 dark:text-surface-200">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    {normalizedContent.mindMap && (
                        <Card className="border-round-xl">
                            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mt-0 mb-2">
                                {normalizedContent.mindMap.title || "思维导图"}
                            </h2>
                            {normalizedContent.mindMap.description && (
                                <p className="mt-0 mb-4 text-sm line-height-3 text-surface-600 dark:text-surface-300">
                                    {normalizedContent.mindMap.description}
                                </p>
                            )}
                            <KnowledgeMindMap
                                data={normalizedContent.mindMap.data}
                                readOnly
                                height={520}
                            />
                        </Card>
                    )}

                    <Card className="border-round-xl">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-4">
                        内容详情
                    </h2>
                    <div className="prose dark:prose-invert max-w-none">
                        <div
                            dangerouslySetInnerHTML={{
                                __html: normalizedContent.html,
                            }}
                        />
                    </div>
                    </Card>

                    {sectionBooks.length > 0 && (
                        <Card className="border-round-xl">
                            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-2">
                                {sectionTitle}
                            </h2>
                            <p className="text-sm text-surface-600 dark:text-surface-300 mt-0 mb-4">
                                {sectionDescription}
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sectionBooks.map((relatedBook) => {
                                    const relatedSource = getKnowledgeBookSource(relatedBook.content);
                                    return (
                                        <button
                                            key={relatedBook.id}
                                            onClick={() => router.push(`/dashboard/knowledge/books/${relatedBook.id}`)}
                                            className="text-left p-3 border-1 border-surface-200 dark:border-surface-700 border-round-lg bg-surface-50 dark:bg-surface-800 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-surface-700 transition-all"
                                        >
                                            <div className="flex flex-column gap-2">
                                                <div className="flex flex-wrap gap-2">
                                                    {relatedSource?.noteType === "overview" ? (
                                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                                                            总览
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                                                            {relatedSource?.chapterTitle || "分篇"}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="m-0 text-base font-semibold text-surface-900 dark:text-surface-0">
                                                    {relatedBook.title}
                                                </h3>
                                                <p className="m-0 text-sm line-height-3 text-surface-600 dark:text-surface-300">
                                                    {relatedBook.summary || "暂无简介"}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>
                    )}

                    {normalizedContent.discussionPrompts.length > 0 && (
                        <Card className="border-round-xl">
                            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-2">
                                带着问题讨论
                            </h2>
                            <p className="text-sm text-surface-600 dark:text-surface-300 mt-0 mb-4">
                                可以先选一个问题写下自己的训练经历，再进入评论区和其他读者交流。
                            </p>
                            <ol className="m-0 pl-4 flex flex-column gap-3">
                                {normalizedContent.discussionPrompts.map((item, index) => (
                                    <li key={`${item}-${index}`} className="pl-2 text-sm line-height-3 text-surface-700 dark:text-surface-200">
                                        {item}
                                    </li>
                                ))}
                            </ol>
                        </Card>
                    )}

                    {normalizedContent.citations.length > 0 && (
                        <Card className="border-round-xl">
                            <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-3">
                                来源与版本
                            </h2>
                            <div className="flex flex-column gap-3">
                                {normalizedContent.citations.map((item, index) => (
                                    <div
                                        key={`${item.title}-${index}`}
                                        className="p-3 border-1 border-surface-200 dark:border-surface-700 border-round-lg bg-surface-50 dark:bg-surface-800"
                                    >
                                        <h3 className="m-0 text-sm font-semibold text-surface-900 dark:text-surface-0">
                                            {item.url ? (
                                                <a href={item.url} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline">
                                                    {item.title}
                                                </a>
                                            ) : item.title}
                                        </h3>
                                        {item.note && <p className="m-0 mt-2 text-sm text-surface-600 dark:text-surface-300">{item.note}</p>}
                                        {(item.license || item.accessedAt) && (
                                            <p className="m-0 mt-2 text-xs text-surface-500 dark:text-surface-400">
                                                {[item.license, item.accessedAt ? `访问于 ${item.accessedAt}` : ""].filter(Boolean).join(" · ")}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    )}

                    <BookDiscussion
                        bookId={book.id}
                        prompts={normalizedContent.discussionPrompts}
                    />
                </div>
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

