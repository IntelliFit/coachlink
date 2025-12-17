import supabase from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";


export async function matchPlan(questionare: TrainingItem[]) {
    let query = supabase.from('coach_plan_templates')
        .select('*');
    
    const tagsInfo = questionare.find(item => item.type === 'tags');
    if (tagsInfo) {
        query = query.contains('tags', tagsInfo.userSelections);
    }

    const timesInfo = questionare.find(item => item.type === 'times');
    if (timesInfo) {
        query = query.contains('times', timesInfo.userSelection);
    }
    
    const optionInfos = questionare.filter(item => item.type === 'option');
    for (const optionInfo of optionInfos) {
        query = query.contains('contained_options', optionInfo.question);
    }

    const { data: planTemplates, error: planTemplatesError } = await query;

    if (planTemplatesError) {
        console.error(planTemplatesError);
        return null;
    }

    return planTemplates;
}