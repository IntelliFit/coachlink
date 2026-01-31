import { useCallback } from "react";
import { analyticsService } from "@/lib/analytics";

export function useAnalytics() {
    const trackEvent = useCallback((
        eventName: string,
        eventCategory: string,
        eventData?: Record<string, unknown>
    ) => {
        analyticsService.track({ eventName, eventCategory, eventData });
    }, []);

    return { trackEvent };
}
