'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ToastContextProvider } from "../context/ToastContext";
import { LoginModalProvider } from './auth/LoginModalContext';
import { OnboardingModalProvider } from './auth/OnboardingModalContext';
import { SessionProvider, useSession } from 'next-auth/react';
import { GuideProvider } from '@/stores/useGuideStore';
import { GuideManager } from '@/components/guide/GuideManager';
import { ChatProvider } from '@/context/ChatContext';
import { NotificationPermissionProvider } from '@/context/NotificationPermissionContext';
import { NotificationProvider } from '@/context/NotificationContext';
import { CartProvider } from '@/context/CartContext';
import Footer from './Footer';
import { registerSw } from '@/lib/swRegistration';

// Wrapper component to access session and provide guide context
function GuideWrapper({ children }: { children: ReactNode }) {
    const { data: session } = useSession();
    const userId = session?.user?.id;
    
    // Use primary_role to determine current active view (respects role switching)
    // primary_role is set by /api/user/switch-role when user switches between coach/student views
    const primaryRole = (session?.user as any)?.primary_role;
    const userRole = primaryRole === 'coach' ? 'coach' : 'student';

    return (
        <GuideProvider userId={userId}>
            {session?.user && <GuideManager userRole={userRole} />}
            {children}
        </GuideProvider>
    );
}

export default function ClientLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { theme } = useTheme();

    const [lenis, setLenis] = useState<any>(null);

    const preventLenisOnSide = () => {
        (document.querySelectorAll('aside') || []).forEach(el => {
            el.setAttribute('data-lenis-prevent', '');
        });
    };

    // 注册 Service Worker（PWA / 推送）
    useEffect(() => {
        registerSw();
    }, []);

    // 动态切换PrimeReact主题CSS
    useEffect(() => {
        const lightTheme = '/themes/lara-light-amber/theme.css';
        const darkTheme = '/themes/lara-dark-amber/theme.css';
        const themeLinkId = 'prime-theme-link';

        let link = document.getElementById(themeLinkId) as HTMLLinkElement | null;
        if (!link) {
            link = document.createElement('link');
            link.id = themeLinkId;
            link.rel = 'stylesheet';
            document.head.appendChild(link);
        }
        link.href = theme === 'dark' ? darkTheme : lightTheme;
    }, [theme]);

    return (
        <SessionProvider
            refetchInterval={5 * 60} // 每 5 分钟刷新一次 session（PWA 后台恢复时）
            refetchOnWindowFocus={true} // 窗口聚焦时刷新
        >
            <ToastContextProvider>
                <LoginModalProvider>
                    <OnboardingModalProvider>
                        <NotificationProvider>
                            <ChatProvider>
                                <NotificationPermissionProvider>
                                    <CartProvider>
                                        <GuideWrapper>
                                        <div className="flex flex-col">
                                            {/* 移动端底部导航（学员端）会占据一定高度：为内容预留底部安全区 */}
                                            <main className="flex-grow pb-24 min-h-screen">
                                                {children}
                                            </main>
                                            <Footer />
                                        </div>
                                        </GuideWrapper>
                                    </CartProvider>
                                </NotificationPermissionProvider>
                            </ChatProvider>
                        </NotificationProvider>
                    </OnboardingModalProvider>
                </LoginModalProvider>
            </ToastContextProvider>
        </SessionProvider>
    );
}
