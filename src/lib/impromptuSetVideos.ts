export type ImpromptuSetVideoLite = {
    id: string;
    action_index: number;
    set_number: number;
    video_url: string;
};

function normalizeActions(value: unknown): any[] {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function mergeImpromptuSetVideos<
    T extends { action_executions?: unknown },
>(
    execution: T,
    rows: ImpromptuSetVideoLite[],
): T {
    const videos = new Map<string, ImpromptuSetVideoLite>();
    for (const row of rows || []) {
        const actionIndex = Number(row?.action_index);
        const setNumber = Number(row?.set_number);
        if (!Number.isInteger(actionIndex) || actionIndex < 0) continue;
        if (!Number.isInteger(setNumber) || setNumber < 1 || !row?.video_url) continue;
        videos.set(`${actionIndex}:${setNumber}`, row);
    }

    const actions = normalizeActions(execution.action_executions).map(
        (action: any, actionIndex: number) => ({
            ...action,
            sets: (Array.isArray(action?.sets) ? action.sets : []).map(
                (set: any, setIndex: number) => {
                    const setNumber = Number(
                        set?.set_number ?? set?.setNumber ?? setIndex + 1,
                    );
                    const video = videos.get(`${actionIndex}:${setNumber}`);
                    return video
                        ? {
                            ...set,
                            has_video: true,
                            video_url: video.video_url,
                            video_id: video.id,
                        }
                        : set;
                },
            ),
        }),
    );
    return { ...execution, action_executions: actions };
}
