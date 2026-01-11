'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGuideStore } from '@/stores/useGuideStore';
import { useSession } from 'next-auth/react';
import { useOnboardingModal } from '@/components/auth/OnboardingModalContext';

interface GuideManagerProps {
  userRole?: 'coach' | 'student';
}

/**
 * GuideManager: Logic-only component that triggers guides based on route and context.
 * Place this in your dashboard layout to enable automatic guide triggering.
 */
export function GuideManager({ userRole }: GuideManagerProps) {
  const pathname = usePathname();
  const { startGuide, stopActiveGuide, hasCompletedGuide, completedGuides, isLoading, isGuideActive } = useGuideStore();
  const { data: session } = useSession();
  const { isOnboardingModalOpen } = useOnboardingModal();
  const [hasTriggeredOnboarding, setHasTriggeredOnboarding] = useState(false);
  const [hasTriggeredContextual, setHasTriggeredContextual] = useState<Record<string, boolean>>({});

  // Prevent guides from interrupting critical flows (e.g., profile onboarding dialog)
  const shouldPauseGuides = !!isOnboardingModalOpen;

  const isStudentProfileIncomplete =
    userRole === 'student' && (session?.profile as any)?.onboarding_completed !== true;

  // If a guide is已经显示且打开了 Onboarding，强制关闭 guide 避免挡住问卷
  useEffect(() => {
    if (shouldPauseGuides && isGuideActive) {
      stopActiveGuide();
    }
  }, [shouldPauseGuides, isGuideActive, stopActiveGuide]);

  // Debug logging
  useEffect(() => {
    console.log('[GuideManager] userRole:', userRole, 'pathname:', pathname);
    console.log('[GuideManager] completedGuides:', completedGuides);
    console.log('[GuideManager] isLoading:', isLoading, 'isGuideActive:', isGuideActive);
    console.log('[GuideManager] pause:', shouldPauseGuides, 'profileIncomplete:', isStudentProfileIncomplete);
  }, [userRole, pathname, completedGuides, isLoading, isGuideActive, shouldPauseGuides, isStudentProfileIncomplete]);

  // Trigger onboarding guide based on role
  useEffect(() => {
    // IMPORTANT: Wait until completedGuides is loaded, otherwise guides may re-trigger on every refresh.
    if (isLoading) return;
    if (!userRole || hasTriggeredOnboarding) return;
    if (isGuideActive) return;
    if (shouldPauseGuides) return;

    // Don't start student tour while the user is still filling the mandatory onboarding profile modal
    if (isStudentProfileIncomplete) return;

    // Wait for initial render to complete
    const timer = setTimeout(() => {
      console.log('[GuideManager] Checking if should trigger guide...');
      
      if (userRole === 'coach') {
        if (!hasCompletedGuide('coach_onboarding')) {
          console.log('[GuideManager] Triggering COACH_ONBOARDING');
          startGuide('COACH_ONBOARDING');
          setHasTriggeredOnboarding(true);
        }
      } else if (userRole === 'student') {
        if (!hasCompletedGuide('student_onboarding')) {
          console.log('[GuideManager] Triggering STUDENT_ONBOARDING');
          startGuide('STUDENT_ONBOARDING');
          setHasTriggeredOnboarding(true);
        }
      }
    }, 2000); // Wait 2 seconds for page to fully load

    return () => clearTimeout(timer);
  }, [userRole, hasCompletedGuide, startGuide, hasTriggeredOnboarding, isLoading, isGuideActive, shouldPauseGuides, isStudentProfileIncomplete]);

  // Trigger contextual guides based on specific pages
  useEffect(() => {
    if (!pathname) return;
    if (isLoading) return;
    if (isGuideActive) return;
    if (shouldPauseGuides) return;

    // Student: Find coach guide (discovery page)
    if (pathname === '/coach/discovery') {
      if (!hasCompletedGuide('student_find_coach') && !hasTriggeredContextual['student_find_coach']) {
        setHasTriggeredContextual((prev) => ({ ...prev, student_find_coach: true }));
        setTimeout(() => startGuide('STUDENT_FIND_COACH_GUIDE'), 800);
      }
    }

    // Plan Editor Guide (coach & student create flows)
    if (
      pathname.includes('/dashboard/plan-lib') ||
      pathname.includes('/me/plan-lib/create') ||
      (pathname.includes('/plan-lib') && pathname.includes('/create'))
    ) {
      if (!hasCompletedGuide('plan_editor') && !hasTriggeredContextual['plan_editor']) {
        setHasTriggeredContextual((prev) => ({ ...prev, plan_editor: true }));
        setTimeout(() => startGuide('PLAN_EDITOR_GUIDE'), 800);
      }
    }

  // Execution Guide - only trigger on actual execution page (avoid interrupting /today-training onboarding)
  if (pathname.includes('/training-execution')) {
      if (!hasCompletedGuide('execution') && !hasTriggeredContextual['execution']) {
        setHasTriggeredContextual((prev) => ({ ...prev, execution: true }));
        setTimeout(() => startGuide('EXECUTION_GUIDE'), 800);
      }
    }

    // Chat Guide
    if (pathname.includes('/chat') || pathname.includes('/messages')) {
      if (!hasCompletedGuide('chat') && !hasTriggeredContextual['chat']) {
        setHasTriggeredContextual((prev) => ({ ...prev, chat: true }));
        setTimeout(() => startGuide('CHAT_GUIDE'), 800);
      }
    }

    // Subscription flow guide (student) - coach profile purchase page
    if (pathname.includes('/coach/profile/')) {
      if (!hasCompletedGuide('student_subscribe_flow') && !hasTriggeredContextual['student_subscribe_flow']) {
        setHasTriggeredContextual((prev) => ({ ...prev, student_subscribe_flow: true }));
        setTimeout(() => startGuide('STUDENT_SUBSCRIBE_FLOW_GUIDE'), 1200);
      }
    }

    // Subscription status guide (student) - subscription list page
    if (pathname === '/coach/subscription') {
      if (!hasCompletedGuide('student_subscription_status') && !hasTriggeredContextual['student_subscription_status']) {
        setHasTriggeredContextual((prev) => ({ ...prev, student_subscription_status: true }));
        setTimeout(() => startGuide('STUDENT_SUBSCRIPTION_STATUS_GUIDE'), 1200);
      }
    }
  }, [pathname, startGuide, hasCompletedGuide, isLoading, isGuideActive, hasTriggeredContextual, shouldPauseGuides]);

  // This is a logic-only component, no UI
  return null;
}
