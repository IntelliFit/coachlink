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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useNotificationPermission } from '@/context/NotificationPermissionContext';
import type { StudentSubscription } from '@/app/api/coach/list-students/entity';

export default function MessagesPage() {
    const { showToast } = useToastContext();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data: session } = useSession();
    const { supported, permission, pushLoading, requestAndSubscribe } = usePushNotifications();
    const { openDialog: openNotificationDialog } = useNotificationPermission();

    const [chatrooms, setChatrooms] = useState<ChatroomItem[]>([]);
    const [filteredChatrooms, setFilteredChatrooms] = useState<ChatroomItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState('');

    const autoOpenHandledRef = useRef(false);

    const [broadcastVisible, setBroadcastVisible] = useState(false);
    const [broadcastLoading, setBroadcastLoading] = useState(false);
    const [broadcastStudentsLoading, setBroadcastStudentsLoading] = useState(false);
    const [isCoach, setIsCoach] = useState(false);
    const [sendToAll, setSendToAll] = useState(true);
    const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
    const [broadcastContent, setBroadcastContent] = useState('');
    const [students, setStudents] = useState<StudentSubscription[]>([]);
    const [broadcastImageUrl, setBroadcastImageUrl] = useState<string | null>(null);
    const [broadcastFileName, setBroadcastFileName] = useState<string | null>(null);
    const [broadcastFileSize, setBroadcastFileSize] = useState<number | null>(null);
    const [uploadingBroadcastImage, setUploadingBroadcastImage] = useState(false);
    const broadcastFileInputRef = useRef<HTMLInputElement>(null);

    const loadConversations = async () => {
        setLoading(true);
        try {
            const res = await chatService.listChatrooms({ page: 1, limit: 50 });
            if (res) {
                setChatrooms(res.chatRooms);
                setFilteredChatrooms(res.chatRooms);
            }
        } catch {
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

    /** 旧链接 ?roomId= → /messages/[roomId] */
    useEffect(() => {
        const roomId = searchParams.get('roomId');
        if (!roomId) return;
        router.replace(`/messages/${encodeURIComponent(roomId)}`);
    }, [searchParams, router]);

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
        } catch {
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
        setBroadcastImageUrl(null);
        setBroadcastFileName(null);
        setBroadcastFileSize(null);
        await loadAllStudentsForBroadcast();
    };

    const handleBroadcastImageUpload = async (file: File) => {
        if (uploadingBroadcastImage) return;

        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            showToast({ severity: 'error', summary: '仅支持 PNG/JPEG/WEBP/GIF 格式的图片' });
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast({ severity: 'error', summary: '图片大小不能超过 10MB' });
            return;
        }

        setUploadingBroadcastImage(true);

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
                return;
            }

            setBroadcastImageUrl(uploadData.data.url);
            setBroadcastFileName(file.name);
            setBroadcastFileSize(file.size);
            showToast({ severity: 'success', summary: '图片上传成功' });
        } catch {
            showToast({ severity: 'error', summary: '上传失败，请稍后重试' });
        } finally {
            setUploadingBroadcastImage(false);
        }
    };

    const handleBroadcastFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleBroadcastImageUpload(file);
        }
        if (broadcastFileInputRef.current) {
            broadcastFileInputRef.current.value = '';
        }
    };

    const removeBroadcastImage = () => {
        setBroadcastImageUrl(null);
        setBroadcastFileName(null);
        setBroadcastFileSize(null);
    };

    const handleBroadcastSend = async () => {
        if (!broadcastImageUrl && !broadcastContent.trim()) {
            showToast({ severity: 'warn', summary: '提示', detail: '请输入通知内容或上传图片' });
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
                messageType: broadcastImageUrl ? 'image' : 'text',
                mediaUrl: broadcastImageUrl || undefined,
                fileName: broadcastFileName || undefined,
                fileSize: broadcastFileSize || undefined,
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
        } catch {
            showToast({ severity: 'error', summary: '失败', detail: '发送失败' });
        } finally {
            setBroadcastLoading(false);
        }
    };

    const openChatroomByRoomItem = (room: ChatroomItem) => {
        if (!room.id) return;
        router.push(`/messages/${encodeURIComponent(room.id)}`);
    };

    // 支持从「在线咨询」深链：/messages?peerUserId=xxx 或 /messages?coachId=xxx（与 ?roomId= 互斥，由 roomId 重定向优先）
    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) return;
        if (autoOpenHandledRef.current) return;
        if (searchParams.get('roomId')) return;

        const peerUserIdFromQuery =
            searchParams.get('peerUserId') ||
            searchParams.get('peer_user_id') ||
            searchParams.get('userId');
        const coachId = searchParams.get('coachId');

        if (!peerUserIdFromQuery && !coachId) return;
        autoOpenHandledRef.current = true;

        const run = async () => {
            let openedId: string | null = null;
            try {
                let peerUserId = peerUserIdFromQuery;

                if (!peerUserId && coachId) {
                    const info = await coachService.getAggregatedInfo({ coachId });
                    peerUserId = info?.coach?.user_id || null;
                }

                if (!peerUserId) {
                    showToast({ severity: 'error', summary: '错误', detail: '无法打开会话：缺少对端用户信息' });
                    return;
                }

                const res = await chatService.getChatroom({ members: [userId, peerUserId] });
                const chatroom = res?.chatroom || null;
                if (!chatroom) {
                    showToast({ severity: 'error', summary: '错误', detail: '打开会话失败' });
                    return;
                }

                openedId = chatroom.id;
                loadConversations();
            } catch {
                showToast({ severity: 'error', summary: '错误', detail: '打开会话失败' });
            } finally {
                if (openedId) {
                    router.replace(`/messages/${encodeURIComponent(openedId)}`);
                } else {
                    router.replace('/messages');
                }
            }
        };

        run();
    }, [session?.user?.id, searchParams, showToast, router]);

    useEffect(() => {
        const filtered = chatrooms.filter(
            (room) =>
                room.chatUserProfile.name.toLowerCase().includes(searchText.toLowerCase()) ||
                room.lastMessage?.toLowerCase().includes(searchText.toLowerCase()),
        );
        setFilteredChatrooms(filtered);
    }, [searchText, chatrooms]);

    return (
        <div className="min-h-[calc(100-72px)] py-10 px-4">
            <div className="container mx-auto max-w-2xl">
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
                                        detail: '请在系统设置中允许 CoachLink 的通知权限',
                                    });
                                } else {
                                    openNotificationDialog();
                                }
                            }}
                        />
                    </div>
                )}

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

                <Card className="border-none shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-lg overflow-hidden pt-2">
                    <ConversationList
                        chatrooms={filteredChatrooms}
                        loading={loading}
                        onConversationClick={openChatroomByRoomItem}
                    />
                </Card>
            </div>

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
                        <div className="text-sm font-semibold text-surface-700">图片（可选）</div>

                        <input
                            ref={broadcastFileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                            className="hidden"
                            onChange={handleBroadcastFileSelect}
                            disabled={uploadingBroadcastImage || broadcastLoading}
                        />

                        {!broadcastImageUrl ? (
                            <Button
                                label={uploadingBroadcastImage ? '上传中...' : '选择图片'}
                                icon={uploadingBroadcastImage ? 'pi pi-spin pi-spinner' : 'pi pi-image'}
                                className="p-button-outlined rounded-2xl"
                                onClick={() => broadcastFileInputRef.current?.click()}
                                disabled={uploadingBroadcastImage || broadcastLoading}
                            />
                        ) : (
                            <div className="border border-surface-200 rounded-xl p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                    <i className="pi pi-image text-primary-500"></i>
                                    <span className="text-sm text-surface-700 font-medium flex-1">
                                        {broadcastFileName}
                                    </span>
                                    <Button
                                        icon="pi pi-times"
                                        className="p-button-text p-button-sm p-button-rounded p-button-danger"
                                        onClick={removeBroadcastImage}
                                        disabled={broadcastLoading}
                                    />
                                </div>
                                <img
                                    src={broadcastImageUrl}
                                    alt="预览"
                                    className="w-full max-h-48 object-contain rounded-lg bg-surface-50"
                                />
                            </div>
                        )}

                        <div className="text-xs text-surface-500">支持 PNG、JPEG、WEBP、GIF 格式，最大 10MB</div>
                    </div>

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
                            {broadcastImageUrl
                                ? '可以为图片添加文字说明（可选）'
                                : '将以聊天消息形式发送到每位学员与您的私聊窗口中（不会互相看到收件人）。'}
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
