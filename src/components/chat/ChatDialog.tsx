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

interface ChatDialogProps {
    visible: boolean;
    onHide: () => void;
    chatroom: ChatroomDetail;
}

const ChatDialog: React.FC<ChatDialogProps> = ({ visible, onHide, chatroom }) => {
    const { data: session } = useSession();
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState<MessageItemType[]>([]);
    const [sending, setSending] = useState(false);
    const [messageText, setMessageText] = useState('');
    const [chatPartner, setChatPartner] = useState<{ name: string; avatar: string | null } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

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
            const res = await chatService.listMessages({ roomId: chatroom.id, page: 1, limit: 50 });
            if (active && res) {
                setMessages(res.messages);
                // 设置聊天对象信息
                chatroom.isArchived
            }

            setLoading(false);

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

    // 发送消息
    const sendMessage = async () => {
        if (!messageText.trim() || !chatroom) return;
        setSending(true);
        try {
            const data = await chatService.sendMessage({
                roomId: chatroom.id,
                messageType: 'text',
                content: messageText.trim()
            });
            if (data) {
                setMessageText('');
                // 重新加载消息
                const msgRes = await chatService.listMessages({ roomId: chatroom.id, page: 1, limit: 50 });
                if (msgRes) setMessages(msgRes.messages);
                showToast({ severity: 'success', summary: '成功', detail: '消息发送成功' });
            } else {
                showToast({ severity: 'error', summary: '错误', detail: '消息发送失败' });
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: error?.message || '发送失败' });
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

    const renderHeader = () => {
        if (loading || !chatPartner) {
            return (
                <div className="flex items-center gap-3 p-4 border-b border-surface-200">
                    <Skeleton shape="circle" size="2.5rem" />
                    <Skeleton width="8rem" height="1.5rem" />
                </div>
            );
        }
        return (
            <div className="flex items-center gap-3 p-4 border-b border-surface-200">
                <Avatar
                    image={chatPartner.avatar || undefined}
                    label={!chatPartner.avatar ? chatPartner.name.charAt(0) : undefined}
                    size="large"
                    shape="circle"
                    className="bg-primary-500"
                />
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
                <div className="flex justify-center items-center min-h-[300px]">
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
