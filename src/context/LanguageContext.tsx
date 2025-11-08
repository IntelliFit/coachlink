'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import i18n from '@/lib/i18n';

interface LanguageContextType {
    language: string;
    changeLanguage: (lng: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguage] = useState<string>('en');

    useEffect(() => {
        // 检查本地存储中的语言设置
        const storedLanguage = localStorage.getItem('language');
        if (storedLanguage) {
            setLanguage(storedLanguage);
            i18n.changeLanguage(storedLanguage);
        }
    }, []);

    const changeLanguage = (lng: string) => {
        setLanguage(lng);
        i18n.changeLanguage(lng);
        localStorage.setItem('language', lng);
    };

    return (
        <LanguageContext.Provider value={{ language, changeLanguage }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}