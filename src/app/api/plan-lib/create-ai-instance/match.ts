import supabase from "@/lib/supabaseClient";
import { TrainingItem } from "@/types/questionnaires";

async function walkTags(query) {

}

async function walkTimes(query) {
    
}

async function walkOption(params:type) {
    
}


export async function matchPlan(questionare: TrainingItem[]) {
    let query = supabase.from('coach_plan_templates')
        .select('*');
    
    // 根据条件构建查询管道
    query = await walkTags(query);
    query = await walkTimes(query);
    query = await walkOption(query);

    
}