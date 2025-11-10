'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import ProfileSetupModal from './ProfileSetupModal';
import { UserProfilesRow } from '@/types';

type ProfileSetupModalContextType = {
    isProfileSetupModalOpen: boolean;
    openProfileSetupModal: (profile?: Partial<UserProfilesRow>, userId?: string) => void;
    closeProfileSetupModal: () => void;
};

const ProfileSetupModalContext = createContext<ProfileSetupModalContextType | undefined>(undefined);

export function ProfileSetupModalProvider({ children }: { children: ReactNode }) {
    const [isProfileSetupModalOpen, setIsProfileSetupModalOpen] = useState(false);
    const [initialProfile, setInitialProfile] = useState<Partial<UserProfilesRow> | undefined>(undefined);
    const [userId, setUserId] = useState<string | undefined>(undefined);

    const openProfileSetupModal = (profile?: Partial<UserProfilesRow>, userId?: string) => {
        setInitialProfile(profile);
        setUserId(userId);
        setIsProfileSetupModalOpen(true);
    };

    const closeProfileSetupModal = () => {
        setIsProfileSetupModalOpen(false);
        setInitialProfile(undefined);
        setUserId(undefined);
    };

    return (
        <ProfileSetupModalContext.Provider value={{ 
            isProfileSetupModalOpen, 
            openProfileSetupModal, 
            closeProfileSetupModal 
        }}>
            {children}
            <ProfileSetupModal 
                isOpen={isProfileSetupModalOpen} 
                onClose={closeProfileSetupModal}
                onComplete={() => {
                    closeProfileSetupModal();
                    // 可以在这里添加完成后的回调逻辑
                }}
                initialProfile={initialProfile}
                userId={userId}
            />
        </ProfileSetupModalContext.Provider>
    );
}

export function useProfileSetupModal() {
    const context = useContext(ProfileSetupModalContext);
    if (context === undefined) {
        throw new Error('useProfileSetupModal must be used within a ProfileSetupModalProvider');
    }
    return context;
}