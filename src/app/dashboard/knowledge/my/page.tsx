"use client";

import React, { useState, useEffect } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { ProgressBar } from "primereact/progressbar";
import { TabView, TabPanel } from "primereact/tabview";
import { useToastContext } from "@/context/ToastContext";

const MyLearningPage = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [learningProgress, setLearningProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToastContext();

  useEffect(() => {
    // Simulating API call for learning progress
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
          last_position: { time: 1200 }, // 20 minutes
          completed_at: new Date().toISOString(),
          cover_image: "/placeholder-video.jpg",
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const formatProgress = (progress: number) => {
    return `${Math.round(progress)}%`;
  };

  const handleContinueLearning = (item: any) => {
    if (item.content_type === "book") {
      window.location.href = `/dashboard/knowledge/books/${item.content_id}`;
    } else if (item.content_type === "video") {
      window.location.href = `/dashboard/knowledge/videos/${item.content_id}`;
    }
  };

  const handleMarkComplete = (item: any) => {
    // In a real app, this would call an API to mark as complete
    showToast({
      severity: "success",
      summary: "成功",
      detail: `已标记"${item.title}"为完成`,
    });
  };

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-0">
          <i className="pi pi-chart-line mr-2 text-green-500"></i>
          我的学习进度
        </h1>
        <p className="text-surface-600 dark:text-surface-300 mt-2">
          跟踪您的知识库学习进度和历史记录
        </p>
      </div>

      <TabView activeIndex={activeTab} onTabChange={(e) => setActiveTab(e.index)}>
        <TabPanel header="学习进度">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading
              ? Array.from({ length: 6 }).map((_, index) => (
                  <Card key={index} className="border-round-xl">
                    <div className="flex">
                      <div className="mr-3">
                        <div className="bg-surface-200 border-round w-16 h-20" />
                      </div>
                      <div className="flex-grow">
                        <div className="h-4 bg-surface-200 rounded mb-2"></div>
                        <div className="h-3 bg-surface-200 rounded mb-2 w-3/4"></div>
                        <div className="h-3 bg-surface-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </Card>
                ))
              : learningProgress
                  .filter(item => item.progress < 100)
                  .map((item) => (
                    <Card key={item.id} className="border-round-xl">
                      <div className="flex">
                        <div className="mr-3">
                          {item.cover_image ? (
                            <img
                              src={item.cover_image}
                              alt={item.title}
                              className="w-16 h-20 object-cover border-round"
                            />
                          ) : (
                            <div className="w-16 h-20 bg-surface-200 border-round flex align-items-center justify-content-center">
                              <i className={`pi ${item.content_type === "book" ? "pi-book" : "pi-video"} text-xl text-surface-400`}></i>
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <h3 className="font-semibold text-surface-900 dark:text-surface-0 line-clamp-1">
                            {item.title}
                          </h3>
                          <div className="mt-2">
                            <ProgressBar 
                              value={item.progress} 
                              showValue={false}
                              className="h-2"
                            />
                            <div className="flex justify-between mt-1">
                              <span className="text-xs text-surface-600 dark:text-surface-400">
                                {formatProgress(item.progress)}
                              </span>
                              <span className="text-xs text-surface-600 dark:text-surface-400">
                                {item.content_type === "book" 
                                  ? `第${item.last_position.chapter}章` 
                                  : `${Math.floor(item.last_position.time / 60)}:${(item.last_position.time % 60).toString().padStart(2, "0")}`}
                              </span>
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button
                              label="继续学习"
                              icon="pi pi-play"
                              size="small"
                              className="p-button-sm p-button-outlined flex-grow"
                              onClick={() => handleContinueLearning(item)}
                            />
                            <Button
                              label="完成"
                              icon="pi pi-check"
                              size="small"
                              className="p-button-sm p-button-success"
                              onClick={() => handleMarkComplete(item)}
                            />
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
          </div>

          {learningProgress.filter(item => item.progress < 100).length === 0 && !loading && (
            <div className="text-center py-8">
              <i className="pi pi-check-circle text-4xl text-green-400 mb-3"></i>
              <h3 className="text-lg font-medium text-surface-600 dark:text-surface-300">
                暂无进行中的学习
              </h3>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                您已完成所有已开始的学习内容
              </p>
              <Button
                label="浏览知识库"
                icon="pi pi-book"
                className="mt-4"
                onClick={() => window.location.href = "/dashboard/knowledge"}
              />
            </div>
          )}
        </TabPanel>

        <TabPanel header="已完��">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {learningProgress
              .filter(item => item.progress === 100)
              .map((item) => (
                <Card key={item.id} className="border-round-xl opacity-80">
                  <div className="flex">
                    <div className="mr-3">
                      {item.cover_image ? (
                        <img
                          src={item.cover_image}
                          alt={item.title}
                          className="w-16 h-20 object-cover border-round"
                        />
                      ) : (
                        <div className="w-16 h-20 bg-surface-200 border-round flex align-items-center justify-content-center">
                          <i className={`pi ${item.content_type === "book" ? "pi-book" : "pi-video"} text-xl text-surface-400`}></i>
                        </div>
                      )}
                    </div>
                    <div className="flex-grow">
                      <h3 className="font-semibold text-surface-900 dark:text-surface-0 line-clamp-1">
                        {item.title}
                      </h3>
                      <div className="mt-2 flex align-items-center">
                        <i className="pi pi-check-circle text-green-500 mr-2"></i>
                        <span className="text-sm text-surface-600 dark:text-surface-400">
                          已完成
                        </span>
                        {item.completed_at && (
                          <span className="text-xs text-surface-500 dark:text-surface-500 ml-2">
                            {new Date(item.completed_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <div className="mt-3">
                        <Button
                          label="重新学习"
                          icon="pi pi-refresh"
                          size="small"
                          className="p-button-sm p-button-outlined w-full"
                          onClick={() => handleContinueLearning(item)}
                        />
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
          </div>

          {learningProgress.filter(item => item.progress === 100).length === 0 && !loading && (
            <div className="text-center py-8">
              <i className="pi pi-book text-4xl text-surface-300 mb-3"></i>
              <h3 className="text-lg font-medium text-surface-600 dark:text-surface-300">
                暂无完成的学习
              </h3>
              <p className="text-surface-500 dark:text-surface-400 mt-1">
                完成学习内容后会显示在这里
              </p>
            </div>
          )}
        </TabPanel>
      </TabView>
    </div>
  );
};

export default MyLearningPage;

