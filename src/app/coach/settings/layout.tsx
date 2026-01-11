'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TabMenu } from 'primereact/tabmenu';
import type { MenuItem } from 'primereact/menuitem';

interface CoachSettingsLayoutProps {
    children: React.ReactNode;
}

const SETTINGS_TABS: { label: string; path: string; icon: string }[] = [
    { label: '收款码设置', path: '/coach/settings/payment', icon: 'pi pi-qrcode' },
    { label: '账号安全', path: '/coach/settings/security', icon: 'pi pi-shield' }
];

const CoachSettingsLayout: React.FC<CoachSettingsLayoutProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    const activeIndex = SETTINGS_TABS.findIndex(tab => pathname?.startsWith(tab.path));

    const menuItems: MenuItem[] = SETTINGS_TABS.map(tab => ({
        label: tab.label,
        icon: tab.icon,
        command: () => router.push(tab.path)
    }));

    return (
        <div className="min-h-screen bg-surface-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-surface-900 mb-4">教练设置</h1>
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

export default CoachSettingsLayout;
