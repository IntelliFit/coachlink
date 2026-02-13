import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { isOneRMEligibleAction } from "@/lib/oneRmEligibility";

/**
 * 将教练计划中使用的动作同步到学员动作库
 * 确保学员动作库包含计划所需的所有动作，便于后续维护全局1RM
 * 
 * @param targetStudentId 目标学员的 user_id
 * @param coachActions 教练动作库中的动作列表
 * @param trainingActionIds 计划中使用的动作ID集合
 */
export async function syncCoachActionsToStudentLibrary(
    targetStudentId: string,
    coachActions: any[],
    trainingActionIds: Set<string>,
) {
    const candidates = (coachActions || [])
        .filter((a) => trainingActionIds.has(a.id))
        .map((a) => {
            const attrs = Array.isArray(a.attrs) ? a.attrs : null;
            const enableAutoWeightCompute = !!(a.enableAutoWeightCompute ?? a.enable_auto_weight_compute);
            const includesBodyWeight = !!(a.includesBodyWeight ?? a.includes_body_weight);
            const eligible = isOneRMEligibleAction({
                type: a.type,
                attrs: attrs || undefined,
                enableAutoWeightCompute,
            });

            return {
                user_id: targetStudentId,
                name: a.name,
                detail: a.detail || null,
                positions: Array.isArray(a.positions) ? a.positions : null,
                attrs,
                url: a.video_url || a.url || null,
                type: a.type || "STRENGTH",
                item_schema: a.item_schema || null,
                suggested_time: a.suggested_time || null,
                enableAutoWeightCompute,
                includesBodyWeight: includesBodyWeight && enableAutoWeightCompute,
                reference_1rm: eligible ? null : null,
                canonical_action_id: a.canonical_action_id || null,
                updated_at: new Date().toISOString(),
            };
        });

    if (candidates.length === 0) return;

    // 不依赖 DB 上的 unique(user_id,name) 约束，先查询已存在动作再插入缺失项。
    const names = candidates.map((c) => c.name).filter(Boolean);
    const canonicalIds = candidates
        .map((c) => c.canonical_action_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0);

    let existing: Array<{ id: string; name: string; canonical_action_id: string | null }> = [];
    try {
        const baseQuery = (supabase as any)
            .from("student_actions")
            .select("id,name,canonical_action_id")
            .eq("user_id", targetStudentId);

        const bucket: Array<{ id: string; name: string; canonical_action_id: string | null }> = [];

        if (names.length > 0) {
            const { data, error } = await baseQuery.in("name", names);
            if (error) {
                console.warn("[sync-actions] query existing by name failed:", error);
            } else if (Array.isArray(data)) {
                bucket.push(...data);
            }
        }

        if (canonicalIds.length > 0) {
            const { data, error } = await (supabase as any)
                .from("student_actions")
                .select("id,name,canonical_action_id")
                .eq("user_id", targetStudentId)
                .in("canonical_action_id", canonicalIds);
            if (error) {
                console.warn("[sync-actions] query existing by canonical failed:", error);
            } else if (Array.isArray(data)) {
                bucket.push(...data);
            }
        }

        // 去重
        const seen = new Set<string>();
        existing = bucket.filter((x) => {
            if (seen.has(x.id)) return false;
            seen.add(x.id);
            return true;
        });
    } catch (e) {
        console.warn("[sync-actions] query existing exception:", e);
    }

    const byCanonical = new Set(
        existing
            .map((x) => x.canonical_action_id)
            .filter((v): v is string => typeof v === "string" && v.length > 0),
    );
    const byName = new Set(existing.map((x) => x.name));

    const missing = candidates.filter((c) => {
        if (c.canonical_action_id && byCanonical.has(c.canonical_action_id)) return false;
        return !byName.has(c.name);
    });

    if (missing.length === 0) return;

    const { error: insertError } = await (supabase as any)
        .from("student_actions")
        .insert(missing);

    if (insertError) {
        console.warn("[sync-actions] insert missing actions failed:", insertError);
    }
}

