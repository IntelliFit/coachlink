'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from 'primereact/card';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputTextarea } from 'primereact/inputtextarea';
import { MultiSelect } from 'primereact/multiselect';
import { Checkbox } from 'primereact/checkbox';
import { ConversationList } from '@/components/chat/ConversationList';
import { chatService } from '@/app/service/chatService';
import { coachService } from '@/app/service/coachService';
import { useToastContext } from '@/context/ToastContext';
import type { ChatroomItem } from '@/app/api/chat/list-chatrooms/entity';
import { IconField } from 'primereact/iconfield';
import { InputIcon } from 'primereact/inputicon';
import { Search, MessageSquareText, Bell } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ChatDialog from '@/components/chat/ChatDialog';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationPermission } from '@/context/NotificationPermissionContext';
import type { ChatroomDetail } from '@/app/api/chat/get-chatroom/entity';
import type { StudentSubscription } from '@/app/api/coach/list-students/entity';

export default function MessagesPage() {
    const { showToast } = useToastContext();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const { supported, permission, pushLoading, error, requestAndSubscribe } = usePushNotifications();
    const { openDialog: openNotificationDialog } = useNotificationPermission();

    const [chatrooms, setChatrooms] = useState<ChatroomItem[]>([]);
    const [filteredChatrooms, setFilteredChatrooms] = useState<ChatroomItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    const [chatDialogVisible, setChatDialogVisible] = useState(false);
    const [currentChatroom, setCurrentChatroom] = useState<ChatroomDetail | null>(null);
    const autoOpenHandledRef = useRef(false);

    const [broadcastVisible, setBroadcastVisible] = useState(false);
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [broadcastStudentsLoading, setBroadcastStudentsLoading] = useState(false);
    const [isCoach, setIsCoach] = useState(false);
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [broadcastContent, setBroadcastContent] = useState('');
    const [students, setStudents] = useState<StudentSubscription[]>([]);

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

    // Detect coach role (so we can show the broadcast entry)
    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return;
        let cancelled = false;

        const run = async () => {
            try {
                const res = await coachService.getCoach({ userId });
                if (cancelled) return;
                setIsCoach(!!res?.coach);
            } catch {
                if (cancelled) return;
                setIsCoach(false);
            }
        };

        run();
        return () => {
            cancelled = true;
        };
    }, [session?.user?.id]);

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

    const loadAllStudentsForBroadcast = async () => {
        setBroadcastStudentsLoading(true);
        try {
            const all: StudentSubscription[] = [];
            let page = 0;
            const limit = 200;
            while (true) {
                const res = await coachService.listStudents({ pagination: { page, limit } });
                const list = res?.students || [];
                all.push(...list);
                const total = res?.pagination?.total ?? all.length;
                if (all.length >= total) break;
                if (list.length === 0) break;
                page += 1;
            }
            setStudents(all);
        } catch (e) {
            showToast({ severity: 'error', summary: '错误', detail: '加载学员列表失败' });
        } finally {
            setBroadcastStudentsLoading(false);
        }
    };

    const openBroadcastDialog = async () => {
        setBroadcastVisible(true);
        setSendToAll(true);
        setSelectedStudentIds([]);
        setBroadcastContent('');
        await loadAllStudentsForBroadcast();
    };

    const handleBroadcastSend = async () => {
        if (!broadcastContent.trim()) {
            showToast({ severity: 'warn', summary: '提示', detail: '请输入通知内容' });
            return;
        }
        if (!sendToAll && selectedStudentIds.length === 0) {
            showToast({ severity: 'warn', summary: '提示', detail: '请选择要发送的学员' });
            return;
        }

        setBroadcastLoading(true);
        try {
            const res = await coachService.broadcastMessage({
                sendToAll,
                studentUserIds: sendToAll ? undefined : selectedStudentIds,
                content: broadcastContent.trim(),
            });
            if (!res) {
                showToast({ severity: 'error', summary: '失败', detail: '发送失败' });
                return;
            }

            const detail =
                res.failedCount > 0
                    ? `已发送 ${res.successCount}/${res.totalTargets}，失败 ${res.failedCount} 个`
                    : `已发送 ${res.successCount}/${res.totalTargets}`;
            showToast({ severity: res.failedCount > 0 ? 'warn' : 'success', summary: '发送完成', detail });

            setBroadcastVisible(false);
            loadConversations();
        } catch (e) {
            showToast({ severity: 'error', summary: '失败', detail: '发送失败' });
        } finally {
            setBroadcastLoading(false);
        }
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
                    {isCoach && (
                        <div className="ml-auto">
                            <Button
                                label="群发通知"
                                icon="pi pi-megaphone"
                                className="rounded-2xl"
                                onClick={openBroadcastDialog}
                            />
                        </div>
                    )}
                </div>

                {/* 开启系统通知：仅支持且未授权时展示，点击打开统一对话框 */}
                {session?.user && supported && permission !== 'granted' && (
                    <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl bg-primary-50 dark:bg-primary-900/20 px-4 py-3">
                        <div className="flex items-center gap-2 text-surface-700 dark:text-surface-200">
                            <Bell size={18} strokeWidth={2.5} className="text-primary-500" />
                            <span className="text-sm font-medium">开启系统通知，及时收到新消息</span>
                        </div>
                        <Button
                            label={permission === 'denied' ? '去设置' : '开启通知'}
                            icon="pi pi-bell"
                            className="rounded-xl"
                            size="small"
                            disabled={pushLoading}
                            onClick={() => {
                                if (permission === 'denied') {
                                    showToast({ 
                                        severity: 'info', 
                                        summary: '提示', 
                                        detail: '请在系统设置中允许 CoachLink 的通知权限' 
                                    });
                                } else {
                                    openNotificationDialog();
                                }
                            }}
                        />
                    </div>
                )}

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

            <Dialog
                header="群发通知"
                visible={broadcastVisible}
                style={{ width: 'min(720px, 92vw)' }}
                onHide={() => setBroadcastVisible(false)}
                modal
                draggable={false}
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <Checkbox
                            inputId="sendToAll"
                            checked={sendToAll}
                            onChange={(e) => setSendToAll(!!e.checked)}
                        />
                        <label htmlFor="sendToAll" className="text-sm font-semibold text-surface-700">
                            发送给全部学员（活跃订阅）
                        </label>
                        <div className="ml-auto text-xs text-surface-500">
                            {broadcastStudentsLoading ? '加载学员中...' : `学员数：${students.length}`}
                        </div>
                    </div>

                    {!sendToAll && (
                        <div className="space-y-2">
                            <div className="text-sm font-semibold text-surface-700">选择学员</div>
                            <MultiSelect
                                value={selectedStudentIds}
                                options={students.map((s) => ({
                                    label: s.profile?.nickname || s.profile?.full_name || s.student_id,
                                    value: s.student_id,
                                }))}
                                onChange={(e) => setSelectedStudentIds(e.value || [])}
                                placeholder="请选择要发送的学员"
                                filter
                                display="chip"
                                className="w-full"
                                disabled={broadcastStudentsLoading}
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <div className="text-sm font-semibold text-surface-700">通知内容</div>
                        <InputTextarea
                            value={broadcastContent}
                            onChange={(e) => setBroadcastContent(e.target.value)}
                            autoResize
                            rows={6}
                            className="w-full"
                            placeholder="请输入要发送的通知内容..."
                        />
                        <div className="text-xs text-surface-500">
                            将以聊天消息形式发送到每位学员与您的私聊窗口中（不会互相看到收件人）。
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button
                            label="取消"
                            className="p-button-text rounded-2xl"
                            onClick={() => setBroadcastVisible(false)}
                            disabled={broadcastLoading}
                        />
                        <Button
                            label={broadcastLoading ? '发送中...' : '发送'}
                            icon="pi pi-send"
                            className="rounded-2xl"
                            onClick={handleBroadcastSend}
                            loading={broadcastLoading}
                        />
                    </div>
                </div>
            </Dialog>
        </div>
    );
}