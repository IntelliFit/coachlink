'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createGuide, GUIDE_CONFIGS } from '@/lib/guide-driver';

// Guide keys type
export type GuideKey = keyof typeof GUIDE_CONFIGS;

interface GuideContextType {
  completedGuides: Record<string, boolean>;
  isGuideActive: boolean;
  isLoading: boolean;
  startGuide: (guideKey: GuideKey) => void;
  markGuideComplete: (guideKey: string) => Promise<void>;
  hasCompletedGuide: (guideKey: string) => boolean;
  loadCompletedGuides: () => Promise<void>;
}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

interface GuideProviderProps {
  children: ReactNode;
  userId?: string;
}

export function GuideProvider({ children, userId }: GuideProviderProps) {
  const [completedGuides, setCompletedGuides] = useState<Record<string, boolean>>({});
  const [isGuideActive, setIsGuideActive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load completed guides from API
  const loadCompletedGuides = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    
    try {
      console.log('[GuideStore] Loading guides for user:', userId);
      const response = await fetch('/api/user/guides-completed');
      if (response.ok) {
        const data = await response.json();
        console.log('[GuideStore] Loaded guides:', data.guidesCompleted);
        setCompletedGuides(data.guidesCompleted || {});
      }
    } catch (error) {
      console.error('[GuideStore] Failed to load completed guides:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Mark a guide as complete
  const markGuideComplete = useCallback(async (guideKey: string) => {
    console.log('[GuideStore] Marking guide complete:', guideKey);
    // Optimistic update
    setCompletedGuides((prev) => ({ ...prev, [guideKey]: true }));

    try {
      await fetch('/api/user/guides-completed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guideKey }),
      });
    } catch (error) {
      console.error('[GuideStore] Failed to save guide completion:', error);
      // Revert on error
      setCompletedGuides((prev) => {
        const next = { ...prev };
        delete next[guideKey];
        return next;
      });
    }
  }, []);

  // Check if a guide is completed
  const hasCompletedGuide = useCallback(
    (guideKey: string) => {
      return !!completedGuides[guideKey];
    },
    [completedGuides]
  );

  // Start a guide
  const startGuide = useCallback(
    (guideKey: GuideKey) => {
      console.log('[GuideStore] startGuide called:', guideKey);
      
      const config = GUIDE_CONFIGS[guideKey];
      if (!config) {
        console.warn(`[GuideStore] Guide config not found for key: ${guideKey}`);
        return;
      }

      // Don't start if already completed
      if (hasCompletedGuide(config.key)) {
        console.log('[GuideStore] Guide already completed:', config.key);
        return;
      }

      // Don't start if another guide is active
      if (isGuideActive) {
        console.log('[GuideStore] Another guide is active, skipping');
        return;
      }

      console.log('[GuideStore] Starting guide:', config.key);
      setIsGuideActive(true);

      const guide = createGuide({
        key: config.key,
        steps: config.steps,
        onComplete: () => {
          console.log('[GuideStore] Guide completed:', config.key);
          markGuideComplete(config.key);
          setIsGuideActive(false);
        },
        onSkip: () => {
          console.log('[GuideStore] Guide skipped:', config.key);
          markGuideComplete(config.key);
          setIsGuideActive(false);
        },
      });

      // Small delay to ensure DOM is ready
      setTimeout(() => {
        guide.start();
      }, 500);
    },
    [hasCompletedGuide, isGuideActive, markGuideComplete]
  );

  // Load guides on mount
  useEffect(() => {
    loadCompletedGuides();
  }, [loadCompletedGuides]);

  return (
    <GuideContext.Provider
      value={{
        completedGuides,
        isGuideActive,
        isLoading,
        startGuide,
        markGuideComplete,
        hasCompletedGuide,
        loadCompletedGuides,
      }}
    >
      {children}
    </GuideContext.Provider>
  );
}

export function useGuideStore() {
  const context = useContext(GuideContext);
  if (context === undefined) {
    throw new Error('useGuideStore must be used within a GuideProvider');
  }
  return context;
}
