'use client';

import { useEffect, ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ToastContextProvider } from "./ToastContext";
import { LoginModalProvider } from './auth/LoginModalContext';
import { SessionProvider } from 'next-auth/react';

export default function ClientLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { theme } = useTheme();

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
                    <div className="min-h-screen">
                        {children}
                    </div>
                </LoginModalProvider>
            </ToastContextProvider>
        </SessionProvider>
    );
}