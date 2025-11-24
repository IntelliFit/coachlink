'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Tooltip } from 'primereact/tooltip';
import { Menu } from 'primereact/menu';
import { Skeleton } from 'primereact/skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useLoginModal } from '@/components/auth/LoginModalContext';
import { useProfileSetupModal } from '@/context/ProfileSetupModalContext';
import { useSession, signOut } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';

export default function Navigation() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openLoginModal } = useLoginModal();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);

    // 客户端标识，防止 hydration 不一致
    useEffect(() => {
        setIsClient(true);
    }, []);

    // ✅ 用户菜单项（依赖 session，使用 useMemo 缓存）
    const userMenuItems = useMemo(() => [
        {
            label: session?.user?.primary_role === 'coach' ? '控制台' : '申请成为教练',
            icon: session?.user?.primary_role === 'coach' ? 'pi pi-desktop' : 'pi pi-user-plus',
            command: () => router.push('/dashboard'),
        },
        { separator: true },
        ...(session?.user?.primary_role !== 'coach'
            ? [{
                label: '我的档案',
                icon: 'pi pi-id-card',
                command: () => router.push('/me/profile'),
            }]
            : []),
        {
            label: '个人设置',
            icon: 'pi pi-cog',
            command: () => openProfileSetupModal(session?.profile, session?.user?.id),
        },
        {
            label: '退出登录',
            icon: 'pi pi-sign-out',
            command: () => signOut({ callbackUrl: '/' }),
        },
    ], [session, openProfileSetupModal, router]);

    // ✅ 处理用户菜单展开
    const handleUserMenuToggle = useCallback((event: React.MouseEvent) => {
        menuRef.current?.toggle(event);
    }, []);

    // ✅ 导航数据（保持不变，也可 useMemo，但简单静态数据无需）
    const menuItems = [
        {
            label: '首页',
            icon: 'pi pi-home',
            command: () => router.push('/'),
        },
        {
            label: '教练',
            icon: 'pi pi-users',
            items: [
                {
                    label: '我的订阅',
                    icon: 'pi pi-book',
                    command: () => router.push('/coach/subscription'),
                },
                {
                    label: '发现教练',
                    icon: 'pi pi-search',
                    command: () => router.push('/coach/discovery'),
                },
            ],
        },
        {
            label: '排行榜',
            icon: 'pi pi-chart-line',
            command: () => router.push('/ranking'),
        },
    ];

    // ✅ Logo
    const start = (
        <Link href="/" className="flex items-center space-x-3 mr-4">
            <img src="/favicon.jpg" alt="logo" className="h-10 rounded-md" />
            <span className="text-2xl font-extrabold">
                Coach<span className="text-primary">Link</span>
            </span>
        </Link>
    );

    // ✅ 右侧区域：登录状态 + 消息 + 主题切换
    const end = (
        <div className="flex items-center gap-3 h-full">
            {status === 'loading' ? (
                <div className="flex items-center gap-3">
                    <Skeleton shape="circle" size="2rem" />
                    <div className="flex flex-col gap-1">
                        <Skeleton width="6rem" height="1rem" />
                        <div className="flex gap-1">
                            <Skeleton width="3rem" height="0.8rem" borderRadius="9999px" />
                            <Skeleton width="3rem" height="0.8rem" borderRadius="9999px" />
                        </div>
                    </div>
                </div>
            ) : session?.user ? (
                <>
                    {/* 消息按钮 */}
                    <Tooltip target=".message-button" position="bottom" />
                    <div className="relative">
                        <Button
                            icon="pi pi-comment"
                            onClick={() => router.push('/messages')}
                            rounded
                            text
                            className="message-button shrink-0"
                            data-pr-tooltip="消息"
                        />
                        <MessageBadge className="absolute -top-1 -right-1" />
                    </div>

                    {/* 用户头像和信息 */}
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-1 rounded-lg transition-colors"
                        onClick={handleUserMenuToggle}
                        aria-label="用户菜单"
                    >
                        <Avatar
                            image={session.profile?.avatar_url || undefined}
                            label={
                                session.profile?.avatar_url
                                    ? undefined
                                    : session.profile?.nickname?.charAt(0) ||
                                      session.user.phone?.slice(0, 1) ||
                                      'U'
                            }
                            shape="circle"
                            className="bg-primary text-white font-bold flex-shrink-0"
                            size="normal"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium text-sm">
                                {session.profile?.nickname || session.user.phone}
                            </span>
                            <div className="flex gap-1">
                                {session.user.subscription_level && (
                                    <span
                                        className={`text-xs px-1.5 py-0.5 rounded-full ${
                                            session.user.subscription_level === 'basic'
                                                ? 'bg-gray-100 text-gray-600'
                                                : session.user.subscription_level === 'advanced'
                                                ? 'bg-blue-100 text-blue-600'
                                                : session.user.subscription_level === 'premium'
                                                ? 'bg-purple-100 text-purple-600'
                                                : ''
                                        }`}
                                    >
                                        {session.user.subscription_level === 'basic'
                                            ? '基础会员'
                                            : session.user.subscription_level === 'advanced'
                                            ? '高级会员'
                                            : session.user.subscription_level === 'premium'
                                            ? '至尊会员'
                                            : ''}
                                    </span>
                                )}
                                {session.user.primary_role && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                                        {session.user.primary_role === 'student'
                                            ? '学员'
                                            : session.user.primary_role === 'coach'
                                            ? '教练'
                                            : session.user.primary_role}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <Button
                    label="登录"
                    icon="pi pi-sign-in"
                    size="small"
                    onClick={openLoginModal}
                    className="p-button-outlined"
                />
            )}

            {/* 主题切换按钮 */}
            <Tooltip target=".theme-toggle" position="bottom" />
            <Button
                icon={theme === 'light' ? 'pi pi-moon' : 'pi pi-sun'}
                onClick={toggleTheme}
                rounded
                text
                className="theme-toggle shrink-0"
                data-pr-tooltip={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            />
        </div>
    );

    return (
        <>
            <Menubar
                model={menuItems}
                start={start}
                end={end}
                className="sticky top-0 z-50 border-b shadow-sm px-4"
            />

            {/* 只在客户端渲染时挂载 Menu，避免 SSR 问题 */}
            {isClient && (
                <Menu
                    model={userMenuItems}
                    popup
                    ref={menuRef}
                    id="user_menu"
                    className="min-w-40"
                />
            )}
        </>
    );
}
