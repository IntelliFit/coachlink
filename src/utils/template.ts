import { CoachPlanTrainingDay } from "@/app/api/plan-lib/create-template/entity";

export function makeWeekDays(trainingDays: CoachPlanTrainingDay[]) {
    const weekDays: number[] = [];
    // 每七天为间隔进行计算
    for (let i = 0; i < trainingDays.length; i ++) {
        const weekId = Math.ceil((i + 1) / 7) - 1;
        if (weekDays[weekId] === undefined) {
            weekDays[weekId] = 0;
        }
        if (trainingDays[i].type === 'training') {
            weekDays[weekId] ++;
        }
    }

    return weekDays;
}

export function makeContainedOptions(trainingDays: CoachPlanTrainingDay[]) {
    
}