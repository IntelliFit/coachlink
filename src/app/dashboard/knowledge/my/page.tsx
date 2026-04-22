"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Video, Play, CheckCircle, RotateCcw, BarChart3 } from "lucide-react";
import KnowledgeHeader from "@/components/knowledge/KnowledgeHeader";
import { useToastContext } from "@/context/ToastContext";

const MyLearningPage = () => {
  const [activeTab, setActiveTab] = useState<'progress' | 'completed'>('progress');
  const [learningProgress, setLearningProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToastContext();

  useEffect(() => {
    setTimeout(() => {
      setLearningProgress([
        {
          id: "1",
          content_type: "book",
          content_id: "book1",
          title: "力量训练基础",
          progress: 80,
          last_position: { chapter: 3, page: 45 },
          completed_at: null,
          cover_image: "/placeholder-book.jpg",
        },
        {
          id: "2",
          content_type: "book",
          content_id: "book2",
          title: "营养学入门",
          progress: 30,
          last_position: { chapter: 1, page: 12 },
          completed_at: null,
          cover_image: "/placeholder-book.jpg",
        },
        {
          id: "3",
          content_type: "video",
          content_id: "video1",
          title: "核心力量训练",
          progress: 100,
          last_position: { time: 1200 },
          completed_at: new Date().toISOString(),
          cover_image: "/placeholder-video.jpg",
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const handleContinueLearning = (item: any) => {
    if (item.content_type === "book") {
      router.push(`/dashboard/knowledge/books/${item.content_id}`);
    } else if (item.content_type === "video") {
      router.push(`/dashboard/knowledge/videos/${item.content_id}`);
    }
  };

  const handleMarkComplete = (item: any) => {
    showToast({
      severity: "success",
      summary: "成功",
      detail: `已标记"${item.title}"为完成`,
    });
  };

  const inProgressItems = learningProgress.filter(item => item.progress < 100);
  const completedItems = learningProgress.filter(item => item.progress === 100);

  return (
    <div className="min-h-screen pb-32">
      <KnowledgeHeader
        title="我的学习"
        subtitle="跟踪您的学习进度和历史记录"
        icon={BarChart3}
        showBackButton={true}
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {/* Tab Navigation */}
        <div className="flex items-center gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1 mb-6">
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'progress'
                ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <Play size={14} />
            学习中 ({inProgressItems.length})
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'completed'
                ? 'bg-white dark:bg-surface-700 text-primary-600 shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            }`}
          >
            <CheckCircle size={14} />
            已完成 ({completedItems.length})
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                <div className="flex gap-4">
                  <div className="w-16 h-20 bg-surface-200 dark:bg-surface-700 rounded-xl animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-3/4 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                    <div className="h-4 w-1/2 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                    <div className="h-3 w-full bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : activeTab === 'progress' ? (
          <>
            {inProgressItems.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl">
                <CheckCircle size={48} className="mx-auto text-green-400 mb-4" />
                <h3 className="text-lg font-bold text-surface-600 dark:text-surface-300">
                  暂无进行中的学习
                </h3>
                <p className="text-surface-500 mt-1 text-sm">
                  您已完成所有已开始的学习内容
                </p>
                <button
                  onClick={() => router.push("/dashboard/knowledge")}
                  className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-xl text-sm font-bold"
                >
                  浏览知识库
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {inProgressItems.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                    <div className="flex gap-4">
                      <div className="shrink-0">
                        {item.cover_image ? (
                          <img
                            src={item.cover_image}
                            alt={item.title}
                            className="w-16 h-20 object-cover rounded-xl"
                          />
                        ) : (
                          <div className="w-16 h-20 bg-surface-100 dark:bg-surface-700 rounded-xl flex items-center justify-center">
                            {item.content_type === "book" ? (
                              <BookOpen size={24} className="text-surface-400" />
                            ) : (
                              <Video size={24} className="text-surface-400" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-surface-900 dark:text-surface-100 truncate">
                          {item.title}
                        </h3>
                        <div className="mt-2">
                          <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary-500 rounded-full transition-all"
                              style={{ width: `${item.progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between mt-1">
                            <span className="text-xs text-surface-500">
                              {Math.round(item.progress)}%
                            </span>
                            <span className="text-xs text-surface-400">
                              {item.content_type === "book"
                                ? `第${item.last_position.chapter}章`
                                : `${Math.floor(item.last_position.time / 60)}:${(item.last_position.time % 60).toString().padStart(2, "0")}`}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleContinueLearning(item)}
                            className="flex-1 flex items-center justify-center gap-1 px-3 py-2 border border-primary-200 dark:border-primary-800 text-primary-600 text-sm font-semibold rounded-lg hover:bg-primary-50"
                          >
                            <Play size={14} />
                            继续学习
                          </button>
                          <button
                            onClick={() => handleMarkComplete(item)}
                            className="px-3 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg hover:bg-green-600"
                          >
                            <CheckCircle size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            {completedItems.length === 0 ? (
              <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl">
                <BookOpen size={48} className="mx-auto text-surface-300 mb-4" />
                <h3 className="text-lg font-bold text-surface-600 dark:text-surface-300">
                  暂无完成的学习
                </h3>
                <p className="text-surface-500 mt-1 text-sm">
                  完成学习内容后会显示在这里
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedItems.map((item) => (
                  <div key={item.id} className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm opacity-80">
                    <div className="flex gap-4">
                      <div className="shrink-0">
                        {item.cover_image ? (
                          <img
                            src={item.cover_image}
                            alt={item.title}
                            className="w-16 h-20 object-cover rounded-xl"
                          />
                        ) : (
                          <div className="w-16 h-20 bg-surface-100 dark:bg-surface-700 rounded-xl flex items-center justify-center">
                            {item.content_type === "book" ? (
                              <BookOpen size={24} className="text-surface-400" />
                            ) : (
                              <Video size={24} className="text-surface-400" />
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-surface-900 dark:text-surface-100 truncate">
                          {item.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-2">
                          <CheckCircle size={16} className="text-green-500" />
                          <span className="text-sm text-surface-600 dark:text-surface-400">
                            已完成
                          </span>
                          {item.completed_at && (
                            <span className="text-xs text-surface-400">
                              {new Date(item.completed_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => handleContinueLearning(item)}
                          className="mt-3 w-full flex items-center justify-center gap-1 px-3 py-2 border border-surface-200 dark:border-surface-700 text-surface-600 text-sm font-semibold rounded-lg hover:bg-surface-50"
                        >
                          <RotateCcw size={14} />
                          重新学习
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyLearningPage;
