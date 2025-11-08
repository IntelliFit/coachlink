'use client';

import React, { useEffect, ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useLanguage } from '@/context/LanguageContext';
import { PrimeReactProvider } from 'primereact/api';
import 'primeicons/primeicons.css';

export default function ClientLayout({
    children,
}: {
    children: ReactNode;
}) {
    const { theme } = useTheme();
    const { language } = useLanguage();

    // 动态切换PrimeReact主题CSS
    useEffect(() => {
        const lightTheme = '/themes/lara-light-blue/theme.css';
        const darkTheme = '/themes/lara-dark-blue/theme.css';
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
        <PrimeReactProvider value={{
            ripple: true,
            locale: language,
        }}>
            <div className="min-h-screen">
                {children}
            </div>
        </PrimeReactProvider>
    );
}