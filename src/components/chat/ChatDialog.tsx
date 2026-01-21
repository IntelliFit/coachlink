'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { MessageItem } from '@/components/chat/MessageItem';
import { VideoRefPicker } from '@/components/chat/VideoRefPicker';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity';
import { userService } from '@/app/service/userService';
import type { UserProfilesRow } from '@/types';
import { CoachLinkTable } from '@/types';
import { Send, AtSign, MessageSquareOff, Loader2 } from 'lucide-react';

interface ChatDialogProps {
    visible: boolean;
    onHide: () => void;
    chatroom: ChatroomDetail | null;
    onMarkSuccess?: (roomId: string) => void;
}

const ChatDialog: React.FC<ChatDialogProps> = ({ visible, onHide, chatroom, onMarkSuccess }) => {
    const { data: session } = useSession() as any;
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<MessageItemType[]>([]);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatPartner, setChatPartner] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
    const [showVideoPicker, setShowVideoPicker] = useState(false);
    const [profile, setProfile] = useState<UserProfilesRow | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);
    const userMap = useRef<Record<string, { name: string; avatar: string | null }>>({});

    // 获取当前用户档案
    useEffect(() => {
        if (!session?.user?.id) {
            setProfile(null);
            return;
        }
        const loadProfile = async () => {
            try {
                const res = await userService.getProfile({});
                if (res?.profile) {
                    setProfile(res.profile);
                }
            } catch (error) {
                console.error('获取用户档案失败:', error);
            }
        };
        loadProfile();
    }, [session?.user?.id]);

    // 1. 加载用户 Profile
    useEffect(() => {
        if (!visible || !chatroom || !session?.user?.id) return;
        
        const loadUserProfiles = async () => {
            for (const id of chatroom.members) {
                if (id === session.user.id) {
                    // 使用从 API 获取的 profile
                    userMap.current[id] = { name: profile?.nickname || '我', avatar: profile?.avatar_url || null };
                } else if (!userMap.current[id]) {
                    const res = await userService.getProfile({ userId: id });
                    if (res) {
                        userMap.current[id] = { name: res.profile.nickname, avatar: res.profile.avatar_url };
                        setChatPartner({ id, name: res.profile.nickname, avatar: res.profile.avatar_url });
                    }
                }
            }
        };
        loadUserProfiles();
    }, [visible, chatroom, session, profile]);

    // 2. 加载历史消息
    useEffect(() => {
        if (!visible || !chatroom?.id) return;
        const fetchChat = async () => {
            setLoading(true);
            try {
                const messagesRes = await chatService.listMessages({ roomId: chatroom.id, page: 1, limit: 50 });
                if (messagesRes) setMessages(messagesRes.messages);
                const markRes = await chatService.markAsRead({ roomId: chatroom.id });
                if (markRes && onMarkSuccess) onMarkSuccess(chatroom.id);
            } finally {
                setTimeout(() => setLoading(false), 300);
            }
        };
        fetchChat();
    }, [visible, chatroom?.id]);

    // 3. SSE 实时监听
    useEffect(() => {
        if (!visible || !chatroom?.id || !session?.user?.id) return;
        if (eventSourceRef.current) eventSourceRef.current.close();
        const es = new EventSource(`/api/chat/receive-stream?roomId=${chatroom.id}`);
        eventSourceRef.current = es;
        es.onmessage = (event) => {
            try {
                const newMessage = JSON.parse(event.data);
                if (newMessage.sender_id === session.user.id) return;
                const profile = userMap.current[newMessage.sender_id] || { name: 'User', avatar: null };
                const incoming: MessageItemType = {
                    id: newMessage.id,
                    chatUserId: newMessage.sender_id,
                    chatUserProfile: { name: profile.name, avatar: profile.avatar },
                    messageType: newMessage.message_type,
                    content: newMessage.content,
                    isMine: false,
                    createdAt: newMessage.created_at,
                    isRead: true,
                    mediaUrl: newMessage.media_url, fileName: null, fileSize: null, duration: null,
                    contentMetadata: newMessage.content_metadata || null
                };
                setMessages(prev => [...prev, incoming]);
            } catch (e) { console.error(e); }
        };
        return () => { es.close(); eventSourceRef.current = null; };
    }, [visible, chatroom?.id, session?.user?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const sendMessage = async () => {
        if (sending || !messageText.trim() || !chatroom) return;
        const content = messageText.trim();
        setSending(true);
        setMessageText('');

        const optimisticMsg: MessageItemType = {
            id: Date.now().toString(),
            chatUserId: session.user.id,
            chatUserProfile: { name: profile?.nickname || '我', avatar: profile?.avatar_url || null },
            messageType: 'text',
            content,
            isMine: true,
            createdAt: new Date().toISOString(),
            isRead: false,
            mediaUrl: null, fileName: null, fileSize: null, duration: null
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const res = await chatService.sendMessage({ roomId: chatroom.id, messageType: 'text', content });
        if (!res) {
            showToast({ severity: 'error', summary: '发送失败' });
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
            setMessageText(content);
        }
        setSending(false);
    };

    // 发送视频引用
    const sendVideoReferences = async (videos: VideoReferenceItem[]) => {
        if (sending || !chatroom || videos.length === 0) return;
        setSending(true);

        const count = videos.length;
        const content = count === 1
            ? `[视频] ${videos[0].actionName}`
            : `[${count}个视频]`;

        const optimisticMsg: MessageItemType = {
            id: Date.now().toString(),
            chatUserId: session.user.id,
            chatUserProfile: { name: profile?.nickname || '我', avatar: profile?.avatar_url || null },
            messageType: 'video_reference',
            content,
            isMine: true,
            createdAt: new Date().toISOString(),
            isRead: false,
            mediaUrl: null, fileName: null, fileSize: null, duration: null,
            contentMetadata: { video_references: videos }
        };
        setMessages(prev => [...prev, optimisticMsg]);

        const res = await chatService.sendMessage({
            roomId: chatroom.id,
            messageType: 'video_reference',
            content: '',
            videoReferences: videos
        });

        if (!res) {
            showToast({ severity: 'error', summary: '发送失败' });
            setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id));
        }
        setSending(false);
    };

    const renderHeader = () => {
        if (!chatPartner) return <div className="flex gap-3 items-center px-2"><Skeleton shape="circle" size="2.5rem" /><Skeleton width="6rem" height="1.2rem" /></div>;
        return (
            <div className="flex items-center gap-3 px-2">
                <Avatar image={chatPartner.avatar || undefined} label={chatPartner.avatar ? undefined : chatPartner.name?.charAt(0)} shape="circle" className="bg-primary-500 text-surface font-bold" />
                <div className="flex flex-col">
                    <span className="text-base font-black text-surface-900 tracking-tight leading-tight">{chatPartner.name}</span>
                    <div className="flex items-center gap-1.5">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                        <span className="text-[10px] font-black text-emerald-500 tracking-[0.1em]">ONLINE</span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <>
            <Dialog
                header={renderHeader()}
                visible={visible}
                onHide={onHide}
                modal
                draggable={false}
                resizable={false}
                style={{ width: '95vw', maxWidth: '750px' }}
                className="chat-dialog-container border-none shadow-2xl rounded-3xl overflow-hidden"
                contentClassName="p-0 flex flex-col bg-surface-0"
                pt={{
                    header: { className: 'py-4 px-6 border-b border-surface-100 bg-surface-0/80 backdrop-blur-md' },
                    closeButton: { className: 'hover:bg-surface-100 rounded-full transition-all' },
                    content: { className: 'flex flex-col' }
                }}
            >
                {/* 消息区域 - 维持 500px 固定高度 */}
                <div className="relative flex-1 bg-surface-50/30 px-4 py-6 md:px-8 overflow-y-auto min-h-[500px] max-h-[500px] h-[500px]">
                    {loading ? (
                        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-surface-0/60 backdrop-blur-sm transition-all duration-300">
                            <div className="relative">
                                <Loader2 className="w-10 h-10 text-primary-500 animate-spin" strokeWidth={3} />
                                <div className="absolute inset-0 w-10 h-10 border-4 border-primary-100 rounded-full"></div>
                            </div>
                            <p className="mt-4 text-[10px] font-black text-surface-400 uppercase tracking-[0.2em] animate-pulse">
                                正在加载消息
                            </p>
                        </div>
                    ) : messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-surface-400 opacity-60 min-h-[450px] max-h-[450px]">
                            <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-4">
                                <MessageSquareOff size={32} strokeWidth={1.5} className="text-surface-300" />
                            </div>
                            <p className="text-sm font-bold tracking-tight">没有对话内容</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {messages.map((message) => (
                                <MessageItem key={message.id} message={message} />
                            ))}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* 输入区域 */}
                <div className="p-4 md:p-6 bg-surface-0 border-t border-surface-100">
                    <div className="flex items-end gap-2 bg-surface-50 p-2 rounded-[1.5rem] border border-surface-100 focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-500/5 transition-all">
                        <button
                            className="p-2.5 text-surface-400 hover:text-primary-500 transition-colors"
                            onClick={() => setShowVideoPicker(true)}
                            disabled={sending}
                            title="引用视频"
                        >
                            <AtSign size={20} />
                        </button>

                        <InputTextarea
                            value={messageText}
                            onChange={(e) => setMessageText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                            placeholder="输入消息..."
                            rows={1}
                            autoResize
                            className="flex-1 border-none shadow-none bg-transparent text-surface-700 py-2 px-1 focus:shadow-none min-h-[40px] max-h-24"
                            style={{ resize: 'none' }}
                            disabled={sending}
                        />

                        <Button
                            onClick={sendMessage}
                            disabled={!messageText.trim() || sending}
                            // 移除 Primereact 默认样式，完全自定义 Aero 物理动效
                            className={`
                                relative w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center 
                                transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] border-none
                                ${messageText.trim() && !sending
                                                            ? 'bg-primary-500 text-surface shadow-[0_8px_24px_rgba(var(--primary-rgb),0.35)] scale-100 hover:scale-110 active:scale-90'
                                                            : 'bg-surface-100 text-surface-300 scale-95 cursor-not-allowed'
                                                        }
                            `}
                        >
                            {sending ? (
                                <Loader2 size={18} className="animate-spin text-surface" />
                            ) : (
                                <div className={`transition-all duration-500 ${messageText.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`}>
                                    <Send
                                        size={18}
                                        strokeWidth={3}
                                        className={`transition-transform duration-500 ${messageText.trim() ? 'rotate-[-12deg] scale-110' : 'rotate-0 scale-100'
                                            }`}
                                    />
                                </div>
                            )}

                            {/* 呼吸感氛围灯：仅在可发送时，背景产生极其微弱的脉冲感 */}
                            {messageText.trim() && !sending && (
                                <span className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-20 pointer-events-none" />
                            )}
                        </Button>
                    </div>
                </div>
            </Dialog>

            {/* 视频选择器弹窗 
                - 教练：引用当前聊天对象（学员）的视频
                - 学员：引用自己的视频
            */}
            {(chatPartner || session?.user?.id) && (
                <VideoRefPicker
                    visible={showVideoPicker}
                    onHide={() => setShowVideoPicker(false)}
                    studentId={
                        // 如果当前用户是教练，查看聊天对象（学员）的视频
                        // 如果当前用户是学员，查看自己的视频
                        session?.user?.is_coach ? undefined : session?.user?.id
                    }
                    onSelect={sendVideoReferences}
                />
            )}
        </>
    );
};

export default ChatDialog;
