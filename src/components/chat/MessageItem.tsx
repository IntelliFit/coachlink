'use client';

import { Avatar } from 'primereact/avatar';
import { Image } from 'primereact/image';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';
import { VideoRefCard } from '@/components/chat/VideoRefCard';
import MarkdownIt from 'markdown-it';
import { useRouter } from 'next/navigation';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
let DOMPurify: any;
if (typeof window !== 'undefined') {
    DOMPurify = require('dompurify').default || require('dompurify');
}
import { useMemo, useState } from 'react';

interface MessageItemProps {
    message: MessageItemType;
}

export function MessageItem({ message }: MessageItemProps) {
    const router = useRouter();
    const { showToast } = useToastContext();
    const [isChecking, setIsChecking] = useState(false);
    const md = useMemo(() => new MarkdownIt({ html: true, linkify: true, typographer: true }), []);

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };

    // 检测是否为广播消息
    const isBroadcastMessage = message.contentMetadata?.broadcast === true;
    const contentLink = message.contentMetadata?.contentLink;

    // 处理广播消息点击，先检查内容是否存在
    const handleBroadcastClick = async () => {
        if (!contentLink || isChecking) return;

        // 提取 contentId
        const contentId = message.contentMetadata?.contentId;
        if (!contentId) {
            router.push(contentLink);
            return;
        }

        setIsChecking(true);

        try {
            // 先检查内容是否存在
            const result = await coachService.getContentById({
                contentId: contentId.toString(),
                viewerId: undefined // 只是检查存在性，不需要 viewerId
            });

            if (result && result.content) {
                // 内容存在，跳转
                router.push(contentLink);
            } else {
                // 内容不存在，显示提示
                showToast({
                    severity: 'error',
                    summary: '跳转失败',
                    detail: '该内容已被删除！',
                    life: 3000
                });
            }
        } catch (error) {
            console.error('检查内容失败:', error);
            // 出错时也显示提示
            showToast({
                severity: 'error',
                summary: '跳转失败',
                detail: '该内容已被删除！',
                life: 3000
            });
        } finally {
            setIsChecking(false);
        }
    };

    const renderContent = () => {
        switch (message.messageType) {
            case 'text':
                // 广播消息特殊处理
                if (isBroadcastMessage && contentLink) {
                    return (
                        <div
                            className={`px-4 py-3 rounded-xl max-w-md transition-all ${
                                isChecking 
                                    ? 'cursor-wait opacity-70'
                                    : 'cursor-pointer hover:shadow-lg'
                            } ${
                                message.isMine
                                    ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-surface hover:from-primary-600 hover:to-primary-700'
                                    : 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 text-surface-900 dark:text-surface-0 border border-amber-200 dark:border-amber-700 hover:shadow-amber-200/50'
                            }`}
                            onClick={handleBroadcastClick}
                        >
                            {/* 内容通知标签 */}
                            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-current/10">
                                <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                                    发布内容通知
                                </span>
                            </div>
                            
                            {/* 消息内容 */}
                            <div
                                className="break-words markdown-message-content"
                                dangerouslySetInnerHTML={{
                                    __html: DOMPurify?.sanitize(md.render(message.content || '')),
                                }}
                            />
                            
                            {/* 点击提示 */}
                            <div className="mt-2 pt-2 border-t border-current/10 flex items-center justify-end gap-1 text-xs opacity-60 hover:opacity-100 transition-opacity">
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
                
                // 普通文本消息
                return (
                    <div
                        className={`px-4 py-2 rounded-lg max-w-md break-words markdown-message-content ${
                            message.isMine
                                ? 'bg-primary-500 text-surface'
                                : 'bg-surface-100 text-surface-900'
                        }`}
                        dangerouslySetInnerHTML={{
                            __html: DOMPurify?.sanitize(md.render(message.content || '')),
                        }}
                    />
                );

            case 'image':
                return (
                    <div className="max-w-md">
                        {message.mediaUrl ? (
                            <Image 
                                src={message.mediaUrl} 
                                alt="图片消息" 
                                width="250"
                                preview
                                className="rounded-lg cursor-pointer"
                            />
                        ) : (
                            <div className={`px-4 py-2 rounded-lg ${
                                message.isMine
                                    ? 'bg-primary-500 text-surface'
                                    : 'bg-surface-100 text-surface-900'
                            }`}>
                                图片加载失败
                            </div>
                        )}
                        {message.content && message.content.trim() && message.content !== message.mediaUrl && (
                            <div className={`mt-2 px-4 py-2 rounded-lg ${
                                message.isMine
                                    ? 'bg-primary-500 text-surface'
                                    : 'bg-surface-100 text-surface-900'
                            }`}>
                                {message.content}
                            </div>
                        )}
                    </div>
                );

            case 'video':
                return (
                    <div className="max-w-md">
                        <video 
                            src={message.mediaUrl || ''} 
                            controls 
                            className="rounded-lg max-w-full"
                            style={{ maxHeight: '400px' }}
                        />
                        {message.content && message.content !== message.mediaUrl && (
                            <div className={`mt-2 px-4 py-2 rounded-lg ${
                                message.isMine
                                    ? 'bg-primary-500 text-surface'
                                    : 'bg-surface-100 text-surface-900'
                            }`}>
                                {message.content}
                            </div>
                        )}
                    </div>
                );

            case 'voice':
                return (
                    <div className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                        message.isMine
                            ? 'bg-primary-500 text-surface'
                            : 'bg-surface-100 text-surface-900'
                    }`}>
                        <audio src={message.mediaUrl || ''} controls className="max-w-xs" />
                        {message.duration && <span className="text-sm">{message.duration}s</span>}
                    </div>
                );

            case 'file':
                return (
                    <a 
                        href={message.mediaUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-4 py-3 rounded-lg flex items-center gap-3 max-w-md ${
                            message.isMine
                                ? 'bg-primary-500 text-surface hover:bg-primary-600'
                                : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0 hover:bg-surface-200 dark:hover:bg-surface-600'
                        } transition-colors`}
                    >
                        <i className="pi pi-file text-2xl" />
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{message.fileName || '文件'}</div>
                            {message.fileSize && (
                                <div className="text-xs opacity-80">
                                    {(message.fileSize / 1024 / 1024).toFixed(2)} MB
                                </div>
                            )}
                        </div>
                        <i className="pi pi-download" />
                    </a>
                );

            case 'video_reference':
                // 渲染视频引用卡片
                const videoRefs = message.contentMetadata?.video_references;
                if (videoRefs && videoRefs.length > 0) {
                    return <VideoRefCard videos={videoRefs} isMine={message.isMine} />;
                }
                // 如果没有视频引用数据，fallback 到默认显示
                return (
                    <div className={`px-4 py-2 rounded-lg ${
                        message.isMine
                            ? 'bg-primary-500 text-surface'
                            : 'bg-surface-100 text-surface-900'
                    }`}>
                        {message.content}
                    </div>
                );

            default:
                return (
                    <div className={`px-4 py-2 rounded-lg ${
                        message.isMine
                            ? 'bg-primary-500 text-surface'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
                    }`}>
                        {message.content}
                    </div>
                );
        }
    };

    return (
        <div className={`flex gap-3 mb-4 ${message.isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            <Avatar
                image={message.chatUserProfile?.avatar || undefined}
                label={!message.chatUserProfile?.avatar && message.chatUserProfile?.name ? message.chatUserProfile.name.charAt(0) : undefined}
                shape="circle"
                className="bg-primary-500 text-surface flex-shrink-0"
            />
            <div className={`flex flex-col gap-1 ${message.isMine ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-surface-500 px-2">{message.chatUserProfile?.name}</span>
                {renderContent()}
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-surface-500">
                        {formatTime(message.createdAt)}
                    </span>
                    {/* {message.isMine && (
                        <span className="text-xs text-surface-500">
                            {message.isRead ? '已读' : '未读'}
                        </span>
                    )} */}
                </div>
            </div>
        </div>
    );
}


