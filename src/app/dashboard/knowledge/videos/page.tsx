"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Video, Play, Lock, LockOpen } from "lucide-react";
import KnowledgeHeader from "@/components/knowledge/KnowledgeHeader";
import { useToastContext } from "@/context/ToastContext";

const VideosPage = () => {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToastContext();

  useEffect(() => {
    setTimeout(() => {
      setVideos([
        {
          id: "1",
          title: "力量训练基础",
          source: "youtube",
          source_url: "https://www.youtube.com/watch?v=example1",
          cover_image: "/placeholder-video.jpg",
          summary: "学习力量训练的基本原理和常见动作",
          duration_seconds: 1200,
          is_free: true,
        },
        {
          id: "2",
          title: "营养学入门",
          source: "bilibili",
          source_url: "https://www.bilibili.com/video/example2",
          cover_image: "/placeholder-video.jpg",
          summary: "了解运动营养的基本知识",
          duration_seconds: 1800,
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
      router.push("/dashboard/knowledge/subscribe");
    }
  };

  return (
    <div className="min-h-screen pb-32">
      <KnowledgeHeader
        title="视频课程"
        subtitle="优质健身视频内容，涵盖力量训练、营养学等多个方面"
        icon={Video}
        showBackButton={true}
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                  <div className="aspect-video bg-surface-200 dark:bg-surface-700 rounded-xl mb-3 animate-pulse" />
                  <div className="h-5 w-3/4 bg-surface-200 dark:bg-surface-700 rounded mb-2 animate-pulse" />
                  <div className="h-4 w-full bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                </div>
              ))
            : videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => handleVideoClick(video.id, video.is_free || false)}
                  className="text-left bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-700 mb-3">
                    {video.cover_image ? (
                      <>
                        <img
                          src={video.cover_image}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                            <Play size={20} className="text-surface-900 ml-1" />
                          </div>
                        </div>
                        <div className="absolute bottom-2 right-2 bg-surface-900/80 text-white text-xs px-2 py-1 rounded-lg">
                          {formatDuration(video.duration_seconds)}
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video size={48} className="text-surface-400" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 line-clamp-1 mb-1">
                    {video.title}
                  </h3>
                  <p className="text-sm text-surface-500 line-clamp-2 mb-3">
                    {video.summary || "暂无简介"}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-surface-400">
                      {video.source === "youtube" ? "YouTube" : "Bilibili"}
                    </span>
                    {video.is_free ? (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        <LockOpen size={12} />
                        免费
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                        <Lock size={12} />
                        付费
                      </span>
                    )}
                  </div>
                </button>
              ))}
        </div>

        {videos.length === 0 && !loading && (
          <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl">
            <Video size={48} className="mx-auto text-surface-300 mb-4" />
            <h3 className="text-lg font-bold text-surface-600 dark:text-surface-300">
              暂无视频课程
            </h3>
            <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
              知识库暂无可用视频课程，请稍后再来查看
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideosPage;
