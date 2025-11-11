'use client';

import React, { useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { TabMenu } from 'primereact/tabmenu';
import type { MenuItem } from 'primereact/menuitem';
import type { TabMenuTabChangeEvent } from 'primereact/tabmenu';

interface CoachLayoutProps {
    children: React.ReactNode;
}

const COACH_TABS: { label: string; path: string }[] = [
    { label: '我的订阅', path: '/coach/subscription' },
    { label: '发现教练', path: '/coach/discovery' }
];

const CoachLayout: React.FC<CoachLayoutProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    // 根据 pathname 自动推导当前激活索引
    const activeIndex = useMemo(() => {
        const index = COACH_TABS.findIndex(tab => pathname === tab.path);
        return index >= 0 ? index : 0;
    }, [pathname]);

    const handleTabChange = (e: TabMenuTabChangeEvent) => {
        router.push(COACH_TABS[e.index].path);
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* 子页面内容 */}
                <div>{children}</div>
            </div>
        </div>
    );
};

export default CoachLayout;
