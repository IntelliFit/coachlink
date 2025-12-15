'use client';

import { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { ConversationList } from '@/components/chat/ConversationList';
import { chatService } from '@/app/service/chatService';
import { useToastContext } from '@/context/ToastContext';
import type { ConversationItem } from '@/app/api/chat/list-chatrooms/entity';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';

export default function MessagesPage() {
    const { showToast } = useToastContext();
    const [conversations, setConversations] = useState<ConversationItem[]>([]);
    const [filteredConversations, setFilteredConversations] = useState<ConversationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    const loadConversations = async () => {
        setLoading(true);
        try {
            const data = await chatService.getConversations({ page: 1, limit: 50 });

            if (data) {
                setConversations(data.conversations);
                setFilteredConversations(data.conversations);
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
            setFilteredConversations(conversations);
        } else {
            const filtered = conversations.filter(conv =>
                conv.coach_name.toLowerCase().includes(searchText.toLowerCase()) ||
                conv.student_name.toLowerCase().includes(searchText.toLowerCase()) ||
                (conv.last_message && conv.last_message.toLowerCase().includes(searchText.toLowerCase()))
            );
            setFilteredConversations(filtered);
        }
    }, [searchText, conversations]);

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
                    conversations={filteredConversations}
                    loading={loading}
                />
            </Card>
        </div>
    );
}

