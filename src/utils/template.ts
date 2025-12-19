import { CoachPlanTrainingDay } from "@/app/api/plan-lib/create-template/entity";

interface ValidInfo {
    valid: boolean;
    message: string;
    data: any;
}

export function checkTrainingDays(trainingDays: CoachPlanTrainingDay[]): ValidInfo {
    // 可选类型选项中必须至少含有一个 action_id
    for (let i = 0; i < trainingDays.length; i++) {
        const day = trainingDays[i];
        if (day.type === 'training') {
            for (let j = 0; j < day.actionSets.length; j++) {
                const actionSet = day.actionSets[j];
                if (actionSet.type === 'one-filter') {
                    for (let k = 0; k < actionSet.actions.length; k++) {
                        const action = actionSet.actions[k];
                        if (!action.actionId) {
                            const dayIndex = (i % 7) + 1;
                            const weekIndex = Math.ceil((i + 1) / 7);
                            const actionSetIndex = j + 1;
                            const optionName = actionSet.question.options[k];

                            return {
                                valid: false,
                                message: `你需要为 W${weekIndex}D${dayIndex} 第${actionSetIndex}个动作集的选项 ${optionName} 设置一个动作`,
                                data: { dayIndex, weekIndex, actionSetIndex }
                            }
                        }
                    }
                }
            }
        }
    }

    return {
        valid: true,
        message: '有效的训练计划',
        data: null
    }
}

export function makeWeekDays(trainingDays: CoachPlanTrainingDay[]) {
    const weekDays: number[] = [];
    // 每七天为间隔进行计算
    for (let i = 0; i < trainingDays.length; i++) {
        const weekId = Math.ceil((i + 1) / 7) - 1;
        if (weekDays[weekId] === undefined) {
            weekDays[weekId] = 0;
        }
        if (trainingDays[i].type === 'training') {
            weekDays[weekId]++;
        }
    }

    return weekDays;
}

export function makeContainedOptions(trainingDays: CoachPlanTrainingDay[]) {
    const options = [];
    for (const day of trainingDays) {
        if (day.type === 'training') {
            for (const actionSet of day.actionSets) {
                if (actionSet.type === 'one-filter') {
                    options.push(actionSet.question.question);
                }
            }
        }
    }

    return [...new Set(options)];
}