import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { ProgressSpinner } from 'primereact/progressspinner';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Skeleton } from 'primereact/skeleton';
import { MessageItem } from '@/components/chat/MessageItem';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import { useSession } from 'next-auth/react';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import type { MessageItem as MessageItemType } from '@/app/api/chat/list-messages/entity';
import { userService } from '@/app/service/userService';
import { CoachLinkTable } from '@/types';

interface ChatDialogProps {
    visible: boolean;
    onHide: () => void;
    chatroom: ChatroomDetail;
    onMarkSuccess?: (roomId: string) => void;
}

const ChatDialog: React.FC<ChatDialogProps> = ({ visible, onHide, chatroom, onMarkSuccess }) => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<MessageItemType[]>([]);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatPartner, setChatPartner] = useState<{ name: string; avatar: string | null } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const eventSourceRef = useRef<EventSource | null>(null);

    const userMap: Record<string, { name: string; avatar: string | null }> = {};

    useEffect(() => {
        if (!chatroom) return;
        // 根据 chatroom.members 获取成员信息
        const loadUserProfiles = async () => {
            for (const id of chatroom.members) {
                if (id === session.user.id) {
                    userMap[id] = {
                        name: session.profile.nickname,
                        avatar: session.profile.avatar_url
                    };
                } else {
                    const res = await userService.getProfile({ userId: id });
                    if (res) {
                        userMap[id] = {
                            name: res.profile.nickname,
                            avatar: res.profile.avatar_url
                        };
                    }
                }
            }
        }

        loadUserProfiles();

    }, [visible, chatroom?.id, session?.user?.id]);


    // 加载会话和消息
    useEffect(() => {
        if (!visible || !chatroom || !session?.user?.id) {
            setMessages([]);
            setChatPartner(null);
            return;
        }
        let active = true;

        const fetchChat = async () => {
            if (!chatroom) {
                return;
            }

            setLoading(true);
            // 获取消息
            const messagesRes = await chatService.listMessages({ roomId: chatroom.id, page: 1, limit: 50 });
            if (active && messagesRes) {
                setMessages(messagesRes.messages);
            }

            setLoading(false);

            // 标记为已读
            const markRes = await chatService.markAsRead({ roomId: chatroom.id });
            if (markRes && onMarkSuccess) {
                onMarkSuccess(chatroom.id);
            }
        };

        const fetchChatPartner = async () => {
            const userId = session?.user?.id;
            console.log(chatroom.members);
            console.log(userId);


            const partner = chatroom.members.find(m => m != userId);
            if (!partner) {
                return;
            }

            console.log(partner);

            const res = await userService.getProfile({ userId: partner });
            console.log(res);

            if (res) {
                setChatPartner({
                    name: res.profile.nickname,
                    avatar: res.profile.avatar_url
                });
            }
        }

        if (visible && (chatroom.id || session?.user?.id)) {
            fetchChat();
            fetchChatPartner();
        }
        return () => { active = false; };
    }, [visible, session?.user?.id, chatroom]);

    // 滚动到底部
    useEffect(() => {
        if (visible && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, visible]);

    useEffect(() => {
        if (!visible || !chatroom?.id || !session?.user?.id) {
            return;
        }

        // 防止重复订阅
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }

        const es = new EventSource(
            `/api/chat/receive-stream?roomId=${chatroom.id}`
        );
        eventSourceRef.current = es;

        es.onmessage = (event) => {
            try {
                const newMessage = JSON.parse(event.data) as CoachLinkTable['chat_messages']['Insert'];

                // 如果是自己刚发的消息（已 optimistic），跳过
                if (newMessage.sender_id === session.user.id) {
                    return;
                }

                const userProfile = userMap[newMessage.sender_id];

                console.log(userMap);
                console.log(newMessage);



                const incoming: MessageItemType = {
                    id: newMessage.id,
                    chatUserId: newMessage.sender_id,
                    chatUserProfile: {
                        name: userProfile.name,
                        avatar: userProfile.avatar,
                    },
                    messageType: newMessage.message_type,
                    content: newMessage.content,
                    mediaUrl: newMessage.media_url,
                    fileName: newMessage.file_name,
                    fileSize: newMessage.file_size,
                    isRead: true,
                    createdAt: newMessage.created_at,
                    isMine: false,
                    duration: null,
                };

                setMessages(prev => [...prev, incoming]);
            } catch (e) {
                console.error('SSE message parse error', e);
            }
        };

        es.onerror = (err) => {
            console.error('SSE error', err);
            es.close();
            eventSourceRef.current = null;
        };

        return () => {
            es.close();
            eventSourceRef.current = null;
        };
    }, [visible, chatroom?.id, session?.user?.id]);


    // 发送消息
    const sendMessage = async () => {
        if (sending) {
            return;
        }

        if (!messageText.trim() || !chatroom) {
            return;
        }

        if (!session?.user?.id) {
            return;
        }

        setSending(true);

        const content = messageText.trim();

        setMessageText('');
        // 更新消息
        const newMessages = [...messages];
        newMessages.push({
            id: 'new' + newMessages.length,
            chatUserId: session.user.id,
            chatUserProfile: {
                name: session.profile.nickname,
                avatar: session.profile.avatar_url
            },
            messageType: 'text',
            content,
            mediaUrl: null,
            fileName: null,
            fileSize: null,
            isRead: false,
            createdAt: null,
            isMine: true,
            duration: null
        });

        setMessages(newMessages);

        const res = await chatService.sendMessage({
            roomId: chatroom.id,
            messageType: 'text',
            content
        });

        if (res) {
            setMessages(prev => {
                if (prev.length === 0) return prev;

                return prev.map((msg, index) =>
                    index === prev.length - 1
                        ? {
                            ...msg,
                            id: res.messageId,
                            createdAt: res.createdAt,
                        }
                        : msg
                );
            });

        } else {
            showToast({ severity: 'error', summary: '错误', detail: '消息发送失败' });
            // 复原输入和信息
            setMessageText(content);
            const newMessages = [...messages];
            newMessages.pop();
            setMessages(newMessages);
        }

        setSending(false);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    const renderHeader = () => {
        if (loading || !chatPartner) {
            return (
                <div className="flex items-center gap-3 p-4 border-b border-surface-200">
                    <Skeleton width="8rem" height="1.5rem" />
                </div>
            );
        }
        return (
            <div className="flex items-center gap-3 p-4 border-b border-surface-200">
                <h2 className="text-xl font-semibold text-surface-500">
                    {chatPartner.name}
                </h2>
            </div>
        );
    };

    return (
        <Dialog
            header={renderHeader()}
            visible={visible}
            style={{ width: '100%', maxWidth: 800, minHeight: 600 }}
            onHide={onHide}
            modal
            contentClassName="flex flex-col h-[70vh] md:h-[600px]"
        >
            {loading ? (
                <div className="flex justify-center items-center h-[70vh]">
                    <ProgressSpinner />
                </div>
            ) : (
                <>
                    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8 rounded-t-lg" style={{ minHeight: 320 }}>
                        {messages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-surface-500">
                                <i className="pi pi-comment text-5xl mb-4" />
                                <p className="text-lg">开始对话吧</p>
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
                    <div className="border-t border-surface-300 px-4 py-4 rounded-b-lg">
                        <div className="flex gap-3 items-end max-w-2xl mx-auto">
                            <Button
                                icon="pi pi-paperclip"
                                rounded
                                text
                                className="flex-shrink-0"
                                tooltip="发送文件"
                                tooltipOptions={{ position: 'top' }}
                                disabled
                            />
                            <InputTextarea
                                value={messageText}
                                onChange={(e) => setMessageText(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder="输入消息... (Enter发送, Shift+Enter换行)"
                                rows={1}
                                autoResize
                                className="flex-1 min-h-[44px] max-h-32 px-3 py-3 rounded-lg text-surface-700 shadow-sm"
                                disabled={sending}
                                style={{ resize: 'none' }}
                            />
                            <Button
                                icon="pi pi-send"
                                onClick={sendMessage}
                                loading={sending}
                                disabled={!messageText.trim()}
                                className="flex-shrink-0 p-button-primary"
                                rounded
                            />
                        </div>
                    </div>
                </>
            )}
        </Dialog>
    );
};

export default ChatDialog;
