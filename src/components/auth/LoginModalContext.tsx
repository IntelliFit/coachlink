'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import LoginModal from './LoginModal';
import { useRouter } from 'next/navigation';

type LoginModalContextType = {
    isLoginModalOpen: boolean;
    openLoginModal: () => void;
    closeLoginModal: () => void;
};

const LoginModalContext = createContext<LoginModalContextType | undefined>(undefined);

export function LoginModalProvider({ children }: { children: ReactNode }) {
    const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

    const openLoginModal = () => {
        setIsLoginModalOpen(true);
    };

    const router = useRouter();

    const closeLoginModal = () => {
        setIsLoginModalOpen(false);
        setTimeout(() => {
            router.back();
        }, 0);
    };

    return (
        <LoginModalContext.Provider value={{ isLoginModalOpen, openLoginModal, closeLoginModal }}>
            {children}
            <LoginModal 
                isOpen={isLoginModalOpen} 
                onClose={closeLoginModal} 
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