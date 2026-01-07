"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { InputText } from "primereact/inputtext";
import { InputTextarea } from "primereact/inputtextarea";
import { ScrollPanel } from "primereact/scrollpanel";
import { Toast } from "primereact/toast";
import { useToastContext } from "@/context/ToastContext";

const AIQAPage = () => {
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [history, setHistory] = useState<any[]>([]);
    const [quota, setQuota] = useState({ used: 3, total: 10 }); // Mock quota

    const { showToast } = useToastContext();
    const scrollPanel = useRef<ScrollPanel>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!question.trim()) {
            showToast({
                severity: "warn",
                summary: "警告",
                detail: "请输入您的问题",
            });
            return;
        }

        if (quota.used >= quota.total) {
            showToast({
                severity: "error",
                summary: "错误",
                detail: "本月AI问答次数已用完，请下月再试或升级会员",
            });
            return;
        }

        setIsLoading(true);
        setAnswer("");

        try {
            // Simulating API call to AI service
            setTimeout(() => {
                const mockAnswer = "关于" + question + "的问题，根据知识库中的信息，我可以为您提供以下解答：\n\n这是一个基于知识库的AI回答示例。在实际实现中，这里会调用RAG系统从知识库中检索相关信息并生成回答。\n\n参考来源：\n- 示例书籍《力量训练基础》\n- 示例视频《营养学入门》";

                const newEntry = {
                    id: Date.now(),
                    question: question,
                    answer: mockAnswer,
                    timestamp: new Date().toLocaleString(),
                };

                setAnswer(mockAnswer);
                setHistory(prev => [newEntry, ...prev]);
                setQuota(prev => ({ ...prev, used: prev.used + 1 }));
                setQuestion("");
                setIsLoading(false);
            }, 1500);
        } catch (error) {
            console.error("AI问答请求失败:", error);
            showToast({
                severity: "error",
                summary: "错误",
                detail: "AI问答请求失败，请稍后重试",
            });
            setIsLoading(false);
        }
    };

    return (
        <div className="p-4">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-0">
                    <i className="pi pi-comments mr-2 text-blue-500"></i>
                    知识库 AI 问答
                </h1>
                <p className="text-surface-600 dark:text-surface-300 mt-2">
                    基于知识库的智能问答系统，为您解答运动训练相关问题
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    <Card className="border-round-xl h-full flex flex-column">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-0">
                                问答对话
                            </h2>
                            <div className="text-sm">
                                <span className="text-surface-600 dark:text-surface-300">
                                    本月已用: <span className="font-bold">{quota.used}</span> / {quota.total} 次
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="mb-4">
                            <div className="flex flex-column sm:flex-row gap-2">
                                <InputText
                                    value={question}
                                    onChange={(e) => setQuestion(e.target.value)}
                                    placeholder="输入您的运动训练相关问题..."
                                    className="flex-grow"
                                />
                                <Button
                                    type="submit"
                                    label="提问"
                                    icon="pi pi-send"
                                    loading={isLoading}
                                    className="whitespace-nowrap"
                                />
                            </div>
                        </form>

                        {isLoading && (
                            <div className="mb-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-xl border">
                                <div className="flex align-items-center">
                                    <i className="pi pi-spin pi-spinner text-blue-500 mr-2"></i>
                                    <span className="text-surface-600 dark:text-surface-300">
                                        AI正在思考中...
                                    </span>
                                </div>
                            </div>
                        )}

                        {answer && (
                            <div className="mb-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-xl border">
                                <div className="text-surface-800 dark:text-surface-200 whitespace-pre-line">
                                    {answer}
                                </div>
                            </div>
                        )}

                        <div className="flex-grow">
                            <h3 className="text-md font-semibold text-surface-800 dark:text-surface-200 mb-2">
                                最新问答
                            </h3>
                            <ScrollPanel ref={scrollPanel} style={{ width: "100%", height: "300px" }}>
                                <div className="space-y-4">
                                    {history.length > 0 ? (
                                        history.map((entry) => (
                                            <div key={entry.id} className="p-3 bg-surface-100 dark:bg-surface-700 rounded-lg">
                                                <div className="mb-2">
                                                    <span className="text-sm font-semibold text-surface-700 dark:text-surface-300">
                                                        问: {entry.question}
                                                    </span>
                                                </div>
                                                <div className="text-surface-600 dark:text-surface-400 text-sm whitespace-pre-line">
                                                    <span className="font-medium">答:</span> {entry.answer}
                                                </div>
                                                <div className="text-xs text-surface-500 dark:text-surface-500 mt-2">
                                                    {entry.timestamp}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-8 text-surface-500 dark:text-surface-400">
                                            <i className="pi pi-comment text-3xl mb-3"></i>
                                            <p>暂无问答记录</p>
                                            <p className="text-sm mt-1">输入问题开始与AI对话</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollPanel>
                        </div>
                    </Card>
                </div>

                <div>
                    <Card className="border-round-xl">
                        <h2 className="text-lg font-semibold text-surface-900 dark:text-surface-0 mb-4">
                            使用指南
                        </h2>
                        <ul className="list-disc pl-5 space-y-2 text-surface-700 dark:text-surface-300">
                            <li>输入关于运动训练的问题</li>
                            <li>AI将基于知识库内容回答</li>
                            <li>每月有固定的问答次数</li>
                            <li>升级会员可获得更多次数</li>
                        </ul>

                        <div className="mt-6">
                            <h3 className="text-md font-semibold text-surface-900 dark:text-surface-0 mb-3">
                                会员权益
                            </h3>
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-surface-700 dark:text-surface-300">基础会员</span>
                                    <span className="text-surface-700 dark:text-surface-300">10次/月</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-surface-700 dark:text-surface-300">高级会员</span>
                                    <span className="text-surface-700 dark:text-surface-300">100次/月</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-surface-700 dark:text-surface-300">超出部分</span>
                                    <span className="text-surface-700 dark:text-surface-300">¥0.5/次</span>
                                </div>
                            </div>
                        </div>

                        <Button
                            label="升级会员"
                            icon="pi pi-arrow-up"
                            className="p-button-success w-full mt-4"
                            onClick={() => window.location.href = "/dashboard/knowledge/subscribe"}
                        />
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AIQAPage;

