'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createGuide, GUIDE_CONFIGS } from '@/lib/guide-driver';

// Guide keys type
export type GuideKey = keyof typeof GUIDE_CONFIGS;

interface GuideContextType {
  completedGuides: Record<string, boolean>;
  isGuideActive: boolean;
  isLoading: boolean;
  /**
   * True only after we've loaded completion state for the current userId at least once.
   * This prevents guides from firing with an empty completedGuides during session hydration.
   */
  isInitialized: boolean;
  startGuide: (guideKey: GuideKey) => void;
  stopActiveGuide: () => void;
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [startedGuides, setStartedGuides] = useState<Record<string, boolean>>({});
  const [activeDriver, setActiveDriver] = useState<ReturnType<typeof createGuide> | null>(null);

  const getLocalGuidesKey = useCallback(() => {
    if (!userId) return null;
    return `coachlink_guides_completed_${userId}`;
  }, [userId]);

  // Load completed guides from API
  const loadCompletedGuides = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      setIsInitialized(false);
      return;
    }
    setIsLoading(true);
    
    try {
      console.log('[GuideStore] Loading guides for user:', userId);

      // Load local fallback first (prevents repeated guides even if backend column is missing/migration not applied yet)
      let localCompleted: Record<string, boolean> = {};
      try {
        const k = getLocalGuidesKey();
        if (k && typeof window !== 'undefined') {
          localCompleted = JSON.parse(window.localStorage.getItem(k) || '{}') || {};
        }
      } catch (e) {
        console.warn('[GuideStore] Failed to parse local guides:', e);
      }

      const response = await fetch('/api/user/guides-completed');
      if (response.ok) {
        const data = await response.json();
        console.log('[GuideStore] Loaded guides:', data.guidesCompleted);
        const merged = { ...(localCompleted || {}), ...(data.guidesCompleted || {}) };
        setCompletedGuides(merged);

        // Ensure local fallback stays in sync
        try {
          const k = getLocalGuidesKey();
          if (k && typeof window !== 'undefined') {
            window.localStorage.setItem(k, JSON.stringify(merged));
          }
        } catch (e) {
          console.warn('[GuideStore] Failed to persist local guides:', e);
        }
      } else {
        // Fallback to local only
        setCompletedGuides(localCompleted || {});
      }
    } catch (error) {
      console.error('[GuideStore] Failed to load completed guides:', error);
      // Fallback to local only
      try {
        const k = getLocalGuidesKey();
        if (k && typeof window !== 'undefined') {
          const localCompleted = JSON.parse(window.localStorage.getItem(k) || '{}') || {};
          setCompletedGuides(localCompleted);
        }
      } catch (e) {
        console.warn('[GuideStore] Failed to read local guides after API error:', e);
      }
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [userId, getLocalGuidesKey]);

  // Mark a guide as complete
  const markGuideComplete = useCallback(async (guideKey: string) => {
    console.log('[GuideStore] Marking guide complete:', guideKey);
    // Optimistic update
    setCompletedGuides((prev) => ({ ...prev, [guideKey]: true }));

    // Local fallback persistence (prevents repeated guides across refresh)
    try {
      const k = getLocalGuidesKey();
      if (k && typeof window !== 'undefined') {
        const localCompleted = JSON.parse(window.localStorage.getItem(k) || '{}') || {};
        const next = { ...localCompleted, [guideKey]: true };
        window.localStorage.setItem(k, JSON.stringify(next));
      }
    } catch (e) {
      console.warn('[GuideStore] Failed to persist local guide completion:', e);
    }

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

      // Revert local fallback too
      try {
        const k = getLocalGuidesKey();
        if (k && typeof window !== 'undefined') {
          const localCompleted = JSON.parse(window.localStorage.getItem(k) || '{}') || {};
          delete localCompleted[guideKey];
          window.localStorage.setItem(k, JSON.stringify(localCompleted));
        }
      } catch (e) {
        console.warn('[GuideStore] Failed to revert local guides:', e);
      }
    }
  }, [getLocalGuidesKey]);

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

      // Don't start until we've loaded completion state for the current user.
      if (!isInitialized) {
        console.log('[GuideStore] Guide state not initialized yet, skip start');
        return;
      }

      // Don't start until completion state is loaded, otherwise the guide can re-trigger repeatedly.
      if (isLoading) {
        console.log('[GuideStore] Guides still loading, skip start');
        return;
      }
      
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

      // Don't start the same guide more than once per page session.
      if (startedGuides[config.key]) {
        console.log('[GuideStore] Guide already started in this session:', config.key);
        return;
      }

      console.log('[GuideStore] Starting guide:', config.key);
      setIsGuideActive(true);
      setStartedGuides((prev) => ({ ...prev, [config.key]: true }));

      const guide = createGuide({
        key: config.key,
        steps: config.steps,
        onComplete: () => {
          console.log('[GuideStore] Guide completed:', config.key);
          markGuideComplete(config.key);
          setIsGuideActive(false);
          setActiveDriver(null);
        },
        onSkip: () => {
          console.log('[GuideStore] Guide skipped:', config.key);
          markGuideComplete(config.key);
          setIsGuideActive(false);
          setActiveDriver(null);
        },
      });

      setActiveDriver(guide);
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        guide.start();
      }, 500);
    },
    [hasCompletedGuide, isGuideActive, markGuideComplete, isLoading, startedGuides, isInitialized]
  );

  const stopActiveGuide = useCallback(() => {
    if (activeDriver) {
      try {
        activeDriver.destroy();
      } catch (e) {
        console.warn('[GuideStore] Failed to destroy active guide', e);
      }
    }
    setIsGuideActive(false);
    setActiveDriver(null);
  }, [activeDriver]);

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
        isInitialized,
        startGuide,
        stopActiveGuide,
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
