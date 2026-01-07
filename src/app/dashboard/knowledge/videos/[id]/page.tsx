"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";

const VideoDetailPage = () => {
    const [video, setVideo] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [hasAccess, setHasAccess] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const { id } = useParams();
    const { showToast } = useToastContext();

    useEffect(() => {
        // Simulating API call for video details
        setTimeout(() => {
            const mockVideo = {
                id: id as string,
                title: "力量训练基础",
                source: "youtube",
                source_url: "https://www.youtube.com/watch?v=example1",
                cover_image: "/placeholder-video.jpg",
                summary: "学习力量训练的基本原理和常见动作",
                duration_seconds: 1200, // 20 minutes
                transcript: "这里是视频的转录文本内容...",
                is_free: true,
            };

            setVideo(mockVideo);
            setHasAccess(mockVideo.is_free || false); // In a real app, this would come from API
            setLoading(false);
        }, 1000);
    }, [id]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const handleSubscribe = () => {
        router.push("/dashboard/knowledge/subscribe");
    };

    if (loading) {
        return (
            <div className="p-4">
                <Skeleton height="2rem" className="mb-4" />
                <Skeleton height="400px" className="mb-4" />
                <Skeleton height="1rem" width="60%" className="mb-2" />
                <Skeleton height="1rem" width="40%" className="mb-4" />
                <Skeleton height="200px" />
            </div>
        );
    }

    if (!video) {
        return (
            <div className="p-4 text-center">
                <i className="pi pi-video text-4xl text-surface-300 mb-3"></i>
                <h3 className="text-lg font-medium text-surface-600 dark:text-surface-300">
                    视频不存在
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mt-1">
                    您要查找的视频不存在或已被删除
                </p>
                <Button
                    label="返回视频列表"
                    icon="pi pi-arrow-left"
                    className="mt-4 p-button-secondary"
                    onClick={() => router.push("/dashboard/knowledge/videos")}
                />
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="mb-6">
                <Button
                    label="返回视频列表"
                    icon="pi pi-arrow-left"
                    className="p-button-text p-button-secondary mb-4"
                    onClick={() => router.push("/dashboard/knowledge/videos")}
                />

                <Card className="border-round-xl">
                    <div className="flex flex-column md:flex-row gap-4">
                        <div className="md:w-2/3">
                            {hasAccess || video.is_free ? (
                                <div className="relative pt-[56.25%] bg-surface-200 rounded-xl overflow-hidden">
                                    {/* In a real app, this would embed the actual video */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-surface-800">
                                        <div className="text-center">
                                            <i className="pi pi-play-circle text-6xl text-surface-400 mb-4"></i>
                                            <p className="text-surface-400">视频播放器</p>
                                            <p className="text-sm text-surface-500 mt-2">{video.source_url}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="relative pt-[56.25%] bg-surface-800 rounded-xl overflow-hidden flex items-center justify-center">
                                    <div className="text-center">
                                        <i className="pi pi-lock text-4xl text-orange-400 mb-3"></i>
                                        <h3 className="text-xl font-semibold text-surface-200 mb-2">
                                            需要订阅访问
                                        </h3>
                                        <p className="text-surface-400 mb-4">
                                            此视频需要知识库会员权限才能观看
                                        </p>
                                        <Button
                                            label="订阅知识库会员"
                                            icon="pi pi-shopping-cart"
                                            className="p-button-warning"
                                            onClick={handleSubscribe}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="md:w-1/3">
                            <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">
                                {video.title}
                            </h1>

                            <div className="flex flex-wrap gap-2 mb-4">
                                {video.is_free ? (
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                                        免费内容
                                    </span>
                                ) : (
                                    <span className="px-3 py-1 text-sm font-semibold rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100">
                                        付费内容
                                    </span>
                                )}

                                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-surface-100 text-surface-800 dark:bg-surface-700 dark:text-surface-200">
                                    {video.source === "youtube" ? "YouTube" : "Bilibili"}
                                </span>

                                <span className="px-3 py-1 text-sm font-semibold rounded-full bg-surface-100 text-surface-800 dark:bg-surface-700 dark:text-surface-200">
                                    {formatDuration(video.duration_seconds)}
                                </span>
                            </div>

                            <p className="text-surface-700 dark:text-surface-200 mb-4">
                                {video.summary || "暂无简介"}
                            </p>

                            <div className="mt-4">
                                <h3 className="font-semibold text-surface-800 dark:text-surface-100 mb-2">
                                    视频转录
                                </h3>
                                <p className="text-surface-700 dark:text-surface-300 text-sm line-clamp-5">
                                    {video.transcript || "暂无视频转录内容"}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            </div>

            {(hasAccess || video.is_free) && video.transcript && (
                <Card className="border-round-xl mt-4">
                    <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0 mb-4">
                        视频转录内容
                    </h2>
                    <div className="prose dark:prose-invert max-w-none">
                        <p className="text-surface-700 dark:text-surface-200 whitespace-pre-line">
                            {video.transcript}
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
};

export default VideoDetailPage;

