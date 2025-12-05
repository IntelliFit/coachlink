'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import OnboardingModal from './OnboardingModal';

type OnboardingModalContextType = {
    isOnboardingModalOpen: boolean;
    openOnboardingModal: () => void;
    closeOnboardingModal: () => void;
};

const OnboardingModalContext = createContext<OnboardingModalContextType | undefined>(undefined);

export function OnboardingModalProvider({ children }: { children: ReactNode }) {
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);

    const openOnboardingModal = () => {
        setIsOnboardingModalOpen(true);
    };

    const closeOnboardingModal = () => {
        setIsOnboardingModalOpen(false);
    };

    return (
        <OnboardingModalContext.Provider value={{ isOnboardingModalOpen, openOnboardingModal, closeOnboardingModal }}>
            {children}
            <OnboardingModal 
                isOpen={isOnboardingModalOpen} 
                onClose={closeOnboardingModal} 
            />
        </OnboardingModalContext.Provider>
    );
}

export function useOnboardingModal() {
    const context = useContext(OnboardingModalContext);
    if (context === undefined) {
        throw new Error('useOnboardingModal must be used within an OnboardingModalProvider');
    }
    return context;
}
