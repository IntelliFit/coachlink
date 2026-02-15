'use client';

import React, { useState } from 'react';
import { MessageCircle, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from 'primereact/button';
import { Badge } from 'primereact/badge';
import type { FeedbackItem } from '@/app/api/coach/get-student-feedbacks/entity';

const DIFFICULTY_LABELS: Record<number, { label: string; emoji: string; color: string }> = {
    1: { label: '太轻松', emoji: '😴', color: 'text-blue-500' },
    2: { label: '轻松', emoji: '😊', color: 'text-green-500' },
    3: { label: '刚好', emoji: '💪', color: 'text-primary-600' },
    4: { label: '有点难', emoji: '😤', color: 'text-orange-500' },
    5: { label: '太难了', emoji: '🥵', color: 'text-red-500' },
};

interface StudentFeedbackPanelProps {
    feedbacks: FeedbackItem[];
    unreadCount: number;
    onAiSuggest?: () => void;
}

export default function StudentFeedbackPanel({
    feedbacks,
    unreadCount,
    onAiSuggest,
}: StudentFeedbackPanelProps) {
    const [expanded, setExpanded] = useState(feedbacks.length > 0 && unreadCount > 0);

    if (feedbacks.length === 0) return null;

    return (
        <div className="mb-4 border border-surface-200 rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* 可折叠标题 */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer select-none hover:bg-surface-50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <MessageCircle className="w-5 h-5 text-primary-500" />
                    <span className="font-semibold text-surface-800 text-sm">
                        学员训练反馈
                    </span>
                    {unreadCount > 0 && (
                        <Badge
                            value={unreadCount}
                            severity="danger"
                            className="text-xs"
                        />
                    )}
                    <span className="text-surface-400 text-xs ml-1">
                        共 {feedbacks.length} 条
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {onAiSuggest && feedbacks.length > 0 && (
                        <Button
                            label="AI 根据反馈调整"
                            icon={<Sparkles className="w-4 h-4 mr-1" />}
                            className="p-button-sm p-button-outlined text-xs rounded-xl"
                            severity="help"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAiSuggest();
                            }}
                        />
                    )}
                    {expanded
                        ? <ChevronUp className="w-4 h-4 text-surface-400" />
                        : <ChevronDown className="w-4 h-4 text-surface-400" />
                    }
                </div>
            </div>

            {/* 反馈列表 */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3 animate-fadeIn">
                    {feedbacks.map((fb) => {
                        const diff = fb.difficulty_rating
                            ? DIFFICULTY_LABELS[fb.difficulty_rating]
                            : null;
                        return (
                            <div
                                key={fb.id}
                                className={`p-3 rounded-xl border ${
                                    !fb.coach_read_at
                                        ? 'border-primary-200 bg-primary-50/50'
                                        : 'border-surface-100 bg-surface-50'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2 mb-1">
                                    <span className="text-xs font-medium text-surface-500">
                                        第 {fb.day_index} 天
                                    </span>
                                    <div className="flex items-center gap-2 text-xs text-surface-400">
                                        {diff && (
                                            <span className={diff.color}>
                                                {diff.emoji} {diff.label}
                                            </span>
                                        )}
                                        <span>
                                            {new Date(fb.created_at).toLocaleDateString('zh-CN', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-sm text-surface-700 leading-relaxed">
                                    {fb.content}
                                </p>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

