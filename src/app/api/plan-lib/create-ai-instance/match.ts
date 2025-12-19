import supabase from "@/lib/supabaseClient";
import { CoachPlanTemplateRow } from "@/types";
import { TrainingItem } from "@/types/questionnaires";
import { CoachPlanAction, CoachPlanTrainingDay } from "../create-template/entity";

export async function matchPlan(questionare: TrainingItem[]) {
    let query = supabase.from('coach_plan_templates')
        .select('*');
    
    console.log(questionare);
    
    const tagsInfo = questionare.find(item => item.type === 'tags');
    if (tagsInfo) {
        query = query.contains('tags', tagsInfo.userSelections);
    }

    const timesInfo = questionare.find(item => item.type === 'times');
    if (timesInfo) {
        query = query.contains('week_days', [timesInfo.userSelection]);
    }
    
    const optionInfos = questionare.filter(item => item.type === 'option');
    for (const optionInfo of optionInfos) {
        query = query.contains('contained_options', [optionInfo.question]);
    }

    const { data: planTemplates, error: planTemplatesError } = await query;

    if (planTemplatesError) {
        console.error(planTemplatesError);
        return null;
    }

    return planTemplates;
}

export async function fillTemplate(answers: TrainingItem[], template: CoachPlanTemplateRow) {
    // 为 answers 中的 options 建立索引
    const optionNameMapUserSelection: Record<string, number> = {};
    for (const optionInfo of answers.filter(item => item.type === 'option')) {
        optionNameMapUserSelection[optionInfo.question] = optionInfo.userSelection;
    }

    const trainingItems = template.training_days as unknown as CoachPlanTrainingDay[];
    for (const day of trainingItems) {
        const specificActionSet = [] as CoachPlanAction[];

        for (const actionSet of day.actionSets) {
            if (actionSet.type === 'one-filter') {
                const question = actionSet.question;
                const userSelection = optionNameMapUserSelection[question.question];
                const selectedAction = actionSet.actions[userSelection];
                specificActionSet.push(selectedAction);

            } else if (actionSet.type === 'no-filter') {
                specificActionSet.push(actionSet);
            }
        }

        day.actionSets = specificActionSet;
    }
}