"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Divider } from "primereact/divider";
import { Skeleton } from "primereact/skeleton";
import knowledgeService from "@/app/service/knowledgeService";
import { KnowledgeBookRow } from "@/types";

const KnowledgeBaseHomePage = () => {
    const router = useRouter();
    const [books, setBooks] = useState<KnowledgeBookRow[]>([]);
    const [videos, setVideos] = useState<any[]>([]);
    const [loadingBooks, setLoadingBooks] = useState(true);
    const [loadingVideos, setLoadingVideos] = useState(true);

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

        // Fetch latest videos (mock data for now)
        const fetchVideos = async () => {
            try {
                // In a real app, this would call an API to get videos
                setVideos([
                    { id: "1", title: "力量训练基础", duration: "15:30", is_free: true },
                    { id: "2", title: "营养学入门", duration: "20:45", is_free: false },
                    { id: "3", title: "核心训练技巧", duration: "12:15", is_free: true },
                ]);
            } catch (error) {
                console.error("获取视频失败:", error);
            } finally {
                setLoadingVideos(false);
            }
        };

        fetchBooks();
        fetchVideos();
    }, []);

    const handleViewBooks = () => {
        router.push("/dashboard/knowledge/books");
    };

    const handleViewVideos = () => {
        router.push("/dashboard/knowledge/videos");
    };

    const handleViewAI = () => {
        router.push("/dashboard/knowledge/ai");
    };

    const handleViewMyLearning = () => {
        router.push("/dashboard/knowledge/my");
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

            {/* Videos Section */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0">
                        <i className="pi pi-video mr-2 text-green-500"></i>
                        最新视频课程
                    </h2>
                    <Button
                        label="更多视频"
                        icon="pi pi-arrow-right"
                        className="p-button-text p-button-sm"
                        onClick={handleViewVideos}
                    />
                </div>

                {loadingVideos ? (
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
                        {videos.length > 0 ? (
                            videos.map((video) => (
                                <Card
                                    key={video.id}
                                    className="border-round-xl cursor-pointer hover:shadow-md transition-shadow duration-200"
                                    onClick={() => router.push(`/dashboard/knowledge/videos/${video.id}`)}
                                >
                                    <div className="flex flex-column align-items-center text-center">
                                        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                                            <div
                                                className="absolute top-0 left-0 w-full h-full bg-cover bg-center border-round-md mb-3 bg-surface-200 flex align-items-center justify-content-center"
                                            >
                                                <i className="pi pi-video text-4xl text-surface-400"></i>
                                                <div className="absolute bottom-2 right-2 bg-surface-900 bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                                                    {video.duration}
                                                </div>
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-0 line-clamp-1">
                                            {video.title}
                                        </h3>
                                        <div className="mt-2 w-full">
                                            {video.is_free ? (
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
                                <i className="pi pi-video text-4xl text-surface-300 mb-3"></i>
                                <p className="text-surface-500 dark:text-surface-400">暂无视频课程</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Divider />

            {/* Quick Access Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card className="border-round-xl">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-3">
                        <i className="pi pi-comments mr-2 text-purple-500"></i>
                        AI 智能问答
                    </h2>
                    <p className="text-surface-700 dark:text-surface-200 mb-4">
                        基于知识库的智能问答系统，为您解答运动训练相关问题
                    </p>
                    <Button
                        label="开始问答"
                        icon="pi pi-arrow-right"
                        className="p-button-primary"
                        onClick={handleViewAI}
                    />
                </Card>

                <Card className="border-round-xl">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-3">
                        <i className="pi pi-chart-line mr-2 text-teal-500"></i>
                        我的学习进度
                    </h2>
                    <p className="text-surface-700 dark:text-surface-200 mb-4">
                        跟踪您的知识库学习进度和历史记录
                    </p>
                    <Button
                        label="查看进度"
                        icon="pi pi-arrow-right"
                        className="p-button-primary"
                        onClick={handleViewMyLearning}
                    />
                </Card>
            </div>

            {/* Membership Section */}
            <div className="mt-6">
                <Card className="border-round-xl">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-3">
                        <i className="pi pi-star mr-2 text-yellow-500"></i>
                        知识库会员
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="p-4 border-round bg-surface-50 dark:bg-surface-800 text-center">
                            <h3 className="font-bold text-lg mb-2">基础会员</h3>
                            <p className="text-2xl font-bold text-surface-900 dark:text-surface-0">¥19<span className="text-sm">/月</span></p>
                            <ul className="mt-3 text-left">
                                <li className="flex align-items-center mb-1"><i className="pi pi-check-circle text-green-500 mr-2"></i> 全部书籍内容</li>
                                <li className="flex align-items-center mb-1"><i className="pi pi-check-circle text-green-500 mr-2"></i> AI 讲解音频</li>
                                <li className="flex align-items-center mb-1"><i className="pi pi-times-circle text-red-500 mr-2"></i> AI 问答服务</li>
                            </ul>
                        </div>
                        <div className="p-4 border-round bg-surface-50 dark:bg-surface-800 text-center">
                            <h3 className="font-bold text-lg mb-2">高级会员</h3>
                            <p className="text-2xl font-bold text-surface-900 dark:text-surface-0">¥49<span className="text-sm">/月</span></p>
                            <ul className="mt-3 text-left">
                                <li className="flex align-items-center mb-1"><i className="pi pi-check-circle text-green-500 mr-2"></i> 全部内容</li>
                                <li className="flex align-items-center mb-1"><i className="pi pi-check-circle text-green-500 mr-2"></i> AI 讲解音频</li>
                                <li className="flex align-items-center mb-1"><i className="pi pi-check-circle text-green-500 mr-2"></i> AI 问答服务</li>
                            </ul>
                        </div>
                        <div className="p-4 border-round bg-surface-50 dark:bg-surface-800 text-center">
                            <h3 className="font-bold text-lg mb-2">免费体验</h3>
                            <p className="text-2xl font-bold text-surface-900 dark:text-surface-0">¥0</p>
                            <ul className="mt-3 text-left">
                                <li className="flex align-items-center mb-1"><i className="pi pi-check-circle text-green-500 mr-2"></i> 部分免费书籍</li>
                                <li className="flex align-items-center mb-1"><i className="pi pi-times-circle text-red-500 mr-2"></i> AI 讲解音频</li>
                                <li className="flex align-items-center mb-1"><i className="pi pi-times-circle text-red-500 mr-2"></i> AI 问答服务</li>
                            </ul>
                        </div>
                    </div>
                    <div className="text-center">
                        <Button
                            label="订阅知识库会员"
                            icon="pi pi-shopping-cart"
                            className="p-button-warning"
                            onClick={() => router.push("/dashboard/knowledge/subscribe")}
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default KnowledgeBaseHomePage;

