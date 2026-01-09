'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useGuideStore, GuideKey } from '@/stores/useGuideStore';

interface GuideManagerProps {
  userRole?: 'coach' | 'student';
}

/**
 * GuideManager: Logic-only component that triggers guides based on route and context.
 * Place this in your dashboard layout to enable automatic guide triggering.
 */
export function GuideManager({ userRole }: GuideManagerProps) {
  const pathname = usePathname();
  const { startGuide, hasCompletedGuide, completedGuides } = useGuideStore();
  const [hasTriggeredOnboarding, setHasTriggeredOnboarding] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('[GuideManager] userRole:', userRole, 'pathname:', pathname);
    console.log('[GuideManager] completedGuides:', completedGuides);
  }, [userRole, pathname, completedGuides]);

  // Trigger onboarding guide based on role
  useEffect(() => {
    if (!userRole || hasTriggeredOnboarding) return;

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
  }, [userRole, hasCompletedGuide, startGuide, hasTriggeredOnboarding]);

  // Trigger contextual guides based on specific pages
  useEffect(() => {
    if (!pathname) return;

    // Plan Editor Guide
    if (pathname.includes('/plan-lib') && pathname.includes('/new')) {
      if (!hasCompletedGuide('plan_editor')) {
        setTimeout(() => startGuide('PLAN_EDITOR_GUIDE'), 1000);
      }
    }

    // Execution Guide - triggered when entering training execution
    if (pathname.includes('/training/execute')) {
      if (!hasCompletedGuide('execution')) {
        setTimeout(() => startGuide('EXECUTION_GUIDE'), 1000);
      }
    }

    // Chat Guide
    if (pathname.includes('/chat') || pathname.includes('/messages')) {
      if (!hasCompletedGuide('chat')) {
        setTimeout(() => startGuide('CHAT_GUIDE'), 1000);
      }
    }
  }, [pathname, startGuide, hasCompletedGuide]);

  // This is a logic-only component, no UI
  return null;
}
