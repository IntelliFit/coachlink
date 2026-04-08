export const COACH_TRACK_OPTIONS = [
    {
        value: "buddy",
        label: "训练搭子",
        shortLabel: "搭子",
        description: "适合帮助小白跨过进门焦虑，熟悉器械、环境和基础动作。",
    },
    {
        value: "growth",
        label: "进阶教练",
        shortLabel: "进阶",
        description: "适合已有一定经验的训练者，提供计划调整、动作修正和持续陪练。",
    },
    {
        value: "professional",
        label: "专业教练",
        shortLabel: "专业",
        description: "适合做系统周期化训练、高阶专项、竞技表现和高客单服务。",
    },
] as const;

export const SERVICE_MODE_OPTIONS = [
    { value: "online", label: "线上指导" },
    { value: "offline", label: "线下带练" },
    { value: "hybrid", label: "线上 + 线下结合" },
] as const;

export const TARGET_STUDENT_LEVEL_OPTIONS = [
    { value: "beginner", label: "小白入门" },
    { value: "intermediate", label: "进阶提升" },
    { value: "advanced", label: "高阶表现" },
] as const;

export type CoachTrackValue = (typeof COACH_TRACK_OPTIONS)[number]["value"];
export type ServiceModeValue = (typeof SERVICE_MODE_OPTIONS)[number]["value"];
export type TargetStudentLevelValue =
    (typeof TARGET_STUDENT_LEVEL_OPTIONS)[number]["value"];

const coachTrackSet = new Set<string>(COACH_TRACK_OPTIONS.map((item) => item.value));
const serviceModeSet = new Set<string>(
    SERVICE_MODE_OPTIONS.map((item) => item.value),
);
const targetStudentLevelSet = new Set<string>(
    TARGET_STUDENT_LEVEL_OPTIONS.map((item) => item.value),
);

export function sanitizeCoachTrack(
    value: unknown,
): CoachTrackValue | "professional" {
    return typeof value === "string" && coachTrackSet.has(value)
        ? (value as CoachTrackValue)
        : "professional";
}

export function sanitizeServiceModes(value: unknown): ServiceModeValue[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value.filter(
                (item): item is ServiceModeValue =>
                    typeof item === "string" && serviceModeSet.has(item),
            ),
        ),
    );
}

export function sanitizeTargetStudentLevels(
    value: unknown,
): TargetStudentLevelValue[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(
        new Set(
            value.filter(
                (item): item is TargetStudentLevelValue =>
                    typeof item === "string" && targetStudentLevelSet.has(item),
            ),
        ),
    );
}

export function getCoachTrackLabel(value: string | null | undefined) {
    return COACH_TRACK_OPTIONS.find((item) => item.value === value)?.label || "未分层";
}

export function getCoachTrackShortLabel(value: string | null | undefined) {
    return (
        COACH_TRACK_OPTIONS.find((item) => item.value === value)?.shortLabel ||
        "未分层"
    );
}

export function getServiceModeLabel(value: string | null | undefined) {
    return SERVICE_MODE_OPTIONS.find((item) => item.value === value)?.label || value || "未知";
}

export function getTargetStudentLevelLabel(value: string | null | undefined) {
    return (
        TARGET_STUDENT_LEVEL_OPTIONS.find((item) => item.value === value)?.label ||
        value ||
        "未知"
    );
}
