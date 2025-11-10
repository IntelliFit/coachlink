'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menubar } from 'primereact/menubar';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
import { Tooltip } from 'primereact/tooltip';
import { MenuItem } from 'primereact/menuitem';
import { Menu } from 'primereact/menu';
import { useTheme } from '@/context/ThemeContext';
import { useLoginModal } from '@/components/auth/LoginModalContext';
import { useSession, signOut } from 'next-auth/react';
import { useProfileSetupModal } from '@/components/shared/ProfileSetupModalContext';

interface NavigationItem {
    name: string;
    href: string;
    icon: string;
}

interface MenuItemWithTemplate extends MenuItem {
    url: string;
    template?: (item: MenuItem, options: any) => React.ReactNode;
}

export default function Navigation() {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();
    const { openLoginModal } = useLoginModal();
    const { openProfileSetupModal } = useProfileSetupModal();
    const { data: session, status } = useSession();
    const menu = useRef<Menu>(null);
    const [menuTarget, setMenuTarget] = useState<HTMLElement | null>(null);

    const navigation: NavigationItem[] = [
        { name: '首页', href: '/', icon: 'pi pi-home' },
        { name: '教练', href: '/coach', icon: 'pi pi-users' },
        { name: '排行榜', href: '/ranking', icon: 'pi pi-chart-line' },
    ];

    const getPageTitle = (path: string) => {
        const titles: Record<string, string> = {
            '/coach': '教练团队',
            '/ranking': '排行榜',
            '/profile': '个人资料',
        };
        return titles[path] || '';
    };

    const menuItems: MenuItemWithTemplate[] = navigation.map(item => ({
        label: item.name,
        icon: item.icon,
        url: item.href,
        template: (menuItem, options) => {
            const isActive = pathname === (menuItem as MenuItemWithTemplate).url;
            return (
                <Link
                    href={(menuItem as MenuItemWithTemplate).url}
                    className={`${options.className} ${isActive
                        ? 'p-menuitem-link-active font-semibold text-primary border-b-2 border-primary'
                        : ''
                        } transition-colors duration-200`}
                    aria-current={isActive ? 'page' : undefined}
                >
                    <span className={options.iconClassName} />
                    <span className={options.labelClassName}>{menuItem.label}</span>
                </Link>
            );
        },
    }));

    // 用户菜单项
    const userMenuItems: MenuItem[] = [
        {
            label: session?.user?.primary_role === 'student' ? '切换到教练端' : '切换到学员端',
            icon: 'pi pi-user-edit',
            command: () => {
                // 这里可以实现角色切换逻辑
                console.log('切换角色');
            }
        },
        {
            separator: true
        },
        {
            label: '个人设置',
            icon: 'pi pi-cog',
            command: () => {
                openProfileSetupModal(session?.profile, session?.user?.id);
            }
        },
        {
            label: '退出登录',
            icon: 'pi pi-sign-out',
            command: () => signOut({ callbackUrl: '/' })
        }
    ];

    // Logo + 网站名
    const logoStart = (
        <div className="flex items-center space-x-3 mr-3">
            <img src="/favicon.jpg" className="h-10 rounded-md" alt="logo" />
            <span className="text-2xl font-extrabold">
                <span>Coach</span>
                <span className="text-primary">Link</span>
            </span>
        </div>
    );

    // ✅ 登录状态控制
    const themeToggleEnd = (
        <div className="flex items-center gap-2">
            {/* 登录状态显示 */}
            {status === 'loading' ? (
                <span className="text-sm text-muted-color">正在加载...</span>
            ) : session?.user ? (
                <div className="flex items-center gap-3">
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 p-2 rounded-lg transition-colors"
                        onClick={(e) => {
                            setMenuTarget(e.currentTarget);
                            menu.current?.toggle(e);
                        }}
                    >
                        <Avatar
                            image={session.profile.avatar_url || undefined}
                            label={session.profile.avatar_url ? undefined : (session.profile.nickname?.charAt(0) || session.user.phone?.slice(0, 1) || 'U')}
                            shape="circle"
                            className="bg-primary text-white font-bold flex-shrink-0"
                            size="large"
                        />
                        <div className="flex flex-col">
                            <span className="font-medium">{session.profile.nickname || session.user.phone}</span>
                            <div className="flex gap-1">
                                {session.user.subscription_level && (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${session.user.subscription_level === 'basic' ? 'bg-gray-100 text-gray-600' :
                                        session.user.subscription_level === 'advanced' ? 'bg-blue-100 text-blue-600' :
                                            session.user.subscription_level === 'premium' ? 'bg-purple-100 text-purple-600' : ''
                                        }`}>
                                        {session.user.subscription_level === 'basic' ? '基础会员' :
                                            session.user.subscription_level === 'advanced' ? '高级会员' :
                                                session.user.subscription_level === 'premium' ? '至尊会员' : ''}
                                    </span>
                                )}
                                {session.user.primary_role && (
                                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                                        {session.user.primary_role === 'student' ? '学员' :
                                            session.user.primary_role === 'coach' ? '教练' : session.user.primary_role}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <Menu
                        model={userMenuItems}
                        popup
                        ref={menu}
                        target={menuTarget as any}
                        className="min-w-48"
                    />

                    {/* 主题切换按钮 */}
                    <Tooltip target=".theme-toggle" position="bottom" />
                    <Button
                        icon={theme === 'light' ? 'pi pi-moon' : 'pi pi-sun'}
                        onClick={toggleTheme}
                        rounded
                        text
                        className="theme-toggle"
                        data-pr-tooltip={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                        aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                    />
                </div>
            ) : (
                <Button
                    label="登录"
                    icon="pi pi-sign-in"
                    onClick={openLoginModal}
                />
            )}
        </div>
    );

    return (
        <>

            {/* 主导航栏 */}
            <Menubar
                model={menuItems}
                start={logoStart}
                end={themeToggleEnd}
                className="sticky top-0 z-50 border-none bg-transparent px-0 py-3"
            />

        </>
    );
}