'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TabMenu } from 'primereact/tabmenu';
import type { MenuItem } from 'primereact/menuitem';

interface AdminLayoutProps {
    children: React.ReactNode;
}

const ADMIN_TABS: { label: string; path: string; icon: string }[] = [
    { label: '支付管理', path: '/admin/payments', icon: 'pi pi-credit-card' },
    { label: '教练申请', path: '/admin/coach-applications', icon: 'pi pi-users' },
    { label: '排行榜', path: '/admin/rankings', icon: 'pi pi-chart-bar' },
    { label: '平台设置', path: '/admin/settings', icon: 'pi pi-cog' }
];

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    const activeIndex = ADMIN_TABS.findIndex(tab => pathname?.startsWith(tab.path));

    const menuItems: MenuItem[] = ADMIN_TABS.map(tab => ({
        label: tab.label,
        icon: tab.icon,
        command: () => router.push(tab.path)
    }));

    return (
        <div className="min-h-screen bg-surface-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-surface-900 mb-4">管理后台</h1>
                    <TabMenu 
                        model={menuItems} 
                        activeIndex={activeIndex >= 0 ? activeIndex : 0}
                    />
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};

export default AdminLayout;
