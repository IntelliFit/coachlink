'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TabView, TabPanel } from 'primereact/tabview';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { friendService } from '@/app/service/friendService';
import { useToastContext } from '@/context/ToastContext';
import { UserSearchInput } from '@/components/social/UserSearchInput';
import { FriendCard } from '@/components/social/FriendCard';
import { FriendRequestCard } from '@/components/social/FriendRequestCard';
import { ArrowLeft, UserPlus } from 'lucide-react';
import { Avatar } from 'primereact/avatar';

export default function FriendsPage() {
    const router = useRouter();
    const { showToast } = useToastContext();
    
    const [friends, setFriends] = useState<any[]>([]);
    const [requests, setRequests] = useState<any[]>([]);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [searchLoading, setSearchLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

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
                // Remove from search results to avoid duplicate requests
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
                loadData(); // Reload lists
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

    return (
        <div className="min-h-screen bg-surface-50 pb-20">
            {/* Header */}
            <div className="bg-white sticky top-0 z-10 shadow-sm px-4 py-3 flex items-center gap-3">
                <Button 
                    icon={<ArrowLeft className="w-5 h-5" />} 
                    text 
                    rounded 
                    onClick={() => router.back()} 
                />
                <h1 className="text-lg font-bold">我的好友</h1>
            </div>

            <div className="p-4 space-y-4">
                {/* Search Area */}
                <UserSearchInput onSearch={handleSearch} loading={searchLoading} />
                
                {/* Search Results */}
                {searchResults.length > 0 && (
                    <div className="bg-white rounded-xl p-4 shadow-sm animate-fade-in-down">
                        <h3 className="text-sm font-semibold text-surface-500 mb-2">搜索结果</h3>
                        {searchResults.map(user => (
                            <div key={user.id} className="flex items-center justify-between py-2 border-b last:border-0 border-surface-100">
                                <div className="flex items-center gap-3">
                                    <Avatar image={user.avatarUrl} shape="circle" />
                                    <span>{user.nickname}</span>
                                </div>
                                <Button 
                                    icon={<UserPlus className="w-4 h-4" />} 
                                    label="添加" 
                                    size="small" 
                                    onClick={() => sendRequest(user.id)}
                                    disabled={actionLoading}
                                />
                            </div>
                        ))}
                    </div>
                )}

                {/* Lists */}
                <TabView 
                    activeIndex={activeIndex} 
                    onTabChange={(e) => setActiveIndex(e.index)}
                    className="transparent-tabs"
                >
                    <TabPanel header="好友列表">
                        {loading ? (
                            <div className="flex justify-center p-8"><ProgressSpinner style={{width: '30px'}}/></div>
                        ) : friends.length === 0 ? (
                            <div className="text-center py-12 text-surface-500">
                                <p>还没有好友</p>
                                <p className="text-sm mt-1">去搜索添加一些健身伙伴吧！</p>
                            </div>
                        ) : (
                            <div>
                                {friends.map(friend => (
                                    <FriendCard 
                                        key={friend.userId} 
                                        friend={friend} 
                                        onRemove={removeFriend}
                                    />
                                ))}
                            </div>
                        )}
                    </TabPanel>
                    
                    <TabPanel 
                        header={
                            <div className="flex items-center gap-2">
                                <span>新请求</span>
                                {requests.length > 0 && (
                                    <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                                        {requests.length}
                                    </span>
                                )}
                            </div>
                        }
                    >
                        {loading ? (
                            <div className="flex justify-center p-8"><ProgressSpinner style={{width: '30px'}}/></div>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-12 text-surface-500">暂无新请求</div>
                        ) : (
                            <div>
                                {requests.map(req => (
                                    <FriendRequestCard 
                                        key={req.friendshipId} 
                                        request={req}
                                        onAccept={(id) => handleRespond(id, 'accept')}
                                        onReject={(id) => handleRespond(id, 'reject')}
                                        loading={actionLoading}
                                    />
                                ))}
                            </div>
                        )}
                    </TabPanel>
                </TabView>
            </div>
        </div>
    );
}
