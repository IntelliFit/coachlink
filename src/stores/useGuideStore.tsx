'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createGuide, GUIDE_CONFIGS, type GuideInstance } from '@/lib/guide-driver';

// Guide keys type
export type GuideKey = keyof typeof GUIDE_CONFIGS;

interface GuideContextType {
    completedGuides: Record<string, boolean>;
    isGuideActive: boolean;
    isLoading: boolean;
    isInitialized: boolean;
    isPaused: boolean;
    startGuide: (guideKey: GuideKey, forceShow?: boolean) => void;
    stopActiveGuide: () => void;
    markGuideComplete: (guideKey: string) => Promise<void>;
    hasCompletedGuide: (guideKey: string) => boolean;
    loadCompletedGuides: () => Promise<void>;
    pauseGuides: () => void;
    resumeGuides: () => void;
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
    const [isPaused, setIsPaused] = useState(false);
    const [startedGuides, setStartedGuides] = useState<Record<string, boolean>>({});
    const [activeDriver, setActiveDriver] = useState<GuideInstance | null>(null);

    const getLocalGuidesKey = useCallback(() => {
        if (!userId) return null;
        return `coachlink_guides_completed_${userId}`;
    }, [userId]);

    // Load completed guides from API
    const loadCompletedGuides = useCallback(async () => {
        if (!userId) {
            setIsLoading(false);
            return;
        }

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

    const pauseGuides = useCallback(() => {
        setIsPaused(true);
        // 如果有正在运行的 guide，也关掉
        if (activeDriver) {
            try { activeDriver.destroy(); } catch (_) { /* silent */ }
        }
        setIsGuideActive(false);
        setActiveDriver(null);
    }, [activeDriver]);

    const resumeGuides = useCallback(() => {
        setIsPaused(false);
    }, []);

    // Start a guide
    const startGuide = useCallback(
        (guideKey: GuideKey, forceShow: boolean = false) => {
            console.log('[GuideStore] startGuide called:', guideKey, 'forceShow:', forceShow);
            // Don't start until completion state is loaded, otherwise the guide can re-trigger repeatedly.
            if (isLoading) {
                console.log('[GuideStore] Guides still loading, skip start');
                return;
            }

            // 全局暂停状态（例如正在弹 Onboarding 问卷）
            if (isPaused) {
                console.log('[GuideStore] Guides are paused, skip start');
                return;
            }

            const config = GUIDE_CONFIGS[guideKey];
            if (!config) {
                console.warn(`[GuideStore] Guide config not found for key: ${guideKey}`);
                return;
            }

            // Don't start if already completed (unless forced)
            if (!forceShow && hasCompletedGuide(config.key)) {
                console.log('[GuideStore] Guide already completed:', config.key);
                return;
            }

            // Don't start if another guide is active
            if (isGuideActive) {
                console.log('[GuideStore] Another guide is active, skipping');
                return;
            }

            // Don't start the same guide more than once per page session (unless forced).
            if (!forceShow && startedGuides[config.key]) {
                console.log('[GuideStore] Guide already started in this session:', config.key);
                return;
            }

            console.log('[GuideStore] Starting guide:', config.key);
            setIsGuideActive(true);
            // Only update startedGuides if not forcing
            if (!forceShow) {
              setStartedGuides((prev) => ({ ...prev, [config.key]: true }));
            } else {
              // If forcing, reset the started state for this guide
              setStartedGuides((prev) => ({ ...prev, [config.key]: true }));
            }

            void (async () => {
                try {
                    const guide = await createGuide({
                        key: config.key,
                        steps: config.steps,
                        onComplete: () => {
                            console.log('[GuideStore] Guide completed:', config.key);
                            if (!forceShow) {
                              markGuideComplete(config.key);
                            }
                            setIsGuideActive(false);
                            setActiveDriver(null);
                        },
                        onSkip: () => {
                            console.log('[GuideStore] Guide skipped:', config.key);
                            if (!forceShow) {
                              markGuideComplete(config.key);
                            }
                            setIsGuideActive(false);
                            setActiveDriver(null);
                        },
                    });
                    setActiveDriver(guide);
                    setTimeout(() => {
                        guide.start();
                    }, 500);
                } catch (e) {
                    console.warn('[GuideStore] Failed to load or start guide:', e);
                    setIsGuideActive(false);
                    setActiveDriver(null);
                }
            })();
        },
        [hasCompletedGuide, isGuideActive, markGuideComplete, isLoading, isPaused, startedGuides]
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
                isPaused,
                startGuide,
                stopActiveGuide,
                markGuideComplete,
                hasCompletedGuide,
                loadCompletedGuides,
                pauseGuides,
                resumeGuides,
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
