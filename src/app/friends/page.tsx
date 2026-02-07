'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import { friendService } from '@/app/service/friendService';
import { useToastContext } from '@/context/ToastContext';
import { UserSearchInput } from '@/components/social/UserSearchInput';
import { FriendCard } from '@/components/social/FriendCard';
import { FriendRequestCard } from '@/components/social/FriendRequestCard';
import { ArrowLeft, Users, UserPlus, Bell } from 'lucide-react';
import { Avatar } from 'primereact/avatar';

const AERO_CONTAINER = "max-w-2xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 bg-surface-0 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900";
const AERO_SUBTITLE = "text-sm text-surface-600 mt-1";

type TabType = 'friends' | 'requests';

export default function FriendsPage() {
    const router = useRouter();
    const { showToast } = useToastContext();
    
    const [friends, setFriends] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('friends');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [friendsRes, requestsRes] = await Promise.all([
                friendService.getFriends(),
                friendService.getPendingRequests()
            ]);

            if (friendsRes.success) setFriends(friendsRes.data?.friends || []);
            if (requestsRes.success) setRequests(requestsRes.data?.requests || []);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = React.useCallback(async (query: string) => {
        if (!query) {
            setSearchResults([]);
            return;
        }
        setSearchLoading(true);
        try {
            const res = await friendService.searchUsers(query);
            if (res.success) {
                setSearchResults(res.data || []);
            } else {
                showToast({ severity: 'error', summary: '搜索失败', detail: res.message });
            }
        } finally {
            setSearchLoading(false);
        }
    }, [showToast]);

    const sendRequest = async (targetId: string) => {
        setActionLoading(true);
        try {
            const res = await friendService.sendRequest(targetId);
            if (res.success) {
                showToast({ severity: 'success', summary: '请求已发送', detail: '等待对方确认' });
                setSearchResults(prev => prev.filter(u => u.id !== targetId));
            } else {
                showToast({ severity: 'error', summary: '发送失败', detail: res.message });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const handleRespond = async (friendshipId: string, action: 'accept' | 'reject') => {
        setActionLoading(true);
        try {
            const res = await friendService.respondToRequest(friendshipId, action);
            if (res.success) {
                showToast({ 
                    severity: action === 'accept' ? 'success' : 'info', 
                    summary: action === 'accept' ? '已添加好友' : '已拒绝请求'
                });
                loadData();
            } else {
                showToast({ severity: 'error', summary: '操作失败', detail: res.message });
            }
        } finally {
            setActionLoading(false);
        }
    };

    const removeFriend = async (friendId: string) => {
        if (!confirm("确定要删除这位好友吗？")) return;
        
        setActionLoading(true);
        try {
            const res = await friendService.removeFriend(friendId);
            if (res.success) {
                showToast({ severity: 'success', summary: '已删除好友' });
                setFriends(prev => prev.filter(f => f.userId !== friendId));
            } else {
                showToast({ severity: 'error', summary: '删除失败', detail: res.message });
            }
        } finally {
            setActionLoading(false);
        }
    };

    // 骨架屏组件
    const FriendSkeleton = () => (
        <Card className={AERO_CARD}>
            <div className="p-4 flex items-center gap-4">
                <Skeleton shape="circle" size="3rem" />
                <div className="flex-1 space-y-2">
                    <Skeleton width="40%" height="1rem" />
                    <Skeleton width="60%" height="0.75rem" />
                </div>
            </div>
        </Card>
    );

    return (
        <div className="min-h-screen bg-surface-50 pb-20">
            {/* 背景装饰 */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 to-transparent" />

            <div className="relative z-10">
                {/* Header */}
                <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
                    <div className="flex items-center gap-3 mb-6">
                        <Button 
                            icon={<ArrowLeft className="w-5 h-5" />} 
                            text 
                            rounded
                            className="!w-10 !h-10 text-surface-700 hover:bg-surface-100 active:scale-[0.98] transition-all"
                            onClick={() => router.back()} 
                        />
                        <div>
                            <h1 className={AERO_TITLE}>我的好友</h1>
                            <p className={AERO_SUBTITLE}>与健身伙伴一起进步</p>
                        </div>
                    </div>

                    {/* 搜索区域 */}
                    <UserSearchInput onSearch={handleSearch} loading={searchLoading} />
                </div>

                <div className={`${AERO_CONTAINER} space-y-4`}>
                    {/* 搜索结果 */}
                    {searchResults.length > 0 && (
                        <Card className={`${AERO_CARD} animate-fade-in-down`}>
                            <div className="p-5">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-500" />
                                    <span className="text-xs font-bold tracking-widest text-surface-500 uppercase">搜索结果</span>
                                </div>
                                <div className="space-y-3">
                                    {searchResults.map(user => (
                                        <div 
                                            key={user.id} 
                                            className="flex items-center justify-between p-3 rounded-2xl bg-surface-50 border border-surface-100"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar 
                                                    image={user.avatarUrl} 
                                                    label={!user.avatarUrl ? user.nickname?.[0]?.toUpperCase() : undefined}
                                                    shape="circle"
                                                    className="!w-10 !h-10 bg-surface-200 text-surface-600 text-sm font-bold"
                                                />
                                                <div>
                                                    <div className="font-bold text-surface-900 text-sm">{user.nickname}</div>
                                                    {user.searchId && (
                                                        <div className="text-xs text-surface-500">ID: {user.searchId}</div>
                                                    )}
                                                </div>
                                            </div>
                                            <Button 
                                                icon={<UserPlus className="w-4 h-4" />} 
                                                label="添加"
                                                size="small"
                                                className="!rounded-2xl !h-9 !px-4 bg-surface-900 border-none text-surface-0 text-xs font-bold hover:bg-surface-800 active:scale-[0.98] transition-all"
                                                onClick={() => sendRequest(user.id)}
                                                disabled={actionLoading}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Tab 切换 */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('friends')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
                                activeTab === 'friends'
                                    ? 'bg-surface-900 text-surface-0 shadow-sm'
                                    : 'bg-surface-0 text-surface-600 border border-surface-200 hover:border-surface-300'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            <span>好友列表</span>
                            <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                                activeTab === 'friends' ? 'bg-surface-700 text-surface-200' : 'bg-surface-100 text-surface-500'
                            }`}>
                                {friends.length}
                            </span>
                        </button>
                        <button
                            onClick={() => setActiveTab('requests')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98] ${
                                activeTab === 'requests'
                                    ? 'bg-surface-900 text-surface-0 shadow-sm'
                                    : 'bg-surface-0 text-surface-600 border border-surface-200 hover:border-surface-300'
                            }`}
                        >
                            <Bell className="w-4 h-4" />
                            <span>新请求</span>
                            {requests.length > 0 && (
                                <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
                                    activeTab === 'requests' ? 'bg-primary-500 text-surface-0' : 'bg-primary-500 text-surface-0'
                                }`}>
                                    {requests.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* 内容区域 */}
                    {activeTab === 'friends' && (
                        <div className="space-y-3">
                            {loading ? (
                                <>
                                    <FriendSkeleton />
                                    <FriendSkeleton />
                                    <FriendSkeleton />
                                </>
                            ) : friends.length === 0 ? (
                                <Card className={AERO_CARD}>
                                    <div className="p-8 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                                            <Users className="w-8 h-8 text-surface-400" />
                                        </div>
                                        <div className="text-surface-900 font-bold mb-1">还没有好友</div>
                                        <div className="text-sm text-surface-500">去搜索添加一些健身伙伴吧</div>
                                    </div>
                                </Card>
                            ) : (
                                friends.map(friend => (
                                    <FriendCard 
                                        key={friend.userId} 
                                        friend={friend} 
                                        onRemove={removeFriend}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === 'requests' && (
                        <div className="space-y-3">
                            {loading ? (
                                <>
                                    <FriendSkeleton />
                                    <FriendSkeleton />
                                </>
                            ) : requests.length === 0 ? (
                                <Card className={AERO_CARD}>
                                    <div className="p-8 text-center">
                                        <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mx-auto mb-4">
                                            <Bell className="w-8 h-8 text-surface-400" />
                                        </div>
                                        <div className="text-surface-900 font-bold mb-1">暂无新请求</div>
                                        <div className="text-sm text-surface-500">有新的好友请求时会显示在这里</div>
                                    </div>
                                </Card>
                            ) : (
                                requests.map(req => (
                                    <FriendRequestCard 
                                        key={req.friendshipId} 
                                        request={req}
                                        onAccept={(id) => handleRespond(id, 'accept')}
                                        onReject={(id) => handleRespond(id, 'reject')}
                                        loading={actionLoading}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
