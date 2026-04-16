import { CoachPlanTrainingDay } from "@/app/api/plan-lib/create-template/entity";

interface ValidInfo {
    valid: boolean;
    message: string;
    data: any;
}

export function validateTrainingDaysPresence(trainingDays: unknown): ValidInfo {
    if (!Array.isArray(trainingDays) || trainingDays.length === 0) {
        return {
            valid: false,
            message: "训练计划至少需要保留 1 天，已阻止空计划写入",
            data: null,
        };
    }

    return {
        valid: true,
        message: "训练计划天数有效",
        data: null,
    };
}

/**
 * 检查训练日数据有效性
 * 对于力量训练类型，需要验证 actionId
 * 对于饮食/有氧/习惯类型，actionId 可为空（使用 custom_data）
 */
export function checkTrainingDays(
    trainingDays: CoachPlanTrainingDay[],
): ValidInfo {
    const presenceInfo = validateTrainingDaysPresence(trainingDays);
    if (!presenceInfo.valid) {
        return presenceInfo;
    }

    // 可选类型选项中必须至少含有一个 action_id（仅力量类型）
    for (let i = 0; i < trainingDays.length; i++) {
        const day = trainingDays[i];
        if (day.type === "training") {
            const actionSets = Array.isArray(day.actionSets) ? day.actionSets : [];
            for (let j = 0; j < actionSets.length; j++) {
                const actionSet = actionSets[j];
                if (actionSet.type === "one-filter") {
                    for (let k = 0; k < actionSet.actions.length; k++) {
                        const action = actionSet.actions[k] as any;
                        // 跳过非力量类型项目的 actionId 验证
                        const itemType = action.itemType || "STRENGTH";
                        if (itemType !== "STRENGTH") continue;

                        if (!action.actionId) {
                            const dayIndex = (i % 7) + 1;
                            const weekIndex = Math.ceil((i + 1) / 7);
                            const actionSetIndex = j + 1;
                            const optionName = actionSet.question.options[k];

                            return {
                                valid: false,
                                message:
                                    `你需要为 W${weekIndex}D${dayIndex} 第${actionSetIndex}个动作集的选项 ${optionName} 设置一个动作`,
                                data: { dayIndex, weekIndex, actionSetIndex },
                            };
                        }
                    }
                }
            }
        }
    }

    return {
        valid: true,
        message: "有效的训练计划",
        data: null,
    };
}

export function makeWeekDays(trainingDays: Array<Pick<CoachPlanTrainingDay, "type">>) {
    const weekDays: number[] = [];
    // 每七天为间隔进行计算
    for (let i = 0; i < trainingDays.length; i++) {
        const weekId = Math.ceil((i + 1) / 7) - 1;
        if (weekDays[weekId] === undefined) {
            weekDays[weekId] = 0;
        }
        if (trainingDays[i].type === "training") {
            weekDays[weekId]++;
        }
    }

    return weekDays;
}

export function makeContainedOptions(trainingDays: CoachPlanTrainingDay[]) {
    const options = [];
    for (const day of trainingDays) {
        if (day.type === "training") {
            for (const actionSet of day.actionSets) {
                if (actionSet.type === "one-filter") {
                    options.push(actionSet.question.question);
                }
            }
        }
    }

    return [...new Set(options)];
}
