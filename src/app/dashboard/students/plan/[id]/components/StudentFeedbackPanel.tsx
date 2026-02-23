'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { MessageSquare, Sparkles } from 'lucide-react';
import type { FeedbackItem } from '@/app/api/coach/get-student-feedbacks/entity';

const DIFFICULTY_MAP: Record<number, string> = {
    1: '太轻松',
    2: '轻松',
    3: '刚好',
    4: '有点难',
    5: '太难了',
};

interface StudentFeedbackPanelProps {
    feedbacks: FeedbackItem[];
    unreadCount: number;
    onAiSuggest: () => void;
}

export default function StudentFeedbackPanel({
    feedbacks,
    unreadCount,
    onAiSuggest,
}: StudentFeedbackPanelProps) {
    const hasFeedbacks = feedbacks.length > 0;

    return (
        <div className="group relative bg-surface rounded-[24px] p-5 transition-all duration-500 ease-out border border-surface-200/70 hover:border-primary-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500/[0.02] to-transparent opacity-0 group-hover:opacity-100 rounded-[24px] transition-opacity duration-500 pointer-events-none" />
            <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={20} className="text-primary-600" strokeWidth={2} />
                        <span className="font-bold text-surface-900 tracking-tight">学员训练反馈</span>
                        {unreadCount > 0 && (
                            <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                                {unreadCount} 条未读
                            </span>
                        )}
                    </div>
                </div>
                {hasFeedbacks ? (
                    <>
                        <ul className="text-sm text-surface-600 space-y-1.5 max-h-32 overflow-y-auto">
                            {feedbacks.slice(0, 5).map((fb, i) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-primary-600 font-medium shrink-0">第{fb.day_index}天</span>
                                    {fb.difficulty_rating != null && (
                                        <span className="text-surface-500 shrink-0">
                                            （{DIFFICULTY_MAP[fb.difficulty_rating] ?? fb.difficulty_rating}）
                                        </span>
                                    )}
                                    <span className="truncate">{fb.content || '—'}</span>
                                </li>
                            ))}
                        </ul>
                        <Button
                            label="根据反馈让 AI 调整计划"
                            icon={<Sparkles className="w-4 h-4" />}
                            onClick={onAiSuggest}
                            className="w-full sm:w-auto"
                        />
                    </>
                ) : (
                    <p className="text-sm text-surface-500">暂无训练反馈，执行计划后学员可填写反馈。</p>
                )}
            </div>
        </div>
    );
}
