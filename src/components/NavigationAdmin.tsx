'use client';

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Menu } from 'primereact/menu';
import { Skeleton } from 'primereact/skeleton';
import { useTheme } from '@/context/ThemeContext';
import { useProfileSetupModal } from '@/context/ProfileSetupModalContext';
import { useSession, signOut } from 'next-auth/react';
import { MessageBadge } from '@/components/chat/MessageBadge';
import { Badge } from 'primereact/badge';
import { AdminNavDataResponseDto } from '@/app/api/admin/admin-nav-data/entity';
import { adminService } from '@/app/service/adminService';
import { useToastContext } from '@/context/ToastContext';

export default function NavigationAdmin() {
    const pathname = usePathname();
    const router = useRouter();
    const { theme, toggleTheme } = useTheme();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const menuRef = useRef<Menu>(null);
    const [isClient, setIsClient] = useState(false);
    const { showToast } = useToastContext();

    const [navData, setNavData] = useState<AdminNavDataResponseDto>(null);

    const loadNavData = async () => {
        const res = await adminService.adminNavData({});
        if (res) {
            setNavData(res);
        } else {
            showToast({ severity: 'error', summary: '获取导航数据失败' });
        }
    }

    useEffect(() => {
        setIsClient(true);
        loadNavData();
    }, []);

    const itemRenderer = (item: any) => (
        <a className="flex align-items-center p-menuitem-link">
            <span className={item.icon} />
            <span className="mx-2">{item.label}</span>
            {(item.badge > 0) && <Badge className="ml-auto bg-red-500" value={item.badge} />}
            {item.shortcut && <span className="ml-auto border-1 surface-border border-round surface-100 text-xs p-1">{item.shortcut}</span>}
        </a>
    );

    const adminMenuItems = useMemo(() => [
        {
            label: '支付管理',
            icon: 'pi pi-users',
            command: () => {
                router.push('/admin/payments');
            },
            badge: navData?.paymentUnreviewed || 0,
        },
        {
            label: '教练申请',
            icon: 'pi pi-file-edit',
            command: () => {
                router.push('/admin/coach-applications');
            },
            badge: navData?.coachApplicationUnreviewed || 0,
            template: itemRenderer
        },
        {
            label: '排行榜管理',
            icon: 'pi pi-wallet',
            command: () => {
                router.push('/admin/rankings');
            },
        }
    ], [router, navData, itemRenderer]);

    const userMenuItems = useMemo(() => {
        const items = [
            {
                label: '个人设置',
                icon: 'pi pi-cog',
                command: () => openProfileSetupModal(session?.profile, session?.user?.id),
            },
            {
                label: '退出登录',
                icon: 'pi pi-sign-out',
                command: () => signOut({ callbackUrl: '/' }),
            }
        ];

        return items;
    }, [session, openProfileSetupModal, router]);

    const handleUserMenuToggle = useCallback((event: React.MouseEvent) => {
        menuRef.current?.toggle(event);
    }, []);

    const start = (
        <Link href="/" className="flex items-center space-x-3 mr-4">
            <img src="/favicon.jpg" alt="logo" className="h-10 rounded-md" />
            <span className="text-2xl font-extrabold">
                教<span className="text-primary">链</span>
                <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full align-middle">后台管理</span>
            </span>
        </Link>
    );

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
                    {/* Message Button */}
                    <div className="relative">
                        <Button
                            onClick={() => router.push('/messages')}
                            text
                            className="text-surface-500 message-button shrink-0 flex flex-col items-center justify-center px-2 py-1"
                            data-pr-tooltip="消息"
                        >
                            <i className="pi pi-comment text-lg mb-0.5" />
                            <span className="text-xs mt-0.5">消息</span>
                        </Button>
                        <MessageBadge className="absolute -top-1 -right-1" />
                    </div>

                    <div>
                        <Button
                            onClick={toggleTheme}
                            text
                            className="theme-toggle shrink-0 flex flex-col items-center justify-center px-2 py-1"
                            data-pr-tooltip={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                        >
                            <i className={`${theme === 'light' ? 'pi pi-moon' : 'pi pi-sun'} text-lg mb-0.5`} />
                            <span className="text-xs mt-0.5">{theme === 'light' ? '日间' : '夜间'}</span>
                        </Button>
                    </div>

                    {/* User Avatar & Info */}
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
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                                    管理员
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <Button
                    label="登录"
                    icon="pi pi-sign-in"
                    size="small"
                    onClick={() => router.push('/login')}
                    className="p-button-outlined"
                />
            )}
        </div>
    );

    return (
        <>
            <Menubar
                model={adminMenuItems}
                start={start}
                end={end}
                className="sticky top-0 z-50 border-b shadow-sm px-4"
            />

            <Menu
                model={userMenuItems}
                popup
                ref={menuRef}
                id="user_menu"
                className="min-w-40"
            />
        </>
    );
}