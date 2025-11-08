'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<Theme>('light');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // 检查本地存储中的主题设置
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        if (storedTheme) {
            setTheme(storedTheme);
        } else {
            // 检查系统偏好
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setTheme(systemPrefersDark ? 'dark' : 'light');
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        // 应用主题到DOM
        document.documentElement.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('theme', theme);
    }, [theme, mounted]);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    // 防止客户端和服务端渲染不一致导致的闪烁
    if (!mounted) {
        return null;
    }

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}