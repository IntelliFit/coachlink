'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';
import { TabMenu } from 'primereact/tabmenu';
import type { MenuItem } from 'primereact/menuitem';
import type { TabMenuTabChangeEvent } from 'primereact/tabmenu';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

const DASHBOARD_TABS: { label: string; icon: string; path: string }[] = [
    { label: '概览', icon: 'pi pi-chart-line', path: '/dashboard/overview' },
    { label: '视频点评', icon: 'pi pi-play-circle', path: '/dashboard/videos' },
    { label: '我的学员', icon: 'pi pi-user', path: '/dashboard/students' },
    { label: '内容管理', icon: 'pi pi-file-edit', path: '/dashboard/content' },
    { label: '计划模板', icon: 'pi pi-clipboard', path: '/dashboard/plan-lib' },
    { label: '动作库', icon: 'pi pi-database', path: '/dashboard/action-lib' },
    { label: '聊天管理', icon: 'pi pi-comments', path: '/dashboard/chat' }
];

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const router = useRouter();
    const pathname = usePathname();

    // 当前活动标签索引，通过 pathname 直接推导
    const activeIndex = useMemo(() => {
        const index = DASHBOARD_TABS.findIndex(tab => pathname.includes(tab.path));
        return index >= 0 ? index : 0;
    }, [pathname]);

    const handleTabChange = (e: TabMenuTabChangeEvent) => {
        router.push(DASHBOARD_TABS[e.index].path);
    };

    return (
        <div className="min-h-screen">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* 顶部导航 */}
                <div className="
                    bg-surface-50
                ">
                    <TabMenu
                        model={DASHBOARD_TABS as MenuItem[]}
                        activeIndex={activeIndex}
                        onTabChange={handleTabChange}
                    />
                </div>


                {/* 子页面内容 */}
                <div>{children}</div>
            </div>
        </div>
    );
};

export default DashboardLayout;
