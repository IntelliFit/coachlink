'use client';

import { useEffect, ReactNode, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { ToastContextProvider } from "../context/ToastContext";
import { LoginModalProvider } from './auth/LoginModalContext';
import { SessionProvider } from 'next-auth/react';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import Footer from './Footer';

export default function ClientLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { theme } = useTheme();

    const [lenis, setLenis] = useState<Lenis | null>(null);

    const preventLenisOnSide = () => {
        (document.querySelectorAll('aside') || []).forEach(el => {
            el.setAttribute('data-lenis-prevent', '');
        });
    };

    useEffect(() => {
        const lenisInstance = new Lenis({
            autoRaf: true,
        });

        setLenis(lenisInstance);

        return () => lenisInstance.destroy();
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
        <SessionProvider>
            <ToastContextProvider>
                <LoginModalProvider>
                    <div className="min-h-screen flex flex-col">
                        <main className="flex-grow">
                            {children}
                        </main>
                        <Footer />
                    </div>
                </LoginModalProvider>
            </ToastContextProvider>
        </SessionProvider>
    );
}