'use client';

import { Avatar } from 'primereact/avatar';
import { Image } from 'primereact/image';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';
import { VideoRefCard } from '@/components/chat/VideoRefCard';
import MarkdownIt from 'markdown-it';
import { useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { formatChatBubbleTime } from '@/lib/chatMessageTime';
import { Bot, CornerUpLeft, Reply } from 'lucide-react';
import { useMemo, useState } from 'react';

let DOMPurify: any;
if (typeof window !== 'undefined') {
    DOMPurify = require('dompurify').default || require('dompurify');
}

interface MessageItemProps {
    message: MessageItemType;
    highlighted?: boolean;
    onReply?: (message: MessageItemType) => void;
    onJumpToMessage?: (messageId: string) => void;
}

export function MessageItem({ message, highlighted, onReply, onJumpToMessage }: MessageItemProps) {
    const router = useRouter();
    const { showToast } = useToastContext();
    const [isChecking, setIsChecking] = useState(false);
    const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, typographer: true }), []);

    const formatTime = (dateStr: string) => formatChatBubbleTime(dateStr);

    const isBroadcastMessage = message.contentMetadata?.broadcast === true;
    const contentLink = message.contentMetadata?.contentLink;
    const isCoachAiAutoReply = message.contentMetadata?.coach_ai_auto_reply === true;
    const replyMeta = message.contentMetadata?.reply_to_message;

    const handleBroadcastClick = async () => {
        if (!contentLink || isChecking) return;

        const contentId = message.contentMetadata?.contentId;
        if (!contentId) {
            router.push(contentLink);
            return;
        }

        setIsChecking(true);

        try {
            const result = await coachService.getContentById({
                contentId: contentId.toString(),
                viewerId: undefined,
            });

            if (result && result.content) {
                router.push(contentLink);
            } else {
                showToast({
                    severity: 'error',
                    summary: '跳转失败',
                    detail: '该内容已被删除。',
                    life: 3000,
                });
            }
        } catch (error) {
            console.error('检查内容失败:', error);
            showToast({
                severity: 'error',
                summary: '跳转失败',
                detail: '该内容已被删除。',
                life: 3000,
            });
        } finally {
            setIsChecking(false);
        }
    };

    const renderReplyQuote = () => {
        if (!replyMeta) return null;

        const quoteClass = message.isMine
            ? 'border-primary-300 bg-primary-50/95 text-primary-950 shadow-sm'
            : 'border-surface-200 bg-surface-50 text-surface-700 shadow-sm';

        return (
            <button
                type="button"
                className={`mb-2 flex w-full appearance-none items-start gap-2 rounded-xl border-l-4 border-r-0 border-t-0 border-b-0 px-3 py-2 text-left transition hover:opacity-90 focus:outline-none ${quoteClass}`}
                onClick={() => onJumpToMessage?.(replyMeta.id)}
                title="定位到被回复的消息"
            >
                <CornerUpLeft size={14} strokeWidth={2.5} className="mt-0.5 shrink-0 opacity-80" />
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                            原消息
                        </span>
                        <span className="text-[11px] font-bold tracking-wide opacity-80">
                            回复 {replyMeta.senderName}
                        </span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs font-medium leading-5 opacity-95">
                        {replyMeta.contentPreview}
                    </div>
                </div>
            </button>
        );
    };

    const bubbleClass = message.isMine
        ? 'bg-primary-500 text-surface'
        : isCoachAiAutoReply
          ? 'border border-amber-100 bg-amber-50 text-surface-900'
          : 'bg-surface-100 text-surface-900';

    const renderContent = () => {
        switch (message.messageType) {
            case 'text':
                if (isBroadcastMessage && contentLink) {
                    return (
                        <div
                            className={`max-w-md rounded-xl px-4 py-3 transition-all ${
                                isChecking ? 'cursor-wait opacity-70' : 'cursor-pointer hover:shadow-lg'
                            } ${
                                message.isMine
                                    ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-surface hover:from-primary-600 hover:to-primary-700'
                                    : 'border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 text-surface-900 hover:shadow-amber-200/50 dark:border-amber-700 dark:from-amber-900/20 dark:to-orange-900/20 dark:text-surface-0'
                            }`}
                            onClick={handleBroadcastClick}
                        >
                            <div className="mb-2 flex items-center gap-2 border-b border-current/10 pb-2">
                                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                                    发布内容通知
                                </span>
                            </div>
                            <div
                                className="markdown-message-content break-words"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify?.sanitize(md.render(message.content || '')),
                                }}
                            />
                            <div className="mt-2 flex items-center justify-end gap-1 border-t border-current/10 pt-2 text-xs opacity-60 transition-opacity hover:opacity-100">
                                {isChecking ? (
                                    <>
                                        <span>检查中...</span>
                                        <i className="pi pi-spin pi-spinner" />
                                    </>
                                ) : (
                                    <>
                                        <span>点击查看详情</span>
                                        <i className="pi pi-arrow-right" />
                                    </>
                                )}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="max-w-md">
                        {isCoachAiAutoReply && (
                            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-100 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                <Bot size={12} strokeWidth={2.5} />
                                教练虚拟分身自动回复
                            </div>
                        )}
                        {renderReplyQuote()}
                        <div
                            className={`markdown-message-content break-words rounded-lg px-4 py-2 ${bubbleClass}`}
                            dangerouslySetInnerHTML={{
                                __html: DOMPurify?.sanitize(md.render(message.content || '')),
                            }}
                        />
                        {isCoachAiAutoReply && (
                            <div className="mt-1 px-2 text-[11px] text-surface-500">
                                这是 AI 根据教练设置生成的参考回复，重要事项请等待教练本人确认。
                            </div>
                        )}
                    </div>
                );

            case 'image':
                return (
                    <div className="max-w-md">
                        {renderReplyQuote()}
                        {message.mediaUrl ? (
                            <Image
                                src={message.mediaUrl}
                                alt="图片消息"
                                width="250"
                                preview
                                className="cursor-pointer rounded-lg"
                            />
                        ) : (
                            <div className={`rounded-lg px-4 py-2 ${bubbleClass}`}>图片加载失败</div>
                        )}
                        {message.content && message.content.trim() && message.content !== message.mediaUrl && (
                            <div className={`mt-2 rounded-lg px-4 py-2 ${bubbleClass}`}>{message.content}</div>
                        )}
                    </div>
                );

            case 'video':
                return (
                    <div className="max-w-md">
                        {renderReplyQuote()}
                        <video
                            src={message.mediaUrl || ''}
                            controls
                            className="max-w-full rounded-lg"
                            style={{ maxHeight: '400px' }}
                        />
                        {message.content && message.content !== message.mediaUrl && (
                            <div className={`mt-2 rounded-lg px-4 py-2 ${bubbleClass}`}>{message.content}</div>
                        )}
                    </div>
                );

            case 'voice':
                return (
                    <div className="max-w-md">
                        {renderReplyQuote()}
                        <div className={`flex items-center gap-2 rounded-lg px-4 py-2 ${bubbleClass}`}>
                            <audio src={message.mediaUrl || ''} controls className="max-w-xs" />
                            {message.duration && <span className="text-sm">{message.duration}s</span>}
                        </div>
                    </div>
                );

            case 'file':
                return (
                    <div className="max-w-md">
                        {renderReplyQuote()}
                        <a
                            href={message.mediaUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex max-w-md items-center gap-3 rounded-lg px-4 py-3 transition-colors ${
                                message.isMine
                                    ? 'bg-primary-500 text-surface hover:bg-primary-600'
                                    : 'bg-surface-100 text-surface-900 hover:bg-surface-200 dark:bg-surface-700 dark:text-surface-0 dark:hover:bg-surface-600'
                            }`}
                        >
                            <i className="pi pi-file text-2xl" />
                            <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">{message.fileName || '文件'}</div>
                                {message.fileSize && (
                                    <div className="text-xs opacity-80">
                                        {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                )}
                            </div>
                            <i className="pi pi-download" />
                        </a>
                    </div>
                );

            case 'video_reference': {
                const videoRefs = message.contentMetadata?.video_references;
                if (videoRefs && videoRefs.length > 0) {
                    return (
                        <div className="max-w-md">
                            {renderReplyQuote()}
                            <VideoRefCard videos={videoRefs} isMine={message.isMine} />
                        </div>
                    );
                }
                return (
                    <div className="max-w-md">
                        {renderReplyQuote()}
                        <div className={`rounded-lg px-4 py-2 ${bubbleClass}`}>{message.content}</div>
                    </div>
                );
            }

            default:
                return (
                    <div className="max-w-md">
                        {renderReplyQuote()}
                        <div className={`rounded-lg px-4 py-2 ${bubbleClass}`}>{message.content}</div>
                    </div>
                );
        }
    };

    return (
        <div
            data-message-id={message.id}
            className={`group mb-4 flex gap-3 ${message.isMine ? 'flex-row-reverse' : 'flex-row'} ${
                highlighted ? 'rounded-2xl ring-2 ring-primary-400 ring-offset-2 ring-offset-surface-0' : ''
            }`}
        >
            <Avatar
                image={message.chatUserProfile?.avatar || undefined}
                label={
                    !message.chatUserProfile?.avatar && message.chatUserProfile?.name
                        ? message.chatUserProfile.name.charAt(0)
                        : undefined
                }
                shape="circle"
                className="shrink-0 bg-primary-500 text-surface"
            />
            <div className={`flex flex-col gap-1 ${message.isMine ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-surface-500">
                        {message.chatUserProfile?.name}
                        {isCoachAiAutoReply ? ' · 虚拟分身' : ''}
                    </span>
                    {replyMeta ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-100 px-2 py-1 text-[11px] font-medium text-surface-600">
                            <CornerUpLeft size={11} strokeWidth={2.5} />
                            回复给 {replyMeta.senderName}
                        </span>
                    ) : null}
                    {onReply ? (
                        <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-surface-400 transition hover:bg-surface-100 hover:text-surface-700"
                            onClick={() => onReply(message)}
                            title="回复这条消息"
                        >
                            <Reply size={12} strokeWidth={2.5} />
                            回复
                        </button>
                    ) : null}
                </div>
                {renderContent()}
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-surface-500">{formatTime(message.createdAt)}</span>
                </div>
            </div>
        </div>
    );
}
