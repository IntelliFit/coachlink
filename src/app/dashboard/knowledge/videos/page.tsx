"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Skeleton } from "primereact/skeleton";
import { useToastContext } from "@/context/ToastContext";

const VideosPage = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToastContext();

  useEffect(() => {
    // Simulating API call for videos
    setTimeout(() => {
      setVideos([
        {
          id: "1",
          title: "力量训练基础",
          source: "youtube",
          source_url: "https://www.youtube.com/watch?v=example1",
          cover_image: "/placeholder-video.jpg",
          summary: "学习力量训练的基本原理和常见动作",
          duration_seconds: 1200, // 20 minutes
          is_free: true,
        },
        {
          id: "2",
          title: "营养学入门",
          source: "bilibili",
          source_url: "https://www.bilibili.com/video/example2",
          cover_image: "/placeholder-video.jpg",
          summary: "了解运动营养的基本知识",
          duration_seconds: 1800, // 30 minutes
          is_free: false,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVideoClick = (videoId: string, hasAccess: boolean) => {
    if (hasAccess) {
      router.push(`/dashboard/knowledge/videos/${videoId}`);
    } else {
      // If no access, redirect to subscription page
      router.push("/dashboard/knowledge/subscribe");
    }
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-0">
          知识库 - 视频课程
        </h1>
        <p className="text-surface-600 dark:text-surface-300 mt-2">
          优质健身视频内容，涵盖力量训练、营养学、训练理论等多个方面
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="col-span-1">
                <Skeleton height="150px" borderRadius="16px" className="mb-2" />
                <Skeleton width="80%" height="1.5rem" className="mb-2" />
                <Skeleton width="60%" height="1rem" className="mb-2" />
                <Skeleton width="40%" height="1rem" />
              </div>
            ))
          : videos.map((video) => (
              <Card
                key={video.id}
                className="cursor-pointer hover:shadow-md transition-shadow duration-200 border-round-xl"
                onClick={() => handleVideoClick(video.id, video.is_free || false)}
              >
                <div className="flex flex-column align-items-center text-center">
                  {video.cover_image ? (
                    <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
                      <div 
                        className="absolute top-0 left-0 w-full h-full bg-cover bg-center border-round-md mb-3"
                        style={{ backgroundImage: `url(${video.cover_image})` }}
                      >
                        <div className="absolute bottom-2 right-2 bg-surface-900 bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                          {formatDuration(video.duration_seconds)}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-30rem bg-surface-200 border-round-md mb-3 flex align-items-center justify-content-center"
                         style={{ height: "150px" }}>
                      <i className="pi pi-video text-4xl text-surface-400"></i>
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-surface-900 dark:text-surface-0 line-clamp-1">
                    {video.title}
                  </h3>
                  <p className="text-sm text-surface-600 dark:text-surface-300 line-clamp-2 mb-2">
                    {video.summary || "暂无简介"}
                  </p>
                  <div className="mt-2 w-full">
                    <div className="flex justify-between align-items-center">
                      <span className="text-xs text-surface-500 dark:text-surface-400">
                        {video.source === "youtube" ? "YouTube" : "Bilibili"}
                      </span>
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
                </div>
              </Card>
            ))}
      </div>

      {videos.length === 0 && !loading && (
        <div className="text-center py-8">
          <i className="pi pi-video text-4xl text-surface-300 mb-3"></i>
          <h3 className="text-lg font-medium text-surface-600 dark:text-surface-300">
            暂无视频课程
          </h3>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            知识库暂无可用视频课程，请稍后再来查看
          </p>
        </div>
      )}
    </div>
  );
};

export default VideosPage;

