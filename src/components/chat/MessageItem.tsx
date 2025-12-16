'use client';

import { Avatar } from 'primereact/avatar';
import { Image } from 'primereact/image';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';

interface MessageItemProps {
    message: MessageItemType;
}

export function MessageItem({ message }: MessageItemProps) {
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    };

    const renderContent = () => {
        switch (message.messageType) {
            case 'text':
                return (
                    <div className={`px-4 py-2 rounded-lg max-w-md break-words ${
                        message.isMine
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
                    }`}>
                        {message.content}
                    </div>
                );

            case 'image':
                return (
                    <div className="max-w-md">
                        <Image 
                            src={message.mediaUrl || ''} 
                            alt="图片消息" 
                            width="250"
                            preview
                            className="rounded-lg"
                        />
                        {message.content && message.content !== message.mediaUrl && (
                            <div className={`mt-2 px-4 py-2 rounded-lg ${
                                message.isMine
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
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
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
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
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
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
                                ? 'bg-primary-500 text-white hover:bg-primary-600'
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

            default:
                return (
                    <div className={`px-4 py-2 rounded-lg ${
                        message.isMine
                            ? 'bg-primary-500 text-white'
                            : 'bg-surface-100 dark:bg-surface-700 text-surface-900 dark:text-surface-0'
                    }`}>
                        {message.content}
                    </div>
                );
        }
    };

    return (
        <div className={`flex gap-3 mb-4 ${message.isMine ? 'flex-row-reverse' : 'flex-row'}`}>
            {!message.isMine && (
                <Avatar
                    image={message.chatUserProfile?.avatar || undefined}
                    label={!message.chatUserProfile?.avatar && message.chatUserProfile?.name ? message.chatUserProfile.name.charAt(0) : undefined}
                    shape="circle"
                    className="bg-primary-500 text-white flex-shrink-0"
                />
            )}
            
            <div className={`flex flex-col gap-1 ${message.isMine ? 'items-end' : 'items-start'}`}>
                {!message.isMine && (
                    <span className="text-xs text-surface-500 px-2">{message.chatUserProfile?.name}</span>
                )}
                {renderContent()}
                <div className="flex items-center gap-2 px-2">
                    <span className="text-xs text-surface-500">
                        {formatTime(message.createdAt)}
                    </span>
                    {message.isMine && (
                        <span className="text-xs text-surface-500">
                            {message.isRead ? '已读' : '未读'}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}


