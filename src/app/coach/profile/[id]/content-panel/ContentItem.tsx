'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, Eye, MessageCircle, Lock, Play, Image, ArrowRight } from 'lucide-react';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { CoachContentRow } from '@/types';

interface CoachContentItemProps {
    content: CoachContentRow;
    coachId: string;
    userSubscription: any;
    onSubscribeSuccess: (tier: number) => void;
}

const CoachContentItem: React.FC<CoachContentItemProps> = ({
    content,
    coachId,
    userSubscription,
}) => {
    const { showToast } = useToastContext();
    const router = useRouter();

    // 渲染缩略图 - 遵循 16px 圆角与微妙光影逻辑
    const renderContentThumbnail = () => {
        const wrapperClass = "relative w-28 h-28 overflow-hidden rounded-2xl bg-surface-100/50 flex-shrink-0 group-hover:shadow-lg transition-all duration-500";

        if (content.thumbnail_url) {
            return (
                <div className={wrapperClass}>
                    <img src={content.thumbnail_url} alt={content.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    {content.content_type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                            <Play className="w-8 h-8 text-surface fill-current opacity-90" />
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className={`${wrapperClass} flex items-center justify-center border border-surface-200/50`}>
                {content.content_type === 'video'
                    ? <Play className="w-8 h-8 text-surface-400" />
                    : <Image className="w-8 h-8 text-surface-400" />
                }
            </div>
        );
    };

    // 低饱和功能色逻辑 - 遵循 50底+600字 规范
    const getTierConfig = (tier: number) => {
        switch (tier) {
            case 1: return { label: '基础订阅', class: 'bg-primary-50 text-primary-600' };
            case 2: return { label: '进阶订阅', class: 'bg-indigo-50 text-indigo-600' };
            case 3: return { label: '高级特权', class: 'bg-amber-50 text-amber-600' };
            default: return { label: '公开内容', class: 'bg-surface-50 text-surface-600' };
        }
    };

    const canViewContent = () => (userSubscription?.tier || 0) >= content.required_tier;

    const handleSubscribe = () => {
        const el = document.getElementById('choose-pricing');
        if (el) {
            const top = el.getBoundingClientRect().top + window.pageYOffset - 80;
            window.scrollTo({ top, behavior: 'smooth' });
        }
    };

    const tierConfig = getTierConfig(content.required_tier);

    return (
        <div className="group relative bg-surface border border-surface-100/60 rounded-[24px] p-6 transition-all duration-300 hover:shadow-xl hover:shadow-surface-200/40">
            <div className="flex flex-col md:flex-row gap-6">
                {/* 左侧主要内容 */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                        {/* 状态标签：低饱和色 */}
                        <span className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold uppercase tracking-wider ${tierConfig.class}`}>
                            {tierConfig.label}
                        </span>
                        {content.is_featured && (
                            <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 rounded-lg text-[11px] font-bold tracking-wider">
                                精选回放
                            </span>
                        )}
                        <h3 className="w-full text-xl font-bold text-surface-900 tracking-tight line-clamp-1 mt-1">
                            {content.title}
                        </h3>
                    </div>

                    <p className="text-surface-500 text-sm leading-relaxed line-clamp-2 mb-4 font-light">
                        {content.content}
                    </p>

                    {/* 标签组 - 极简灰勾勒 */}
                    {content.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-5">
                            {content.tags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} className="text-xs text-surface-400 font-medium">
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* 底部数据栏 - 数值对比鲜明 */}
                    <div className="flex items-center gap-6 border-t border-surface-50 pt-4">
                        <div className="flex items-center gap-1.5 text-surface-400">
                            <Eye className="w-4 h-4 stroke-[1.5px]" />
                            <span className="text-xs text-surface-900">{content.views_count.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-surface-400">
                            <ThumbsUp className="w-4 h-4 stroke-[1.5px]" />
                            <span className="text-xs text-surface-900">{content.likes_count}</span>
                        </div>
                        <span className="text-xs text-surface-300 ml-auto">
                            {new Date(content.created_at).toLocaleString('zh-CN', {
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: false
                            }).replace(/\//g, '-')}
                        </span>
                    </div>
                </div>

                {/* 右侧：缩略图与操作 */}
                <div className="flex flex-col items-end justify-between">
                    {renderContentThumbnail()}

                    <div className="mt-4">
                        {canViewContent() ? (
                            <button
                                onClick={() => router.push(`/coach/content/${content.id}`)}
                                className="flex items-center gap-2 text-sm font-bold text-primary-500 hover:text-primary-600 transition-colors group/btn"
                            >
                                立即阅读
                                <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                            </button>
                        ) : (
                            <button
                                onClick={handleSubscribe}
                                className="flex items-center gap-2 px-4 py-2 bg-surface-900 text-surface rounded-xl text-xs font-bold hover:bg-primary-500 transition-all duration-300 shadow-md shadow-surface-200"
                            >
                                <Lock className="w-3.5 h-3.5" />
                                解锁全文
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoachContentItem;