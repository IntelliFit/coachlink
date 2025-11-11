'use client';

import React, { useMemo } from 'react';
import { TabView, TabPanel } from 'primereact/tabview';
import { useRouter, usePathname } from 'next/navigation';

interface CoachLayoutProps {
    children: React.ReactNode;
}

const COACH_TABS = [
    { label: '我的订阅', path: '/coach/subscription' },
    { label: '发现教练', path: '/coach/find' }
];

const CoachLayout: React.FC<CoachLayoutProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    // 根据 pathname 自动推导当前激活索引
    const activeIndex = useMemo(() => {
        const index = COACH_TABS.findIndex(tab => pathname === tab.path);
        return index >= 0 ? index : 0;
    }, [pathname]);

    const handleTabChange = (index: number) => {
        router.push(COACH_TABS[index].path);
    };

    return (
        <div className="flex min-h-screen flex-col p-4 md:p-8">
            <div className="w-full max-w-6xl mx-auto space-y-8">
                {/* 顶部标题 */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl md:text-3xl font-bold">教练</h1>
                </div>

                {/* 主体卡片 */}
                <div className="">
                    <div className="p-4 md:p-6">
                        <TabView
                            activeIndex={activeIndex}
                            onTabChange={(e) => handleTabChange(e.index)}
                        >
                            {COACH_TABS.map((tab) => (
                                <TabPanel key={tab.path} header={tab.label} />
                            ))}
                        </TabView>

                        <div className="py-4">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoachLayout;
