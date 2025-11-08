'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain, Target, Users, Trophy } from 'lucide-react';
import { Menubar } from 'primereact/menubar';
import { BreadCrumb } from 'primereact/breadcrumb';
import { Button } from 'primereact/button';
import { Avatar } from 'primereact/avatar';
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
        { name: '首页', href: '/', icon: Target },
        { name: '教练', href: '/coach', icon: Users },
        { name: '排行榜', href: '/ranking', icon: Trophy },
    ];

    const getPageTitle = (path: string) => {
        const titles: Record<string, string> = {
            '/coach': '教练团队',
            '/ranking': '排行榜',
            '/profile': '个人资料',
        };
        return titles[path] || '';
    };

    const breadcrumbItems = [
        { label: '首页', url: '/' },
        ...(pathname !== '/' && getPageTitle(pathname)
            ? [{ label: getPageTitle(pathname), url: pathname }]
            : []),
    ].filter(item => item.label);

    const menuItems: MenuItemWithTemplate[] = navigation.map(item => ({
        label: item.name,
        icon: getMenuItemIcon(item.href),
        url: item.href,
        template: (menuItem, options) => {
            const isActive = pathname === (menuItem as MenuItemWithTemplate).url;
            return (
                <Link
                    href={(menuItem as MenuItemWithTemplate).url}
                    className={`${options.className} ${isActive ? 'p-menuitem-link-active font-semibold text-primary border-b-2 border-primary' : ''} transition-colors duration-200`}
                    aria-current={isActive ? 'page' : undefined}
                >
                    <span className={options.iconClassName} />
                    <span className={options.labelClassName}>{menuItem.label}</span>
                </Link>
            );
        },
    }));

    function getMenuItemIcon(href: string): string {
        const icons: Record<string, string> = {
            '/': 'pi pi-home',
            '/coach': 'pi pi-users',
            '/ranking': 'pi pi-chart-line',
        };
        return icons[href] || 'pi pi-circle';
    }

    // Logo + 网站名，水平布局
    const logoStart = (
        <div className="flex items-center space-x-3 mr-3">
            {/* 图标 */}
            <img src="/favicon.svg" className='h-10 w-10' />

            {/* 名称 */}
            <span className="text-2xl font-extrabold">
                <span>Coach</span>
                <span className="text-primary">Link</span>
            </span>
        </div>

    );

    // 主题切换按钮
    const themeToggleEnd = (
        <div className="flex items-center gap-2">
            <Tooltip target=".theme-toggle" position="bottom" />
            <Button
                icon={theme === 'light' ? 'pi pi-moon' : 'pi pi-sun'}
                onClick={toggleTheme}
                rounded
                text
                data-pr-tooltip={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
                aria-label={theme === 'light' ? '切换到深色模式' : '切换到浅色模式'}
            />
        </div>
    );

    return (
        <>
            {/* 主导航栏 */}
            <header className="sticky top-0 z-50" role="banner">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <Menubar
                        model={menuItems}
                        start={logoStart}
                        end={themeToggleEnd}
                        className="border-none bg-transparent px-0 py-3"
                    />
                </div>
            </header>

            {/* 面包屑导航，仅在非首页显示 */}
            {pathname !== '/' && breadcrumbItems.length > 1 && (
                <nav className="border-b border-surface-200 dark:border-surface-700" aria-label="面包屑导航">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                        <BreadCrumb
                            model={breadcrumbItems}
                            home={{
                                icon: 'pi pi-home',
                                url: '/',
                                template: (item, options) => (
                                    <Link href={(item as MenuItemWithTemplate).url} className={`${options.className} text-primary hover:text-primary/80 transition-colors duration-200`} aria-label="首页">
                                        <span className={options.iconClassName} />
                                    </Link>
                                ),
                            }}
                            className="bg-transparent border-none p-0"
                        />
                    </div>
                </nav>
            )}
        </>
    );
}