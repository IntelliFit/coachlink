'use client';

import React, { useState, useRef } from 'react';
import { Button } from 'primereact/button';
import { InputTextarea } from 'primereact/inputtextarea';
import { Toast } from 'primereact/toast';
import { MessageSquare, HelpCircle } from 'lucide-react';
import { feedbackService } from '@/app/service/feedbackService';

// Mock 常问问题
const faqQuestions = [
    {
        id: 1,
        question: '如何创建训练计划？',
        category: '功能使用'
    },
    {
        id: 2,
        question: '视频上传失败怎么办？',
        category: '问题反馈'
    },
    {
        id: 3,
        question: '如何添加学员？',
        category: '功能使用'
    },
    {
        id: 4,
        question: '订阅功能如何使用？',
        category: '功能使用'
    },
    {
        id: 5,
        question: '视频播放卡顿',
        category: '问题反馈'
    },
    {
        id: 6,
        question: '如何修改个人信息？',
        category: '功能使用'
    }
];

export default function FeedbackPage() {
    const [feedback, setFeedback] = useState('');
    const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const toast = useRef<Toast>(null);
    const textareaWrapperRef = useRef<HTMLDivElement>(null);

    const handleQuestionClick = (question: string) => {
        // 如果之前选择了问题，需要从 feedback 中移除之前的问题
        let newFeedback = feedback;
        if (selectedQuestion) {
            // 移除之前的问题（可能前后有换行）
            const previousQuestion = selectedQuestion.trim();
            // 尝试匹配：可能前面有换行，后面也可能有换行
            const patterns = [
                `\n\n${previousQuestion}\n\n`,
                `\n\n${previousQuestion}\n`,
                `\n\n${previousQuestion}`,
                `${previousQuestion}\n\n`,
                `${previousQuestion}\n`,
                previousQuestion
            ];
            
            for (const pattern of patterns) {
                if (newFeedback.includes(pattern)) {
                    newFeedback = newFeedback.replace(pattern, '');
                    break;
                }
            }
            
            // 如果移除后只剩下空白，清空
            if (!newFeedback.trim()) {
                newFeedback = '';
            }
        }
        
        // 设置新问题
        setSelectedQuestion(question);
        if (newFeedback.trim()) {
            // 如果还有用户输入的其他内容，追加新问题
            setFeedback(newFeedback + '\n\n' + question);
        } else {
            // 如果没有其他内容，直接设置新问题
            setFeedback(question);
        }
        
        // 等待状态更新后聚焦并滚动到输入框
        setTimeout(() => {
            const wrapper = textareaWrapperRef.current;
            if (wrapper) {
                const textarea = wrapper.querySelector('textarea') as HTMLTextAreaElement;
                if (textarea) {
                    textarea.focus();
                    // 滚动到输入框位置，添加一些偏移量以便更好地查看
                    textarea.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'center' 
                    });
                }
            }
        }, 0);
    };

    const handleSubmit = async () => {
        if (!feedback.trim()) {
            toast.current?.show({
                severity: 'warn',
                summary: '提示',
                detail: '请输入反馈内容',
                life: 3000
            });
            return;
        }

        setLoading(true);
        try {
            const result = await feedbackService.submitFeedback({
                content: feedback,
                relatedQuestion: selectedQuestion || undefined
            });

            if (result?.success) {
                toast.current?.show({
                    severity: 'success',
                    summary: '提交成功',
                    detail: '感谢您的反馈，我们会认真处理',
                    life: 3000
                });
                setFeedback('');
                setSelectedQuestion(null);
            } else {
                throw new Error(result?.message || '提交失败');
            }
        } catch (error: any) {
            console.error('提交反馈失败:', error);
            toast.current?.show({
                severity: 'error',
                summary: '提交失败',
                detail: error.message || '网络错误，请稍后重试',
                life: 3000
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen p-4 md:p-8">
            <Toast ref={toast} />
            
            <div className="max-w-3xl mx-auto">
                {/* 页面标题 */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary-50 flex items-center justify-center">
                            <MessageSquare className="w-6 h-6 text-primary-600" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black text-surface-900 tracking-tight">意见反馈</h1>
                            <p className="text-sm text-surface-500 mt-1">您的建议是我们改进的动力</p>
                        </div>
                    </div>
                </div>

                {/* 常问问题区域 */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <HelpCircle className="w-5 h-5 text-surface-400" />
                        <h2 className="text-lg font-bold text-surface-900">常问问题</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {faqQuestions.map((faq) => (
                            <button
                                key={faq.id}
                                onClick={() => handleQuestionClick(faq.question)}
                                className="text-left p-4 rounded-2xl bg-surface border border-surface-200 hover:border-primary-300 hover:bg-primary-50/50 transition-all active:scale-[0.98]"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-surface-900 mb-1 line-clamp-2">
                                            {faq.question}
                                        </p>
                                        <span className="text-xs text-surface-400 font-medium">
                                            {faq.category}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* 反馈输入区域 */}
                <div className="mb-6">
                    <div className="mb-4">
                        <label className="block text-sm font-bold text-surface-900 mb-2">
                            您的反馈
                        </label>
                        <p className="text-xs text-surface-500 mb-3">
                            请详细描述您的问题或建议，我们会认真对待每一条反馈
                        </p>
                    </div>
                    <div ref={textareaWrapperRef}>
                        <InputTextarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={8}
                            placeholder="请输入您的反馈内容..."
                            className="w-full rounded-2xl border-surface-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-surface-400">
                            {feedback.length} / 2000 字
                        </span>
                        {selectedQuestion && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-surface-500">已选择问题</span>
                                <button
                                    onClick={() => {
                                        setSelectedQuestion(null);
                                        setFeedback('');
                                    }}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    清除
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 提交按钮 */}
                <div className="flex justify-end gap-3">
                    <Button
                        label="测试 Toast"
                        onClick={() => {
                            toast.current?.show({
                                severity: 'info',
                                summary: '提示',
                                detail: '这是移动端居中 Toast 测试',
                                life: 2000
                            });
                        }}
                        className="p-button-outlined font-bold rounded-2xl"
                    />
                    <Button
                        label="取消"
                        onClick={() => {
                            setFeedback('');
                            setSelectedQuestion(null);
                        }}
                        className="p-button-text font-bold text-surface-400 rounded-2xl"
                        disabled={loading || !feedback.trim()}
                    />
                    <Button
                        label="提交反馈"
                        onClick={handleSubmit}
                        loading={loading}
                        disabled={loading || !feedback.trim()}
                        className="bg-primary-600 border-none font-bold px-6 rounded-2xl text-surface active:scale-[0.98]"
                    />
                </div>
            </div>
        </div>
    );
}
