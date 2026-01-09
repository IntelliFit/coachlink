'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ToastContextProvider } from "../context/ToastContext";
import { LoginModalProvider } from './auth/LoginModalContext';
import { OnboardingModalProvider } from './auth/OnboardingModalContext';
import { SessionProvider, useSession } from 'next-auth/react';
import { GuideProvider } from '@/stores/useGuideStore';
import { GuideManager } from '@/components/guide/GuideManager';
import Footer from './Footer';

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
        <SessionProvider>
            <ToastContextProvider>
                <LoginModalProvider>
                    <OnboardingModalProvider>
                        <GuideWrapper>
                            <div className="min-h-screen flex flex-col">
                                <main className="flex-grow">
                                    {children}
                                </main>
                                <Footer />
                            </div>
                        </GuideWrapper>
                    </OnboardingModalProvider>
                </LoginModalProvider>
            </ToastContextProvider>
        </SessionProvider>
    );
}
