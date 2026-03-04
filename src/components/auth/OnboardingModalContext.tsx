'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import OnboardingModal from './OnboardingModal';
import type { UserProfilesRow } from '@/types';

type OnboardingModalContextType = {
    isOnboardingModalOpen: boolean;
    openOnboardingModal: (existingProfile?: Partial<UserProfilesRow> | null) => void;
    closeOnboardingModal: () => void;
    suppressOnboardingModalOnce: () => void;
    clearOnboardingSuppression: () => void;
};

const OnboardingModalContext = createContext<OnboardingModalContextType | undefined>(undefined);

export function OnboardingModalProvider({ children }: { children: ReactNode }) {
    const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState(false);
    const [existingProfile, setExistingProfile] = useState<Partial<UserProfilesRow> | null>(null);
    // When true, we will not auto-open the onboarding modal until caller clears it.
    // This prevents "无法关闭" caused by stale NextAuth session.profile.onboarding_completed.
    const [suppressedUntilCleared, setSuppressedUntilCleared] = useState(false);

    const openOnboardingModal = (profile?: Partial<UserProfilesRow> | null) => {
        if (suppressedUntilCleared) {
            return;
        }
        if (profile) setExistingProfile(profile);
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
                initialProfile={existingProfile}
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
