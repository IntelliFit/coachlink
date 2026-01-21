'use client';

import React, { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import LoginModal from './LoginModal';
import { useRouter } from 'next/navigation';

type LoginModalContextType = {
    isLoginModalOpen: boolean;
    openLoginModal: () => void;
    closeLoginModal: (back?: boolean) => void;
};

const LoginModalContext = createContext<LoginModalContextType | undefined>(undefined);

export function LoginModalProvider({ children }: { children: ReactNode }) {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    const openLoginModal = useCallback(() => {
        setIsLoginModalOpen(true);
    }, []);

    const router = useRouter();

    const closeLoginModal = useCallback((back: boolean = true) => {
        setIsLoginModalOpen(false);
        if (back) {
            router.back();
        }
    }, [router]);

    const value = useMemo(
        () => ({ isLoginModalOpen, openLoginModal, closeLoginModal }),
        [isLoginModalOpen, openLoginModal, closeLoginModal]
    );

    return (
        <LoginModalContext.Provider value={value}>
            {children}
            <LoginModal 
                isOpen={isLoginModalOpen} 
                onClose={back => closeLoginModal(back)} 
            />
        </LoginModalContext.Provider>
    );
}

export function useLoginModal() {
    const context = useContext(LoginModalContext);
    if (context === undefined) {
        throw new Error('useLoginModal must be used within a LoginModalProvider');
    }
    return context;
}