'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface CoachSettingsLayoutProps {
    children: React.ReactNode;
}

// 采用 PrimeIcons 字符串定义
const SETTINGS_TABS = [
    { label: '邀请设置', path: '/coach/settings/invitation', icon: 'pi pi-link' },
    { label: '收款账户', path: '/dashboard/wallet/merchant', icon: 'pi pi-wallet' },
    { label: '账号安全', path: '/coach/settings/security', icon: 'pi pi-shield' }
];

const CoachSettingsLayout: React.FC<CoachSettingsLayoutProps> = ({ children }) => {
    const router = useRouter();
    const pathname = usePathname();

    const activeIndex = SETTINGS_TABS.findIndex(tab => pathname?.startsWith(tab.path));
    const safeIndex = activeIndex >= 0 ? activeIndex : 0;

    return (
        <div className="min-h-screen">
            <div className="max-w-4xl mx-auto px-6 py-8 md:py-12 animate-in fade-in duration-700">
                
                {/* 标题区域：遵循数值中心化排版 */}
                <div className="mb-10 flex items-center justify-between">
                    <div>
                        <h1 className="text-4xl font-black text-surface-900 tracking-tighter">
                            教练设置
                        </h1>
                    </div>
                </div>

                {/* 物理质感胶囊切换器 */}
                <div className="mb-10 relative p-1.5 bg-surface-100/60 backdrop-blur-sm rounded-[24px] flex border border-surface-200/50 shadow-inner">
                    {/* 动态滑块背景：利用白色背景营造物理浮起感 */}
                    <div
                        className="absolute inset-y-1.5 bg-white rounded-[18px] shadow-sm shadow-surface-300/20 transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1)"
                        style={{
                            width: `calc(${100 / SETTINGS_TABS.length}% - 6px)`,
                            left: `calc(${(safeIndex * 100) / SETTINGS_TABS.length}% + 3px)`
                        }}
                    />
                    
                    {SETTINGS_TABS.map((tab, index) => {
                        const isActive = safeIndex === index;
                        return (
                            <button
                                key={tab.path}
                                onClick={() => router.push(tab.path)}
                                className={`relative flex-1 py-4 flex items-center justify-center gap-2.5 text-sm font-bold z-10 transition-all duration-300 active:scale-95 ${
                                    isActive 
                                    ? 'text-primary-600' 
                                    : 'text-surface-500 hover:text-surface-700'
                                }`}
                            >
                                {/* 渲染 PrimeIcons */}
                                <i className={`${tab.icon} transition-transform duration-300 ${isActive ? 'scale-110' : 'text-lg'}`} />
                                <span className="tracking-tight">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* 内容区域：非对称过渡动效 */}
                <main className="animate-in fade-in slide-in-from-top-4 duration-500 ease-out">
                    {children}
                </main>
            </div>
        </div>
    );
};

export default CoachSettingsLayout;
