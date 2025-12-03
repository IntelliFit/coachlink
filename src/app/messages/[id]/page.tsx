'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card } from 'primereact/card';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { FileUpload } from 'primereact/fileupload';
import { MessageItem } from '@/components/chat/MessageItem';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import type { MessageItem as MessageItemType } from '@/app/api/chat/get-messages/entity';

export default function ChatPage() {
    const params = useParams();
    const router = useRouter();
    const { showToast } = useToastContext();
    const { data: session } = useSession();
    const isCoach = !!(session as any)?.user?.is_coach;
    const conversationId = params.id as string;
    
    const [messages, setMessages] = useState<MessageItemType[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatPartner, setChatPartner] = useState<{
        name: string;
        avatar: string | null;
    } | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const loadMessages = async () => {
        try {
            const data = await chatService.getMessages({
                conversation_id: conversationId,
                page: 1,
                limit: 50
            });
            
            if (data) {
                setMessages(data.messages);
                
                // 设置聊天对象信息
                if (data.messages.length > 0) {
                    const firstMessage = data.messages.find(m => !m.is_mine);
                    if (firstMessage) {
                        setChatPartner({
                            name: firstMessage.sender_name,
                            avatar: firstMessage.sender_avatar
                        });
                    } else {
                        // 若当前仅有自己的消息，回退到会话信息获取对方资料
                        try {
                            const convData = await chatService.getConversations({ page: 1, limit: 50 });
                            const conv = convData?.conversations.find(c => c.id === conversationId);
                            if (conv) {
                                setChatPartner({
                                    name: isCoach ? conv.student_name : conv.coach_name,
                                    avatar: isCoach ? conv.student_avatar : conv.coach_avatar
                                });
                            }
                        } catch {}
                    }
                }
                
                // 标记为已读
                await chatService.markAsRead({ conversation_id: conversationId });
                
                // 触发未读数更新事件
                window.dispatchEvent(new Event('chat-unread-update'));
                
                setTimeout(scrollToBottom, 100);
            }
        } catch (error: any) {
            console.error('加载消息失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '加载消息失败'
            });
        } finally {
            setLoading(false);
        }
    };

    const sendMessage = async () => {
        if (!messageText.trim()) {
            return;
        }

        setSending(true);
        try {
            const data = await chatService.sendMessage({
                conversation_id: conversationId,
                message_type: 'text',
                content: messageText.trim()
            });

            if (data) {
                setMessageText('');
                
                // 重新加载消息
                await loadMessages();
                
                // 触发新消息事件
                window.dispatchEvent(new Event('chat-new-message'));
                
                showToast({
                    severity: 'success',
                    summary: '成功',
                    detail: '消息发送成功'
                });
            } else {
                showToast({
                    severity: 'error',
                    summary: '错误',
                    detail: '消息发送失败'
                });
            }
        } catch (error: any) {
            console.error('发送消息失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: error?.message || '发送失败'
            });
        } finally {
            setSending(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    useEffect(() => {
        if (conversationId) {
            loadMessages();
            
            // 定时刷新消息（每10秒）
            const interval = setInterval(loadMessages, 10000);
            
            return () => clearInterval(interval);
        }
    }, [conversationId]);

    const renderHeader = () => {
        if (loading || !chatPartner) {
            return (
                <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
                    <Button
                        icon="pi pi-arrow-left"
                        text
                        onClick={() => router.back()}
                    />
                    <Skeleton shape="circle" size="2.5rem" />
                    <Skeleton width="8rem" height="1.5rem" />
                </div>
            );
        }

        return (
            <div className="flex items-center gap-3 p-4 border-b border-surface-200 dark:border-surface-700">
                <Button
                    icon="pi pi-arrow-left"
                    text
                    onClick={() => router.back()}
                    className="md:hidden"
                />
                <Avatar
                    image={chatPartner.avatar || undefined}
                    label={!chatPartner.avatar ? chatPartner.name.charAt(0) : undefined}
                    size="large"
                    shape="circle"
                    className="bg-primary-500 text-white"
                />
                <h2 className="text-xl font-semibold text-surface-900 dark:text-surface-0">
                    {chatPartner.name}
                </h2>
            </div>
        );
    };

    return (
        <div className="h-screen flex flex-col bg-surface-50 dark:bg-surface-900">
            {renderHeader()}

            <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto p-4 md:p-6"
                style={{ maxHeight: 'calc(100vh - 200px)' }}
            >
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                                <Skeleton shape="circle" size="2.5rem" />
                                <Skeleton width="60%" height="3rem" borderRadius="1rem" />
                            </div>
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-surface-500">
                        <i className="pi pi-comment text-5xl mb-4" />
                        <p className="text-lg">开始对话吧</p>
                    </div>
                ) : (
                    <>
                        {messages.map((message) => (
                            <MessageItem key={message.id} message={message} />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            <div className="border-t border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800">
                <div className="flex gap-2 items-end max-w-6xl mx-auto">
                    <Button
                        icon="pi pi-paperclip"
                        rounded
                        text
                        className="flex-shrink-0"
                        tooltip="发送文件"
                        tooltipOptions={{ position: 'top' }}
                    />
                    
                    <InputTextarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="输入消息... (Enter发送, Shift+Enter换行)"
                        rows={1}
                        autoResize
                        className="flex-1"
                        disabled={sending}
                    />
                    
                    <Button
                        icon="pi pi-send"
                        onClick={sendMessage}
                        loading={sending}
                        disabled={!messageText.trim()}
                        className="flex-shrink-0"
                    />
                </div>
            </div>
        </div>
    );
}

