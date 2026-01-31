
type TrackEventParams = {
    eventName: string;
    eventCategory: string; // 'training' | 'social' | 'subscription' | 'system' | ...
    eventData?: Record<string, unknown>;
    deviceType?: string;
};

class AnalyticsService {
    private static instance: AnalyticsService;

    private constructor() {}

    public static getInstance(): AnalyticsService {
        if (!AnalyticsService.instance) {
            AnalyticsService.instance = new AnalyticsService();
        }
        return AnalyticsService.instance;
    }

    public async track(params: TrackEventParams) {
        try {
            // 获取当前页面路径
            const pagePath = typeof window !== "undefined" ? window.location.pathname : "";

            const body = {
                event_name: params.eventName,
                event_category: params.eventCategory,
                event_data: params.eventData,
                page_path: pagePath,
                device_type: params.deviceType || "web",
            };

            await fetch("/api/trace/behavior", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(body),
            });
        } catch (error) {
            console.error("Failed to track event:", error);
            // 埋点失败不应阻断业务流，静默处理
        }
    }
}

export const analyticsService = AnalyticsService.getInstance();
