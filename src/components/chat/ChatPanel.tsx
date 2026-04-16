'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { ChatMessageList } from '@/components/chat/ChatMessageList';
import { ChatHistorySearchDialog } from '@/components/chat/ChatHistorySearchDialog';
import { VideoRefPicker } from '@/components/chat/VideoRefPicker';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';
import type { VideoReferenceItem } from '@/app/api/chat/send-message/entity';
import { userService } from '@/app/service/userService';
import type { UserProfilesRow } from '@/types';
import { Send, AtSign, MessageSquareOff, Loader2, Image as ImageIcon, ChevronLeft, Search } from 'lucide-react';
import { useChatContext } from '@/context/ChatContext';

const INITIAL_MESSAGE_LIMIT = 10;
const LOAD_MORE_MESSAGE_LIMIT = 30;

export interface ChatPanelProps {
    chatroom: ChatroomDetail | null;
    onMarkSuccess?: (roomId: string) => void;
    variant: 'modal' | 'inline';
    /** Load messages + SSE when true */
    active: boolean;
    /** modal: Dialog visibility */
    dialogVisible?: boolean;
    onHide?: () => void;
    /** inline: mobile back */
    onRequestClose?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    chatroom,
    onMarkSuccess,
    variant,
    active,
    dialogVisible = false,
    onHide,
    onRequestClose,
}) => {
    const { data: session } = useSession() as any;
    const { showToast } = useToastContext();
    const { setCurrentOpenRoomId, subscribeToMessages, markRoomAsRead } = useChatContext();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<MessageItemType[]>([]);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatPartner, setChatPartner] = useState<{ id: string; name: string; avatar: string | null } | null>(null);
    const [showVideoPicker, setShowVideoPicker] = useState(false);
    const [profile, setProfile] = useState<UserProfilesRow | null>(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const userMap = useRef<Record<string, { name: string; avatar: string | null }>>({});
    const fileInputRef = useRef<HTMLInputElement>(null);
    const loadingMoreRef = useRef(false);
    const shouldScrollToBottomRef = useRef(true);
    const [searchOpen, setSearchOpen] = useState(false);
    const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);

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

    useEffect(() => {
        if (!active || !chatroom || !session?.user?.id) return;

        const loadUserProfiles = async () => {
            for (const id of chatroom.members) {
                if (id === session.user.id) {
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
    }, [active, chatroom, session, profile]);

    useEffect(() => {
        if (!active || !chatroom?.id) return;
        const fetchChat = async () => {
            setLoading(true);
            setMessages([]);
            setHasMore(false);
            shouldScrollToBottomRef.current = true;
            setHighlightMessageId(null);
            try {
                const messagesRes = await chatService.listMessages({
                    roomId: chatroom.id,
                    limit: INITIAL_MESSAGE_LIMIT,
                });
                if (messagesRes) {
                    setMessages(messagesRes.messages);
                    setHasMore(messagesRes.has_more);
                }
                const markRes = await chatService.markAsRead({ roomId: chatroom.id });
                if (markRes) {
                    markRoomAsRead(chatroom.id);
                    if (onMarkSuccess) onMarkSuccess(chatroom.id);
                }
            } finally {
                setLoading(false);
            }
        };
        fetchChat();
    }, [active, chatroom?.id]);

    useEffect(() => {
        if (!active || !chatroom?.id || !session?.user?.id) {
            setCurrentOpenRoomId(null);
            return;
        }

        setCurrentOpenRoomId(chatroom.id);

        const unsubscribe = subscribeToMessages((newMessage) => {
            if (newMessage.room_id !== chatroom.id) return;
            if (newMessage.sender_id === session.user.id) return;

            const p = userMap.current[newMessage.sender_id] || { name: 'User', avatar: null };
            const incoming: MessageItemType = {
                id: newMessage.id,
                chatUserId: newMessage.sender_id,
                chatUserProfile: { name: p.name, avatar: p.avatar },
                messageType: newMessage.message_type,
                content: newMessage.content || '',
                isMine: false,
                createdAt: newMessage.created_at,
                isRead: true,
                mediaUrl: newMessage.media_url || null,
                fileName: newMessage.file_name || null,
                fileSize: newMessage.file_size || null,
                duration: newMessage.duration || null,
                contentMetadata: newMessage.content_metadata || null,
            };
            setMessages((prev) => [...prev, incoming]);
            shouldScrollToBottomRef.current = true;
        });

        return () => {
            setCurrentOpenRoomId(null);
            unsubscribe();
        };
    }, [active, chatroom?.id, session?.user?.id, setCurrentOpenRoomId, subscribeToMessages]);

    /** 锚在列表底部＝最新一条消息；与「向上滑加载更早」并存（has_more + loadMore） */
    useLayoutEffect(() => {
        if (loading || messages.length === 0) return;
        if (!shouldScrollToBottomRef.current) return;
        const container = messagesContainerRef.current;
        if (!container) return;
        const snap = () => {
            container.scrollTop = container.scrollHeight;
            messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
        };
        snap();
        requestAnimationFrame(snap);
    }, [messages, loading]);

    useLayoutEffect(() => {
        if (!highlightMessageId || loading) return;
        const id = highlightMessageId;
        const el = document.querySelector(`[data-message-id="${id}"]`);
        if (el) {
            (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
        const t = window.setTimeout(() => setHighlightMessageId(null), 2400);
        return () => window.clearTimeout(t);
    }, [highlightMessageId, loading]);

    const loadMoreMessages = useCallback(async () => {
        if (!chatroom?.id || loadingMoreRef.current || !hasMore || messages.length === 0) return;
        const oldestMessage = messages[0];
        if (!oldestMessage) return;

        loadingMoreRef.current = true;
        setLoadingMore(true);

        const container = messagesContainerRef.current;
        const scrollHeightBefore = container?.scrollHeight ?? 0;
        const scrollTopBefore = container?.scrollTop ?? 0;

        try {
            const messagesRes = await chatService.listMessages({
                roomId: chatroom.id,
                limit: LOAD_MORE_MESSAGE_LIMIT,
                beforeId: oldestMessage.id,
            });

            if (messagesRes && messagesRes.messages.length > 0) {
                setMessages((prev) => [...messagesRes.messages, ...prev]);
                setHasMore(messagesRes.has_more);

                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        const el = messagesContainerRef.current;
                        if (el) {
                            const scrollHeightAfter = el.scrollHeight;
                            const added = scrollHeightAfter - scrollHeightBefore;
                            el.scrollTop = scrollTopBefore + added;
                        }
                        setLoadingMore(false);
                        loadingMoreRef.current = false;
                    });
                });
            } else {
                setHasMore(false);
                setLoadingMore(false);
                loadingMoreRef.current = false;
            }
        } catch (error) {
            console.error('加载更多消息失败:', error);
            showToast({ severity: 'error', summary: '加载失败，请稍后重试' });
            setLoadingMore(false);
            loadingMoreRef.current = false;
        }
    }, [chatroom?.id, hasMore, messages, showToast]);

    useEffect(() => {
        const container = messagesContainerRef.current;
        if (!container || !hasMore || loading) return;

        const handleScroll = () => {
            if (loadingMoreRef.current || !hasMore) return;

            const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            shouldScrollToBottomRef.current = isNearBottom;

            if (container.scrollTop <= 160) {
                loadMoreMessages();
            }
        };

        container.addEventListener('scroll', handleScroll, { passive: true });
        return () => container.removeEventListener('scroll', handleScroll);
    }, [hasMore, loading, loadMoreMessages]);

    /** 首屏内容高度不足一屏时，scroll 事件几乎不会触发，需自动拉更早消息直到可滚动或没有更多 */
    useEffect(() => {
        if (!hasMore || loading || loadingMore) return;
        const container = messagesContainerRef.current;
        if (!container || messages.length === 0) return;

        const fillIfShort = () => {
            if (loadingMoreRef.current) return;
            const el = messagesContainerRef.current;
            if (!el || !hasMore) return;
            if (el.scrollHeight <= el.clientHeight + 12) {
                void loadMoreMessages();
            }
        };

        const id = requestAnimationFrame(() => requestAnimationFrame(fillIfShort));
        return () => cancelAnimationFrame(id);
    }, [messages, hasMore, loading, loadingMore, loadMoreMessages]);

    const jumpToMessageFromSearch = useCallback(
        async (messageId: string) => {
            if (!chatroom?.id) return;
            shouldScrollToBottomRef.current = false;
            setHighlightMessageId(null);
            try {
                const res = await chatService.listMessages({
                    roomId: chatroom.id,
                    anchorMessageId: messageId,
                });
                if (res) {
                    setMessages(res.messages);
                    setHasMore(res.has_more);
                    setHighlightMessageId(messageId);
                }
            } catch (e) {
                console.error(e);
            }
        },
        [chatroom?.id],
    );

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
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            duration: null,
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        shouldScrollToBottomRef.current = true;

        const res = await chatService.sendMessage({ roomId: chatroom.id, messageType: 'text', content });
        if (!res) {
            showToast({ severity: 'error', summary: '发送失败' });
            setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
            setMessageText(content);
        }
        setSending(false);
    };

    const handleImageUpload = async (file: File) => {
        if (!chatroom || sending || uploadingImage) return;

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showToast({ severity: 'error', summary: '仅支持 PNG/JPEG/WEBP/GIF 格式的图片' });
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast({ severity: 'error', summary: '图片大小不能超过 10MB' });
            return;
        }

        setUploadingImage(true);

        try {
            const formData = new FormData();
            formData.append('file', file);

            const uploadRes = await fetch('/api/upload/chat-image', {
                method: 'POST',
                body: formData,
            });

            const uploadData = await uploadRes.json();

            if (!uploadData.success || !uploadData.data?.url) {
                showToast({ severity: 'error', summary: uploadData.message || '上传失败' });
                setUploadingImage(false);
                return;
            }

            const imageUrl = uploadData.data.url;

            const optimisticMsg: MessageItemType = {
                id: Date.now().toString(),
                chatUserId: session.user.id,
                chatUserProfile: { name: profile?.nickname || '我', avatar: profile?.avatar_url || null },
                messageType: 'image',
                content: '',
                isMine: true,
                createdAt: new Date().toISOString(),
                isRead: false,
                mediaUrl: imageUrl,
                fileName: file.name,
                fileSize: file.size,
                duration: null,
            };
            setMessages((prev) => [...prev, optimisticMsg]);
            shouldScrollToBottomRef.current = true;

            const res = await chatService.sendMessage({
                roomId: chatroom.id,
                messageType: 'image',
                content: '',
                mediaUrl: imageUrl,
                fileName: file.name,
                fileSize: file.size,
            });

            if (!res) {
                showToast({ severity: 'error', summary: '发送失败' });
                setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
            }
        } catch (error) {
            console.error('上传图像失败:', error);
            showToast({ severity: 'error', summary: '上传失败，请稍后重试' });
        } finally {
            setUploadingImage(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const sendVideoReferences = async (videos: VideoReferenceItem[]) => {
        if (sending || !chatroom || videos.length === 0) return;
        setSending(true);

        const count = videos.length;
        const content = count === 1 ? `[视频] ${videos[0].actionName}` : `[${count}个视频]`;

        const optimisticMsg: MessageItemType = {
            id: Date.now().toString(),
            chatUserId: session.user.id,
            chatUserProfile: { name: profile?.nickname || '我', avatar: profile?.avatar_url || null },
            messageType: 'video_reference',
            content,
            isMine: true,
            createdAt: new Date().toISOString(),
            isRead: false,
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            duration: null,
            contentMetadata: { video_references: videos },
        };
        setMessages((prev) => [...prev, optimisticMsg]);
        shouldScrollToBottomRef.current = true;

        const res = await chatService.sendMessage({
            roomId: chatroom.id,
            messageType: 'video_reference',
            content: '',
            videoReferences: videos,
        });

        if (!res) {
            showToast({ severity: 'error', summary: '发送失败' });
            setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
        }
        setSending(false);
    };

    const renderHeader = () => {
        if (!chatPartner)
            return (
                <div className="flex gap-3 items-center px-2">
                    <Skeleton shape="circle" size="2.5rem" />
                    <Skeleton width="6rem" height="1.2rem" />
                </div>
            );
        return (
            <div className="flex items-center gap-3 px-2 min-w-0 flex-1">
                <Avatar
                    image={chatPartner.avatar || undefined}
                    label={chatPartner.avatar ? undefined : chatPartner.name?.charAt(0)}
                    shape="circle"
                    className="bg-primary-500 text-surface font-bold shrink-0"
                />
                <div className="flex flex-col min-w-0">
                    <span className="text-base font-black text-surface-900 tracking-tight leading-tight truncate">
                        {chatPartner.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                        <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <span className="text-[10px] font-black text-emerald-500 tracking-[0.1em]">ONLINE</span>
                    </div>
                </div>
            </div>
        );
    };

    const scrollAreaClass =
        variant === 'modal'
            ? 'relative flex-1 bg-surface-50/30 px-4 py-6 md:px-8 overflow-y-auto min-h-[500px] max-h-[500px] h-[500px]'
            : 'relative flex-1 min-h-0 bg-surface-50/30 px-4 py-4 md:px-6 overflow-y-auto';

    const messagesBlock = (
        <>
            <div ref={messagesContainerRef} className={scrollAreaClass}>
                {loading && messages.length === 0 ? (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-surface-0/60 backdrop-blur-sm transition-all duration-300">
                        <div className="relative">
                            <Loader2 className="w-10 h-10 text-primary-500 animate-spin" strokeWidth={3} />
                            <div className="absolute inset-0 w-10 h-10 border-4 border-primary-100 rounded-full" />
                        </div>
                        <p className="mt-4 text-[10px] font-black text-surface-400 uppercase tracking-[0.2em] animate-pulse">
                            正在加载消息
                        </p>
                    </div>
                ) : messages.length === 0 ? (
                    <div
                        className={`flex flex-col items-center justify-center h-full text-surface-400 opacity-60 ${
                            variant === 'modal' ? 'min-h-[450px] max-h-[450px]' : 'min-h-[200px]'
                        }`}
                    >
                        <div className="w-16 h-16 bg-surface-100 rounded-full flex items-center justify-center mb-4">
                            <MessageSquareOff size={32} strokeWidth={1.5} className="text-surface-300" />
                        </div>
                        <p className="text-sm font-bold tracking-tight">没有对话内容</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {loadingMore && (
                            <div className="flex items-center justify-center py-2">
                                <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
                                <span className="ml-2 text-xs text-surface-500">加载更多消息...</span>
                            </div>
                        )}
                        <ChatMessageList messages={messages} highlightMessageId={highlightMessageId} />
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            <div className="p-4 md:p-6 border-t border-surface-100 shrink-0">
                <div className="flex items-end gap-2 bg-surface-50 p-2 rounded-[1.5rem] border border-surface-100 focus-within:border-primary-300 focus-within:ring-4 focus-within:ring-primary-500/5 transition-all">
                    <button
                        className="p-2.5 text-surface-400 hover:text-primary-500 transition-colors"
                        onClick={() => setShowVideoPicker(true)}
                        disabled={sending || uploadingImage}
                        title="引用视频"
                        type="button"
                    >
                        <AtSign size={20} />
                    </button>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                        className="hidden"
                        onChange={handleFileSelect}
                        disabled={sending || uploadingImage}
                    />

                    <button
                        className="p-2.5 text-surface-400 hover:text-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sending || uploadingImage}
                        title="上传图片"
                        type="button"
                    >
                        {uploadingImage ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={20} />}
                    </button>

                    <InputTextarea
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        placeholder="输入消息..."
                        rows={1}
                        autoResize
                        className="flex-1 border-none shadow-none bg-transparent text-surface-700 py-2 px-1 focus:shadow-none min-h-[40px] max-h-24"
                        style={{ resize: 'none' }}
                        disabled={sending || uploadingImage}
                    />

                    <Button
                        onClick={sendMessage}
                        disabled={!messageText.trim() || sending || uploadingImage}
                        className={`
                                relative w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center 
                                transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] border-none
                                ${
                                    messageText.trim() && !sending
                                        ? 'bg-primary-500 text-surface shadow-[0_8px_24px_rgba(var(--primary-rgb),0.35)] scale-100 hover:scale-110 active:scale-90'
                                        : 'bg-surface-100 text-surface-300 scale-95 cursor-not-allowed'
                                }
                            `}
                    >
                        {sending ? (
                            <Loader2 size={18} className="animate-spin text-surface" />
                        ) : (
                            <div
                                className={`transition-all duration-500 ${messageText.trim() ? 'translate-x-0.5 -translate-y-0.5' : ''}`}
                            >
                                <Send
                                    size={18}
                                    strokeWidth={3}
                                    className={`transition-transform duration-500 ${
                                        messageText.trim() ? 'rotate-[-12deg] scale-110' : 'rotate-0 scale-100'
                                    }`}
                                />
                            </div>
                        )}

                        {messageText.trim() && !sending && (
                            <span className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-20 pointer-events-none" />
                        )}
                    </Button>
                </div>
            </div>
        </>
    );

    const videoPickerStudentId =
        session?.user?.is_coach && chatPartner?.id
            ? chatPartner.id
            : session?.user?.is_coach
              ? ''
              : session?.user?.id || '';

    const videoPicker = videoPickerStudentId ? (
        <VideoRefPicker
            visible={showVideoPicker}
            onHide={() => setShowVideoPicker(false)}
            studentId={videoPickerStudentId}
            onSelect={sendVideoReferences}
        />
    ) : null;

    if (variant === 'modal') {
        return (
            <>
                <Dialog
                    header={
                        <div className="flex items-center gap-3 w-full min-w-0 pr-2">
                            <div className="min-w-0 flex-1 overflow-hidden">{renderHeader()}</div>
                            <button
                                type="button"
                                className="p-2 rounded-xl text-surface-600 hover:bg-surface-100 shrink-0"
                                onClick={() => setSearchOpen(true)}
                                aria-label="搜索聊天记录"
                                title="搜索聊天记录"
                            >
                                <Search size={20} strokeWidth={2.25} />
                            </button>
                        </div>
                    }
                    visible={dialogVisible}
                    onHide={() => onHide?.()}
                    modal
                    draggable={false}
                    resizable={false}
                    style={{ width: '95vw', maxWidth: '750px' }}
                    className="chat-dialog-container border-none shadow-2xl rounded-3xl overflow-hidden"
                    contentClassName="p-0 flex flex-col bg-surface-0"
                    pt={{
                        header: { className: 'py-4 px-6 border-b border-surface bg-surface-50' },
                        closeButton: { className: 'hover:bg-surface-100 rounded-full transition-all' },
                        content: { className: 'flex flex-col' },
                    }}
                >
                    {messagesBlock}
                </Dialog>
                {videoPicker}
                {chatroom ? (
                    <ChatHistorySearchDialog
                        visible={searchOpen}
                        onHide={() => setSearchOpen(false)}
                        roomId={chatroom.id}
                        onPickMessage={jumpToMessageFromSearch}
                    />
                ) : null}
            </>
        );
    }

    return (
        <>
            <div className="flex flex-col h-full min-h-0 flex-1 bg-surface-0 rounded-2xl border border-surface-100 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <div className="flex-shrink-0 flex items-center gap-2 py-4 px-4 border-b border-surface bg-surface-50">
                    <button
                        type="button"
                        className="md:hidden p-2 rounded-xl text-surface-600 hover:bg-surface-100 shrink-0"
                        onClick={() => onRequestClose?.()}
                        aria-label="返回会话列表"
                    >
                        <ChevronLeft size={22} strokeWidth={2.5} />
                    </button>
                    <div className="min-w-0 flex-1 flex items-center overflow-hidden">{renderHeader()}</div>
                    <button
                        type="button"
                        className="p-2 rounded-xl text-surface-600 hover:bg-surface-100 shrink-0"
                        onClick={() => setSearchOpen(true)}
                        aria-label="搜索聊天记录"
                        title="搜索聊天记录"
                    >
                        <Search size={20} strokeWidth={2.25} />
                    </button>
                </div>
                <div className="flex flex-col flex-1 min-h-[240px] h-[min(100%,calc(100dvh-13rem))] md:min-h-[480px] md:h-[calc(100vh-220px)] overflow-hidden">
                    {messagesBlock}
                </div>
            </div>
            {videoPicker}
            {chatroom ? (
                <ChatHistorySearchDialog
                    visible={searchOpen}
                    onHide={() => setSearchOpen(false)}
                    roomId={chatroom.id}
                    onPickMessage={jumpToMessageFromSearch}
                />
            ) : null}
        </>
    );
};

export default ChatPanel;
