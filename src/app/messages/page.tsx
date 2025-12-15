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
            console.error('加载会话列表失败:', error);
            showToast({
                severity: 'error',
                summary: '错误',
                detail: '加载会话列表失败'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConversations();

        // 监听新消息事件
        const handleNewMessage = () => {
            loadConversations();
        };

        window.addEventListener('chat-new-message', handleNewMessage);
        return () => window.removeEventListener('chat-new-message', handleNewMessage);
    }, []);

    useEffect(() => {
        if (searchText.trim() === '') {
            setFilteredChatrooms(chatrooms);
        } else {
            const filtered = chatrooms.filter(room =>
                room.chatUserProfile.name.toLowerCase().includes(searchText.toLowerCase()) ||
                (room.lastMessage?.toLowerCase().includes(searchText.toLowerCase()))
            );
            setFilteredChatrooms(filtered);
        }
    }, [searchText, chatrooms]);

    return (
        <div className="container mx-auto px-4 py-6 max-w-4xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-surface-900 dark:text-surface-0 mb-2">
                    消息
                </h1>
                <p className="text-surface-600 dark:text-surface-400">
                    与教练和学员的对话
                </p>
            </div>

            <Card className="shadow-md">
                <div className="mb-4">

                    <IconField iconPosition="left" className='w-full'>
                        <InputIcon className="pi pi-search" />
                        <InputText
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="搜索会话..."
                            className="w-full"
                        />
                    </IconField>
                </div>

                <ConversationList
                    chatrooms={filteredChatrooms}
                    loading={loading}
                />
            </Card>
        </div>
    );
}

