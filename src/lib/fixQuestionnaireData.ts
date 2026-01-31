/**
 * 修复问卷数据不一致问题
 * 确保 status 和 is_active 保持一致
 */

import supabase from "@/lib/supabaseClient";

/**
 * 修复单个教练的问卷数据不一致问题
 */
export async function fixCoachQuestionnaireData(coachUserId: string): Promise<{
    success: boolean;
    fixed: number;
    errors: string[];
}> {
    const errors: string[] = [];
    let fixed = 0;

    try {
        // 1. 获取该教练的所有问卷
        const { data: questionnaires, error: fetchError } = await supabase
            .from("coach_questionnaires")
            .select("id, is_active, status")
            .eq("coach_id", coachUserId);

        if (fetchError) {
            return { success: false, fixed: 0, errors: [fetchError.message] };
        }

        if (!questionnaires || questionnaires.length === 0) {
            return { success: true, fixed: 0, errors: [] };
        }

        // 2. 修复数据不一致
        for (const q of questionnaires) {
            const needsUpdate: any = {};
            let shouldUpdate = false;

            // 情况1：status='active' 但 is_active=false → 修复为 is_active=true
            if (q.status === 'active' && q.is_active === false) {
                needsUpdate.is_active = true;
                shouldUpdate = true;
            }

            // 情况2：status='archived' 但 is_active=true → 修复为 is_active=false
            if (q.status === 'archived' && q.is_active === true) {
                needsUpdate.is_active = false;
                shouldUpdate = true;
            }

            // 情况3：status 为空但 is_active 有值 → 从 is_active 推导 status
            if (!q.status && q.is_active !== null && q.is_active !== undefined) {
                needsUpdate.status = q.is_active ? 'active' : 'archived';
                shouldUpdate = true;
            }

            // 情况4：is_active 为空但 status 有值 → 从 status 推导 is_active
            if ((q.is_active === null || q.is_active === undefined) && q.status) {
                needsUpdate.is_active = q.status === 'active';
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                const { error: updateError } = await supabase
                    .from("coach_questionnaires")
                    .update(needsUpdate)
                    .eq("id", q.id);

                if (updateError) {
                    errors.push(`修复问卷 ${q.id} 失败: ${updateError.message}`);
                } else {
                    fixed++;
                }
            }
        }

        return {
            success: errors.length === 0,
            fixed,
            errors,
        };
    } catch (error: any) {
        return {
            success: false,
            fixed,
            errors: [error.message || '未知错误'],
        };
    }
}

/**
 * 修复所有教练的问卷数据不一致问题
 */
export async function fixAllQuestionnaireData(): Promise<{
    success: boolean;
    totalFixed: number;
    errors: string[];
}> {
    const errors: string[] = [];
    let totalFixed = 0;

    try {
        // 获取所有教练的 user_id
        const { data: coaches, error: coachesError } = await supabase
            .from("coaches")
            .select("user_id");

        if (coachesError) {
            return { success: false, totalFixed: 0, errors: [coachesError.message] };
        }

        if (!coaches || coaches.length === 0) {
            return { success: true, totalFixed: 0, errors: [] };
        }

        // 逐个修复
        for (const coach of coaches) {
            const result = await fixCoachQuestionnaireData(coach.user_id);
            totalFixed += result.fixed;
            errors.push(...result.errors);
        }

        return {
            success: errors.length === 0,
            totalFixed,
            errors,
        };
    } catch (error: any) {
        return {
            success: false,
            totalFixed,
            errors: [error.message || '未知错误'],
        };
    }
}

/**
 * 修复单个问卷的数据不一致问题（通过问卷ID）
 */
export async function fixQuestionnaireById(questionnaireId: string): Promise<{
    success: boolean;
    fixed: boolean;
    error?: string;
}> {
    try {
        const { data: questionnaire, error: fetchError } = await supabase
            .from("coach_questionnaires")
            .select("id, is_active, status")
            .eq("id", questionnaireId)
            .single();

        if (fetchError || !questionnaire) {
            return { success: false, fixed: false, error: fetchError?.message || '问卷不存在' };
        }

        const needsUpdate: any = {};
        let shouldUpdate = false;

        // 情况1：status='active' 但 is_active=false → 修复为 is_active=true
        if (questionnaire.status === 'active' && questionnaire.is_active === false) {
            needsUpdate.is_active = true;
            shouldUpdate = true;
        }

        // 情况2：status='archived' 但 is_active=true → 修复为 is_active=false
        if (questionnaire.status === 'archived' && questionnaire.is_active === true) {
            needsUpdate.is_active = false;
            shouldUpdate = true;
        }

        // 情况3：status 为空但 is_active 有值 → 从 is_active 推导 status
        if (!questionnaire.status && questionnaire.is_active !== null && questionnaire.is_active !== undefined) {
            needsUpdate.status = questionnaire.is_active ? 'active' : 'archived';
            shouldUpdate = true;
        }

        // 情况4：is_active 为空但 status 有值 → 从 status 推导 is_active
        if ((questionnaire.is_active === null || questionnaire.is_active === undefined) && questionnaire.status) {
            needsUpdate.is_active = questionnaire.status === 'active';
            shouldUpdate = true;
        }

        if (!shouldUpdate) {
            return { success: true, fixed: false };
        }

        const { error: updateError } = await supabase
            .from("coach_questionnaires")
            .update(needsUpdate)
            .eq("id", questionnaireId);

        if (updateError) {
            return { success: false, fixed: false, error: updateError.message };
        }

        return { success: true, fixed: true };
    } catch (error: any) {
        return {
            success: false,
            fixed: false,
            error: error.message || '未知错误',
        };
    }
}
