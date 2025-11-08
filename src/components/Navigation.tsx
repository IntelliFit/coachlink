'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Target, Users, Trophy } from 'lucide-react';
import { Button } from 'primereact/button';
import { Menubar } from 'primereact/menubar';
import { BreadCrumb } from 'primereact/breadcrumb';
import { Tooltip } from 'primereact/tooltip';
import { MenuItem } from 'primereact/menuitem';
import { useTheme } from '@/context/ThemeContext';

interface NavigationItem {
    name: string;
    href: string;
    icon: React.ComponentType<any>;
}

interface MenuItemWithTemplate extends MenuItem {
    url: string;
    template?: (item: MenuItem, options: any) => React.ReactNode;
}

export default function Navigation() {
    const pathname = usePathname();
    const { theme, toggleTheme } = useTheme();

    const navigation: NavigationItem[] = [
        {
            name: '首页',
            href: '/',
            icon: Target,
        },
        {
            name: '教练',
            href: '/coach',
            icon: Users,
        },
        {
            name: '排行榜',
            href: '/ranking',
            icon: Trophy,
        },
    ];

    // 获取当前页面标题
    const getPageTitle = (path: string): string => {
        const titles: Record<string, string> = {
            '/coach': '教练团队',
            '/ranking': '排行榜',
            '/profile': '个人资料'
        };
        return titles[path] || '';
    };

    // 面包屑导航数据
    const breadcrumbItems = [
        { label: '首页', url: '/' },
        ...(pathname !== '/' && getPageTitle(pathname)
            ? [{ label: getPageTitle(pathname), url: pathname }]
            : [])
    ].filter(item => item.label);

    // 菜单项配置
    const menuItems: MenuItemWithTemplate[] = navigation.map((item) => ({
        label: item.name,
        icon: getMenuItemIcon(item.href),
        url: item.href,
        template: (item: MenuItem, options: any) => {
            const isActive = pathname === (item as MenuItemWithTemplate).url;
            return (
                <Link
                    href={(item as MenuItemWithTemplate).url}
                    className={`${options.className} ${isActive ? 'p-menuitem-link-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                >
                    <span className={options.iconClassName} />
                    <span className={options.labelClassName}>{item.label}</span>
                </Link>
            );
        }
    }));

    // 获取菜单项图标
    function getMenuItemIcon(href: string): string {
        const icons: Record<string, string> = {
            '/': 'pi pi-home',
            '/coach': 'pi pi-users',
            '/ranking': 'pi pi-chart-line'
        };
        return icons[href] || 'pi pi-circle';
    }

    // Logo组件
    const logoStart = (
        <div className="flex align-items-center mr-6">
            <Link
                href="/"
                className="flex align-items-center no-underline text-900 hover:text-700 transition-colors duration-200"
                aria-label="CoachLink 首页"
            >
                <div className="w-3rem h-3rem bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex align-items-center justify-center mr-3 shadow-md">
                    <Brain className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold text-900 dark:text-white">CoachLink</span>
            </Link>
        </div>
    );

    // 主题切换按钮
    const themeToggleEnd = (
        <div className="flex align-items-center gap-2">
            <Tooltip
                target=".theme-toggle"
                position="bottom"
            />
            <Button
                icon={theme === 'light' ? 'pi pi-moon' : 'pi pi-sun'}
                onClick={toggleTheme}
                className="p-button-outlined theme-toggle border-300 dark:border-600"
                rounded
                text
                severity="help"
                data-pr-tooltip={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            />
        </div>
    );


    return (
        <>
            {/* 主导航 */}
            <header
                className="sticky top-0 z-50 shadow-sm bg-white dark:bg-gray-900 backdrop-blur-sm bg-opacity-95"
                role="banner"
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Menubar
                        model={menuItems}
                        start={logoStart}
                        end={themeToggleEnd}
                        className="border-none bg-transparent px-0 py-3"
                    />
                </div>
            </header>

            {/* 面包屑导航 - 仅在非首页显示 */}
            {pathname !== '/' && breadcrumbItems.length > 1 && (
                <nav
                    className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
                    aria-label="面包屑导航"
                >
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <BreadCrumb
                            model={breadcrumbItems}
                            home={{
                                icon: 'pi pi-home',
                                url: '/',
                                template: (item: MenuItem, options: any) => (
                                    <Link
                                        href={(item as MenuItemWithTemplate).url}
                                        className={options.className}
                                        aria-label="首页"
                                    >
                                        <span className={options.iconClassName} />
                                    </Link>
                                )
                            }}
                            className="bg-transparent border-none p-0"
                        />
                    </div>
                </nav>
            )}

        </>
    );
}