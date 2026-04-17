import { CoachPlanTrainingImplementationDay } from "../create-template/entity";
import { ActionLibraryEntry } from "./entity";

/**
 * 验证并清理 LLM 输出的 training_days
 *
 * 1. JSON Schema 结构校验
 * 2. actionId 白名单过滤（只允许使用教练动作库中存在的 actionId）
 * 3. 如果 dayIndex 不连续，自动重新编号
 */
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

        // 基本结构校验
        if (!day || typeof day !== "object") {
            warnings.push(`第 ${i} 个 day 不是对象，已跳过`);
            continue;
        }

        const type = day.type === "rest" ? "rest" : "training";

        // 处理 rest 日
        if (type === "rest") {
            sanitizedDays.push({
                type: "rest",
                dayIndex: i + 1,
                note: typeof day.note === "string" ? day.note : undefined,
            });
            continue;
        }

        // 处理 training 日
        const actionSets: any[] = [];
        const rawActionSets = Array.isArray(day.actionSets) ? day.actionSets : [];

        for (const action of rawActionSets) {
            if (!action || typeof action !== "object") {
                continue;
            }

            // 只接受 no-filter 类型（LLM 不应输出 one-filter）
            const actionType = action.type === "no-filter" ? "no-filter" : "no-filter";
            const actionId = String(action.actionId || "").trim();

            if (!actionId) {
                warnings.push(`day ${i + 1} 存在缺少 actionId 的动作，已跳过`);
                continue;
            }

            // 白名单过滤
            if (!validActionIds.has(actionId)) {
                warnings.push(
                    `day ${i + 1} 的动作 actionId="${actionId}" 不在教练动作库中，已跳过`,
                );
                continue;
            }

            actionSets.push({
                type: actionType,
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
        // 过滤掉非法值，保留基本类型
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
