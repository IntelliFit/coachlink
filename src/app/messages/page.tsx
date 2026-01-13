'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { ConversationList } from '@/components/chat/ConversationList';
import { chatService } from '@/app/service/chatService';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import type { ChatroomItem } from '@/app/api/chat/list-chatrooms/entity';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Search, MessageSquareText } from 'lucide-react'; // 引入图标
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ChatDialog from '@/components/chat/ChatDialog';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';

export default function MessagesPage() {
    const { showToast } = useToastContext();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();

    const [chatrooms, setChatrooms] = useState<ChatroomItem[]>([]);
    const [filteredChatrooms, setFilteredChatrooms] = useState<ChatroomItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [currentChatroom, setCurrentChatroom] = useState<ChatroomDetail | null>(null);
    const autoOpenHandledRef = useRef(false);

    const loadConversations = async () => {
        setLoading(true);
        try {
            const res = await chatService.listChatrooms({ page: 1, limit: 50 });
            if (res) {
                setChatrooms(res.chatRooms);
                setFilteredChatrooms(res.chatRooms);
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: '加载失败' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();
        const handleNewMessage = () => loadConversations();
        window.addEventListener('chat-new-message', handleNewMessage);
        return () => window.removeEventListener('chat-new-message', handleNewMessage);
    }, []);

    const handleMarkSuccess = (roomId: string) => {
        const userId = session?.user?.id;
        if (!userId) return;

        setChatrooms(prev =>
            prev.map(room =>
                room.id === roomId
                    ? {
                          ...room,
                          unreadCount: 0,
                          unreadMembers: room.unreadMembers.filter(id => id !== userId),
                      }
                    : room,
            ),
        );
        window.dispatchEvent(new Event('chat-unread-update'));
    };

    const openChatroomByRoomItem = (room: ChatroomItem) => {
        const userId = session?.user?.id;
        if (!userId || !room.chatUserId) return;

        setCurrentChatroom({
            id: room.id,
            members: [room.chatUserId, userId],
            lastMessage: room.lastMessage,
            lastMessageAt: room.lastMessageAt,
            unreadMembers: room.unreadMembers,
            isArchived: room.isArchived,
        });
        setChatDialogVisible(true);
    };

    // 支持从「在线咨询」深链直达：/messages?peerUserId=xxx 或 /messages?coachId=xxx
    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return;
        if (autoOpenHandledRef.current) return;

        const peerUserIdFromQuery =
            searchParams.get('peerUserId') ||
            searchParams.get('peer_user_id') ||
            searchParams.get('userId');
        const coachId = searchParams.get('coachId');

        if (!peerUserIdFromQuery && !coachId) return;
        autoOpenHandledRef.current = true;

        const run = async () => {
            try {
                let peerUserId = peerUserIdFromQuery;

                // 若只传 coachId（coaches.id），则映射到 coaches.user_id（users.id）
                if (!peerUserId && coachId) {
                    const info = await coachService.getAggregatedInfo({ coachId });
                    peerUserId = info?.coach?.user_id || null;
                }

                if (!peerUserId) {
                    showToast({ severity: 'error', summary: '错误', detail: '无法打开会话：缺少对端用户信息' });
                    return;
                }

                // 直接 getChatroom：不存在会自动创建
                const res = await chatService.getChatroom({ members: [userId, peerUserId] });
                const chatroom = res?.chatroom || null;
                if (!chatroom) {
                    showToast({ severity: 'error', summary: '错误', detail: '打开会话失败' });
                    return;
                }

                setCurrentChatroom(chatroom);
                setChatDialogVisible(true);

                // 刷新列表，确保新建会话出现在消息中心
                loadConversations();
            } catch (e) {
                showToast({ severity: 'error', summary: '错误', detail: '打开会话失败' });
            } finally {
                // 可选：清理 URL 参数，避免用户关闭弹窗后再次自动弹出
                // 保持可分享链接的能力：这里用 replace 清掉参数，但不改变历史栈
                router.replace('/messages');
            }
        };

        run();
    }, [session?.user?.id, searchParams, showToast, router]);

    useEffect(() => {
        const filtered = chatrooms.filter(room =>
            room.chatUserProfile.name.toLowerCase().includes(searchText.toLowerCase()) ||
            room.lastMessage?.toLowerCase().includes(searchText.toLowerCase())
        );
        setFilteredChatrooms(filtered);
    }, [searchText, chatrooms]);

    return (
        <div className="min-h-[calc(100-72px)] py-10 px-4">
            <div className="container mx-auto max-w-2xl">
                {/* 页面标题区 */}
                <div className="flex items-center gap-3 mb-8">
                    <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                        <MessageSquareText size={24} strokeWidth={2.5} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-surface-900 tracking-tight">消息中心</h1>
                        <p className="text-sm text-surface-500 font-medium">与您的教练保持实时沟通</p>
                    </div>
                </div>

                {/* 搜索栏 - 磨砂风格 */}
                <div className="mb-6">
                    <IconField iconPosition="left" className="w-full group">
                        <InputIcon className="z-10 text-surface-400 group-focus-within:text-primary-500 transition-colors">
                            <Search size={18} strokeWidth={2.5} />
                        </InputIcon>
                        <InputText
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="搜索联系人或聊天内容..."
                            className="w-full pl-12 pr-4 py-4 bg-surface-0 dark:bg-surface-50 border-none rounded-2xl focus:ring-2 focus:ring-primary-500/20 transition-all font-medium text-surface-700"
                        />
                    </IconField>
                </div>

                {/* 会话列表卡片 */}
                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-lg overflow-hidden pt-2">
                    <ConversationList
                        chatrooms={filteredChatrooms}
                        loading={loading}
                        onConversationClick={openChatroomByRoomItem}
                    />
                </Card>
            </div>

            <ChatDialog
                visible={chatDialogVisible}
                chatroom={currentChatroom}
                onHide={() => setChatDialogVisible(false)}
                onMarkSuccess={handleMarkSuccess}
            />
        </div>
    );
}