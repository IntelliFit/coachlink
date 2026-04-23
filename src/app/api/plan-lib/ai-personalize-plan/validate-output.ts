import { CoachPlanTrainingImplementationDay } from "../create-template/entity";
import { ActionLibraryEntry } from "./entity";

export function validateAndSanitizeTrainingDays(
    rawDays: any[],
    actionLibrary: ActionLibraryEntry[],
): {
    days: CoachPlanTrainingImplementationDay[];
    warnings: string[];
} {
    const warnings: string[] = [];
    const validActionIds = new Set(actionLibrary.map((a) => a.id));

    if (!Array.isArray(rawDays)) {
        throw new Error("LLM 输出的 training_days 不是数组");
    }

    const sanitizedDays: CoachPlanTrainingImplementationDay[] = [];

    for (let i = 0; i < rawDays.length; i++) {
        const day = rawDays[i];

        if (!day || typeof day !== "object") {
            warnings.push(`第 ${i} 个 day 不是对象，已跳过`);
            continue;
        }

        const type = day.type === "rest" ? "rest" : "training";

        if (type === "rest") {
            sanitizedDays.push({
                type: "rest",
                dayIndex: i + 1,
                note: typeof day.note === "string" ? day.note : undefined,
            });
            continue;
        }

        const actionSets: any[] = [];
        const rawActionSets = Array.isArray(day.actionSets) ? day.actionSets : [];

        for (const action of rawActionSets) {
            if (!action || typeof action !== "object") {
                continue;
            }

            const actionId = String(action.actionId || "").trim();

            if (!actionId) {
                warnings.push(`day ${i + 1} 存在缺少 actionId 的动作，已跳过`);
                continue;
            }

            if (!validActionIds.has(actionId)) {
                warnings.push(`day ${i + 1} 的动作 actionId="${actionId}" 不在教练动作库中，已跳过`);
                continue;
            }

            actionSets.push({
                type: "no-filter",
                actionId,
                setName: String(action.setName || "").trim() || actionId,
                params: sanitizeParams(action.params),
            });
        }

        sanitizedDays.push({
            type: "training",
            dayIndex: i + 1,
            note: typeof day.note === "string" ? day.note : undefined,
            actionSets: actionSets.length > 0 ? actionSets : undefined,
        });
    }

    if (sanitizedDays.length === 0) {
        throw new Error("校验后 training_days 为空，无法创建计划");
    }

    return { days: sanitizedDays, warnings };
}

function sanitizeParams(params: any): Record<string, any> {
    if (!params || typeof params !== "object") {
        return {};
    }

    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(params)) {
        if (
            value === null ||
            value === undefined ||
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            result[key] = value;
        }
    }
    return result;
}
