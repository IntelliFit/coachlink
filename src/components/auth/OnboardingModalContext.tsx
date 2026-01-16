'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import OnboardingModal from './OnboardingModal';

type OnboardingModalContextType = {
    isOnboardingModalOpen: boolean;
    openOnboardingModal: () => void;
    closeOnboardingModal: () => void;
    suppressOnboardingModalOnce: () => void;
    clearOnboardingSuppression: () => void;
};

const OnboardingModalContext = createContext<OnboardingModalContextType | undefined>(undefined);

export function OnboardingModalProvider({ children }: { children: ReactNode }) {
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
    // When true, we will not auto-open the onboarding modal until caller clears it.
    // This prevents "无法关闭" caused by stale NextAuth session.profile.onboarding_completed.
    const [suppressedUntilCleared, setSuppressedUntilCleared] = useState(false);

    const openOnboardingModal = () => {
        if (suppressedUntilCleared) {
            return;
        }
        setIsOnboardingModalOpen(true);
    };

    const closeOnboardingModal = () => {        
        setIsOnboardingModalOpen(false);
    };

    const suppressOnboardingModalOnce = () => {
        setSuppressedUntilCleared(true);
    };

    const clearOnboardingSuppression = () => {
        setSuppressedUntilCleared(false);
    };

    return (
        <OnboardingModalContext.Provider value={{ isOnboardingModalOpen, openOnboardingModal, closeOnboardingModal, suppressOnboardingModalOnce, clearOnboardingSuppression }}>
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
