/**
 * 问卷数据迁移辅助函数
 * 
 * 用途：确保所有旧数据都有正确的 status 和 is_default 字段
 * 调用时机：在需要时手动调用，或作为后台任务定期运行
 */

import supabase from "@/lib/supabaseClient";

/**
 * 迁移单个教练的问卷数据
 * 确保 status 和 is_active 同步，is_default 正确设置
 */
export async function migrateCoachQuestionnaires(coachUserId: string): Promise<{
    success: boolean;
    updated: number;
    errors: string[];
}> {
    const errors: string[] = [];
    let updated = 0;

    try {
        // 1. 获取该教练的所有问卷
        const { data: questionnaires, error: fetchError } = await supabase
            .from("coach_questionnaires")
            .select("id, is_active, status, is_default")
            .eq("coach_id", coachUserId);

        if (fetchError) {
            return { success: false, updated: 0, errors: [fetchError.message] };
        }

        if (!questionnaires || questionnaires.length === 0) {
            return { success: true, updated: 0, errors: [] };
        }

        // 2. 确保 status 和 is_active 同步
        for (const q of questionnaires) {
            const needsUpdate: any = {};
            let shouldUpdate = false;

            // 如果 status 为空，从 is_active 推导
            if (!q.status) {
                needsUpdate.status = q.is_active ? 'active' : 'archived';
                shouldUpdate = true;
            }

            // 如果 is_active 与 status 不一致，同步 is_active
            const expectedIsActive = q.status === 'active' || (!q.status && q.is_active);
            if (q.is_active !== expectedIsActive) {
                needsUpdate.is_active = expectedIsActive;
                shouldUpdate = true;
            }

            if (shouldUpdate) {
                const { error: updateError } = await supabase
                    .from("coach_questionnaires")
                    .update(needsUpdate)
                    .eq("id", q.id);

                if (updateError) {
                    errors.push(`更新问卷 ${q.id} 失败: ${updateError.message}`);
                } else {
                    updated++;
                }
            }
        }

        // 3. 确保 is_default 正确设置（每个教练只能有一个 is_default=true）
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("profile")
            .eq("user_id", coachUserId)
            .maybeSingle();

        const defaultIdFromProfile = (coachRow?.profile as any)?.default_questionnaire_id || null;

        // 检查是否有 is_default=true 的问卷
        const defaultQuestionnaires = questionnaires.filter(q => q.is_default === true);
        
        if (defaultQuestionnaires.length === 0) {
            // 没有 is_default，尝试从 profile 恢复
            if (defaultIdFromProfile) {
                const targetQ = questionnaires.find(q => q.id === defaultIdFromProfile);
                if (targetQ) {
                    // 清除所有 is_default
                    await supabase
                        .from("coach_questionnaires")
                        .update({ is_default: false })
                        .eq("coach_id", coachUserId);

                    // 设置目标问卷为 is_default
                    const { error: setDefaultError } = await supabase
                        .from("coach_questionnaires")
                        .update({ is_default: true })
                        .eq("id", defaultIdFromProfile);

                    if (setDefaultError) {
                        errors.push(`设置默认问卷失败: ${setDefaultError.message}`);
                    } else {
                        updated++;
                    }
                }
            } else {
                // 既没有 is_default，也没有 profile 中的 default_questionnaire_id
                // 设置最新的 active 问卷为默认（如果有）
                const activeQuestionnaires = questionnaires
                    .filter(q => (q.status === 'active' || q.is_active))
                    .sort((a, b) => {
                        // 按 updated_at 降序（这里简化处理，实际应该查询 updated_at）
                        return 0;
                    });

                if (activeQuestionnaires.length > 0) {
                    const targetId = activeQuestionnaires[0].id;
                    await supabase
                        .from("coach_questionnaires")
                        .update({ is_default: false })
                        .eq("coach_id", coachUserId);

                    const { error: setDefaultError } = await supabase
                        .from("coach_questionnaires")
                        .update({ is_default: true })
                        .eq("id", targetId);

                    if (setDefaultError) {
                        errors.push(`设置默认问卷失败: ${setDefaultError.message}`);
                    } else {
                        updated++;
                    }
                }
            }
        } else if (defaultQuestionnaires.length > 1) {
            // 有多个 is_default=true，只保留一个（最新的）
            const sorted = defaultQuestionnaires.sort((a, b) => {
                // 按 updated_at 降序（这里简化处理）
                return 0;
            });

            // 清除所有 is_default
            await supabase
                .from("coach_questionnaires")
                .update({ is_default: false })
                .eq("coach_id", coachUserId);

            // 设置最新的为 is_default
            const { error: setDefaultError } = await supabase
                .from("coach_questionnaires")
                .update({ is_default: true })
                .eq("id", sorted[0].id);

            if (setDefaultError) {
                errors.push(`设置默认问卷失败: ${setDefaultError.message}`);
            } else {
                updated++;
            }
        }

        return {
            success: errors.length === 0,
            updated,
            errors,
        };
    } catch (error: any) {
        return {
            success: false,
            updated,
            errors: [error.message || '未知错误'],
        };
    }
}

/**
 * 迁移所有教练的问卷数据
 */
export async function migrateAllQuestionnaires(): Promise<{
    success: boolean;
    totalUpdated: number;
    errors: string[];
}> {
    const errors: string[] = [];
    let totalUpdated = 0;

    try {
        // 获取所有教练的 user_id
        const { data: coaches, error: coachesError } = await supabase
            .from("coaches")
            .select("user_id");

        if (coachesError) {
            return { success: false, totalUpdated: 0, errors: [coachesError.message] };
        }

        if (!coaches || coaches.length === 0) {
            return { success: true, totalUpdated: 0, errors: [] };
        }

        // 逐个迁移
        for (const coach of coaches) {
            const result = await migrateCoachQuestionnaires(coach.user_id);
            totalUpdated += result.updated;
            errors.push(...result.errors);
        }

        return {
            success: errors.length === 0,
            totalUpdated,
            errors,
        };
    } catch (error: any) {
        return {
            success: false,
            totalUpdated,
            errors: [error.message || '未知错误'],
        };
    }
}
