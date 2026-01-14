'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { ThumbsUp, Eye, MessageCircle, Lock, Play, Image, ArrowLeft, Share2, Bookmark, Heart } from 'lucide-react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachContentRow } from '@/types';

const ContentPage = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const [content, setContent] = useState<CoachContentRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [accessTier, setAccessTier] = useState<number>(0);
    const [hasLiked, setHasLiked] = useState<boolean>(false);

    const params = useParams();

    useEffect(() => {
        if (session?.user?.id) {
            fetchContent();
        }
    }, [session?.user?.id]);

    const fetchContent = async () => {
        try {
            setLoading(true);
            const result = await coachService.getContentById({
                contentId: params.id.toString(),
                viewerId: session?.user?.id
            });
            if (result) {
                setContent(result.content);
                setAccessTier(result.accessTier);

                // Check if user has already liked this content
                if (session?.user?.id) {
                    await checkIfUserLiked(params.id.toString(), session.user.id);
                }
            } else {
                router.push('/404');
            }
        } catch (error) {
            showToast({ severity: 'error', summary: '错误', detail: '无法获取内容' });
        } finally {
            setLoading(false);
        }
    };

    const checkIfUserLiked = async (contentId: string, userId: string) => {
        try {
            // Check if user has already liked this content by using the new API endpoint
            const result = await coachService.checkContentInteraction({
                contentId,
                userId,
                interactionType: 'like'
            });            

            if (result) {
                setHasLiked(result.hasInteracted);
            }
        } catch (error) {
            console.error('Error checking if user liked:', error);
        }
    };

    const canViewContent = () => (content ? accessTier >= content.required_tier : false);

    const handleLike = async () => {
        if (!session?.user?.id) {
            showToast({ severity: 'warn', summary: '提示', detail: '请先登录' });
            return;
        }

        if (!content) {
            showToast({ severity: 'error', summary: '错误', detail: '内容不存在' });
            return;
        }

        // Optimistically update UI
        const previousHasLiked = hasLiked;
        const previousLikesCount = content.likes_count;

        // Update UI immediately
        setHasLiked(!hasLiked);
        setContent({
            ...content,
            likes_count: hasLiked ? content.likes_count - 1 : content.likes_count + 1
        });

        try {
            const result = await coachService.interactWithContent({
                contentId: content.id,
                interactionType: 'like'
            });

            if (result) {
                // Update the content's likes count
                if (result.updatedLikesCount !== undefined && content) {
                    setContent({
                        ...content,
                        likes_count: result.updatedLikesCount
                    });
                }

                // Toggle the hasLiked state based on the action
                if (result.action === 'added') {
                    setHasLiked(true);
                } else if (result.action === 'removed') {
                    setHasLiked(false);
                }
            }
        } catch (error) {
            console.error('Error liking content:', error);
            // Revert the optimistic update on error
            setHasLiked(previousHasLiked);
            setContent({
                ...content,
                likes_count: previousLikesCount
            });
            showToast({ severity: 'error', summary: '错误', detail: '操作失败' });
        }
    };

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            showToast({
                severity: 'success',
                summary: '链接已复制',
                detail: '内容链接已复制到剪贴板'
            });
        } catch (error) {
            console.error('Error sharing content:', error);
            showToast({
                severity: 'error',
                summary: '复制失败',
                detail: '无法复制链接到剪贴板'
            });
        }
    };

    const getTierConfig = (tier: number) => {
        switch (tier) {
            case 1: return { label: '基础订阅', class: 'bg-primary-50 text-primary-600' };
            case 2: return { label: '进阶订阅', class: 'bg-indigo-50 text-indigo-600' };
            case 3: return { label: '高级特权', class: 'bg-amber-50 text-amber-600' };
            default: return { label: '公开内容', class: 'bg-surface-50 text-surface-600' };
        }
    };

    if (loading) return <ContentSkeleton />;

    const tierConfig = getTierConfig(content?.required_tier || 0);

    return (
        <div className="min-h-screen py-8 pb-24">
            <div className="max-w-3xl mx-auto px-4">
                {/* 顶部导航 */}
                <button 
                    onClick={() => router.back()}
                    className="group flex items-center gap-2 mb-8 text-surface-400 hover:text-primary-500 transition-all active:scale-95"
                >
                    <div className="p-2 rounded-full transition-all">
                        <ArrowLeft className="w-4 h-4" />
                    </div>
                    <span className="text-sm font-bold tracking-tight">返回列表</span>
                </button>

                {/* 内容头部：聚焦元数据 */}
                <header className="mb-8 px-2">
                    <div className="flex items-center gap-3 mb-4">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${tierConfig.class}`}>
                            {tierConfig.label}
                        </span>
                        {content?.is_featured && (
                            <span className="px-3 py-1 bg-rose-50 text-rose-600 rounded-full text-[10px] font-black uppercase tracking-widest">
                                Editor's Pick
                            </span>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold text-surface-900 tracking-tighter leading-[1.1] mb-6">
                        {content?.title}
                    </h1>
                    
                    <div className="flex items-center justify-between text-surface-400 border-b border-surface-100 pb-6">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-1.5">
                                <Eye className="w-4 h-4 stroke-[1.5px]" />
                                <span className="text-xs text-surface-900">{content?.views_count?.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={handleLike}
                                    className={`flex items-center gap-1.5 transition-colors hover:text-red-500`}
                                >
                                    <Heart
                                        className={`w-4 h-4 stroke-[1.5px] ${hasLiked ? 'fill-current text-red-500' : ''}`}
                                    />
                                    <span className="text-xs text-surface-900">{content?.likes_count}</span>
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={handleShare}
                                className="flex items-center gap-1.5 hover:text-primary-500 transition-colors"
                            >
                                <Share2 className="w-4 h-4 stroke-[1.5px]" />
                                <span className="text-xs text-surface-900">分享</span>
                            </button>
                            <span className="text-[11px]">
                                {new Date(content?.created_at || '').toLocaleString('zh-CN', {
                                    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
                                }).replace(/\//g, '-')}
                            </span>
                        </div>
                    </div>
                </header>

                {/* 正文区域 */}
                <article className="bg-surface border border-surface-100/50 rounded-[32px] overflow-hidden shadow-sm">
                    {canViewContent() ? (
                        <div className="p-8 md:p-12">
                            {/* 媒体展示 */}
                            {content?.media_urls && content.media_urls.length > 0 && (
                                <div className="space-y-4 mb-10">
                                    {content.media_urls.map((url, idx) => (
                                        <div key={idx} className="rounded-2xl overflow-hidden bg-surface-50 border border-surface-100">
                                            {content.content_type === 'video' ? (
                                                <video src={url} controls className="w-full block" />
                                            ) : (
                                                <img src={url} alt="" className="w-full h-auto block hover:scale-[1.02] transition-transform duration-700" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 正文文本 - 修复重复点：此处才是完整正文 */}
                            <div className="text-surface-700 leading-[1.8] whitespace-pre-line font-light text-lg tracking-normal">
                                {content?.content}
                            </div>

                            {/* 标签 */}
                            {content?.tags && (
                                <div className="mt-12 pt-8 border-t border-surface-50 flex flex-wrap gap-2">
                                    {content.tags.map((tag, idx) => (
                                        <span key={idx} className="px-3 py-1 bg-surface-50 text-surface-400 rounded-lg text-xs font-medium">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* 付费墙墙逻辑 */
                        <div className="p-12 text-center">
                            <div className="inline-flex p-5 rounded-full bg-surface-50 mb-6">
                                <Lock className="w-10 h-10 text-surface-300" />
                            </div>
                            <h3 className="text-2xl font-bold text-surface-900 mb-3 tracking-tight">专属深度内容</h3>
                            <p className="text-surface-500 mb-8 max-w-xs mx-auto font-light">
                                本内容仅面向 <span className="font-bold text-surface-900">{tierConfig.label}</span> 及以上会员开放。
                            </p>
                            <button 
                                onClick={() => showToast({ severity: 'info', summary: '跳转订阅' })}
                                className="px-8 py-4 bg-primary-500 text-surface rounded-2xl font-bold shadow-lg shadow-primary-200 hover:bg-primary-600 transition-all active:scale-[0.98]"
                            >
                                立即解锁
                            </button>
                        </div>
                    )}
                </article>

            </div>
        </div>
    );
};

// 辅助组件：物理反馈按钮
const ActionButton = ({ icon, label, count, onClick, disabled }: any) => (
    <button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all active:scale-[0.9] group ${
            disabled
                ? 'text-surface-300 opacity-50 cursor-not-allowed'
                : 'text-surface-500 hover:bg-surface-50 hover:text-primary-500'
        }`}
    >
        {icon}
        {count !== undefined && <span className="text-xs font-bold tabular-nums text-surface-900">{count}</span>}
        <span className="text-xs font-bold sr-only md:not-sr-only">{label}</span>
    </button>
);

const ContentSkeleton = () => (
    <div className="min-h-screen bg-surface-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
            <Skeleton width="100px" height="32px" className="mb-12 rounded-full" />
            <Skeleton width="40%" height="20px" className="mb-4 rounded-lg" />
            <Skeleton width="100%" height="60px" className="mb-12 rounded-xl" />
            <div className="bg-surface rounded-[32px] p-12">
                <Skeleton width="100%" height="400px" className="rounded-2xl mb-8" />
                <Skeleton width="90%" height="24px" className="mb-4" />
                <Skeleton width="100%" height="24px" className="mb-4" />
                <Skeleton width="60%" height="24px" />
            </div>
        </div>
    </div>
);

export default ContentPage;