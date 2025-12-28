'use client';

import { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { ConversationList } from '@/components/chat/ConversationList';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import type { ChatroomItem } from '@/app/api/chat/list-chatrooms/entity';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Search, MessageSquareText } from 'lucide-react'; // 引入图标

export default function MessagesPage() {
    const { showToast } = useToastContext();
    const [chatrooms, setChatrooms] = useState<ChatroomItem[]>([]);
    const [filteredChatrooms, setFilteredChatrooms] = useState<ChatroomItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

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
                    />
                </Card>
            </div>
        </div>
    );
}