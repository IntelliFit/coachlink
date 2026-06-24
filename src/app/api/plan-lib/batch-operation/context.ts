/**
 * AI 批量操作上下文构建：根据 contextOptions 拉取档案/问卷/执行/动作库/模板等，生成注入给 AI 的 prompt 文本。
 * 供 batch-operation 与 batch-operation-context-preview 共用。
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BatchOperationContextOptions } from "./entity";

export type TargetActionType = "coach" | "student";

function safeJsonPreview(input: unknown, maxLen = 800): string {
    try {
        const text = JSON.stringify(input ?? null);
        if (!text) return "null";
        return text.length > maxLen ? `${text.slice(0, maxLen)}...` : text;
    } catch {
        return String(input ?? "null");
    }
}

function normalizeStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item: any) => String(item || "").trim()).filter(Boolean) : [];
}

/**
 * 将订阅时的 subscribe_data 数组（问卷步骤）转换为 AI 可读的 key-value 摘要对象。
 */
function parseSubscribeDataToQuestionnaire(steps: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const step of steps) {
        if (!step) continue;
        const q = String(step.question || step.type || "");
        const type = String(step.type || "");
        if (type === "tags" && Array.isArray(step.userSelections)) {
            result["训练兴趣标签"] = step.userSelections;
        } else if (type === "rm") {
            if (step.userInputs && typeof step.userInputs === "object") {
                result["RM测试输入"] = step.userInputs;
            }
        } else if (type === "option" && q && step.userSelection !== undefined) {
            const opts = Array.isArray(step.options) ? step.options : [];
            const selected = opts[step.userSelection];
            result[q] = selected !== undefined ? selected : step.userSelection;
        } else if (type === "text" && q && step.userSelection !== undefined) {
            result[q] = step.userSelection;
        }
    }
    return result;
}

function normalizeActionNameKey(name: unknown): string {
    return String(name || "")
        .toLowerCase()
        .replace(/[\s\-_()（）【】\[\]·,，.。]/g, "")
        .trim();
}

function summarizeExecutionStatus(rows: any[]): string {
    const stats = { total: rows.length, completed: 0, active: 0, skipped: 0 };
    for (const row of rows) {
        const status = String(row?.status || "").toLowerCase();
        if (status === "completed" || status === "finished") stats.completed += 1;
        else if (status === "active" || status === "in_progress") stats.active += 1;
        else if (status === "skipped") stats.skipped += 1;
    }
    return `总执行 ${stats.total} 次，完成 ${stats.completed} 次，进行中 ${stats.active} 次，跳过 ${stats.skipped} 次`;
}

function buildTemplateMatchSummary(params: {
    templates: any[];
    fitnessLevel?: string | null;
    questionnaireAnswers?: Record<string, any> | null;
}): string {
    const { templates, fitnessLevel, questionnaireAnswers } = params;
    if (!templates || templates.length === 0) return "暂无可匹配模板。";
    const answers = questionnaireAnswers || {};
    const interests = [
        ...normalizeStringArray(answers.fitness_goals),
        ...normalizeStringArray(answers.interest_tags),
        ...normalizeStringArray(answers.target_body_parts),
    ];
    const preferredTimes = typeof answers.weekly_frequency === "number"
        ? answers.weekly_frequency
        : (typeof answers.times === "number" ? answers.times : null);

    const scored = templates.map((tpl: any) => {
        let score = 0;
        const reasons: string[] = [];
        const tplLevel = String(tpl?.suitable_for || "");
        if (fitnessLevel && tplLevel && tplLevel === fitnessLevel) {
            score += 2;
            reasons.push("水平匹配");
        }
        const tplTags = Array.isArray(tpl?.tags) ? tpl.tags.map((x: any) => String(x)) : [];
        const tagOverlap = tplTags.filter((tag: string) => interests.includes(tag)).length;
        if (tagOverlap > 0) {
            score += Math.min(3, tagOverlap);
            reasons.push(`兴趣标签命中 ${tagOverlap}`);
        }
        const weekDays = Array.isArray(tpl?.week_days) ? tpl.week_days : [];
        if (preferredTimes != null && weekDays.includes(preferredTimes)) {
            score += 1.5;
            reasons.push("每周频次匹配");
        }
        const globalAnswers = tpl?.global_answers && typeof tpl.global_answers === "object" ? tpl.global_answers as Record<string, any> : null;
        if (globalAnswers) {
            let globalMatch = 0;
            for (const [k, v] of Object.entries(globalAnswers)) {
                if (answers[k] !== undefined && answers[k] === v) globalMatch += 1;
            }
            if (globalMatch > 0) {
                score += Math.min(2, globalMatch);
                reasons.push(`全局问卷匹配 ${globalMatch}`);
            }
        }
        return { id: tpl.id, name: tpl.name, score, reasons: reasons.length > 0 ? reasons.join("、") : "通用候选" };
    });

    const top = scored.sort((a, b) => b.score - a.score).slice(0, 3);
    return top.map((x, idx) => `${idx + 1}. ${x.name}（score=${x.score.toFixed(1)}，${x.reasons}）`).join("\n");
}

export interface BuildContextParams {
    userId: string;
    targetActionType: TargetActionType;
    templateId?: string;
    contextOptions?: BatchOperationContextOptions;
    supabase: SupabaseClient;
}

export interface BuildContextResult {
    prompt: string;
    enabled: string[];
    unavailable: string[];
}

/**
 * 构建本次批量操作会注入给 AI 的“额外上下文”文本及启用/不可用项列表。
 */
export async function buildBatchOperationContext(params: BuildContextParams): Promise<BuildContextResult> {
    const { userId, targetActionType, templateId, contextOptions, supabase } = params;
    const hintedSubjectUserId = String(contextOptions?.subjectUserId || "").trim() || null;
    const options: Required<Omit<BatchOperationContextOptions, "subscriptionId">> & { subscriptionId?: string } = {
        includeStudentProfile: contextOptions?.includeStudentProfile ?? true,
        includeStudentQuestionnaire: contextOptions?.includeStudentQuestionnaire ?? true,
        includeExecutionHistory: contextOptions?.includeExecutionHistory ?? true,
        includeStudentActionLib: contextOptions?.includeStudentActionLib ?? false,
        includeCoachActionLib: contextOptions?.includeCoachActionLib ?? true,
        includePublicActionLib: contextOptions?.includePublicActionLib ?? true,
        includeCoachTemplates: contextOptions?.includeCoachTemplates ?? true,
        includeTemplateMatch: contextOptions?.includeTemplateMatch ?? true,
        includeFeedbacks: contextOptions?.includeFeedbacks ?? true,
        subscriptionId: contextOptions?.subscriptionId,
    };
    const enabled: string[] = [];
    const unavailable: string[] = [];
    const actionNameSeen = new Set<string>();

    let coachId: string | null = null;
    if (
        targetActionType === "coach" &&
        (options.includeCoachTemplates || options.subscriptionId || options.includeCoachActionLib)
    ) {
        const { data: coachRow } = await supabase
            .from("coaches")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();
        coachId = coachRow?.id || null;
    }

    let subjectUserId: string | null = targetActionType === "student" ? userId : null;
    let subscriptionQuestionnaires: Record<string, any> | null = null;

    // 教练端优先接收前端已解析出的学员 user_id（页面已拿到学员信息），
    // 但必须通过归属校验，避免越权读取任意学员上下文。
    if (targetActionType === "coach" && hintedSubjectUserId) {
        const { data: ownedSub } = await supabase
            .from("coach_subscriptions")
            .select("id,student_id,coach_id")
            .eq("student_id", hintedSubjectUserId)
            .order("created_at", { ascending: false })
            .limit(20);
        const passHintOwnership = (ownedSub || []).some((s: any) =>
            String(s.student_id) === hintedSubjectUserId &&
            (
                (coachId && String((s as any).coach_id || "") === String(coachId)) ||
                String((s as any).coach_id || "") === String(userId)
            )
        );
        if (passHintOwnership) {
            subjectUserId = hintedSubjectUserId;
        }
    }

    if (options.subscriptionId) {
        // 兼容口径差异：
        // - 新口径：coach_subscriptions.coach_id = coaches.id
        // - 旧口径：coach_subscriptions.coach_id = users.id
        const { data: subRow } = await supabase
            .from("coach_subscriptions")
            .select("id,student_id,subscribe_data,coach_id")
            .eq("id", options.subscriptionId)
            .maybeSingle();

        let ownerUserId: string | null = null;
        const rawCoachOwner = String((subRow as any)?.coach_id || "");
        if (rawCoachOwner) {
            const { data: ownerCoach } = await supabase
                .from("coaches")
                .select("id,user_id")
                .eq("id", rawCoachOwner)
                .maybeSingle();
            ownerUserId = ownerCoach?.user_id || rawCoachOwner; // 查不到则按旧口径（users.id）处理
        }

        const passCoachOwnership =
            !!subRow &&
            !!ownerUserId &&
            ownerUserId === String(userId);

        if (subRow?.student_id && passCoachOwnership) {
            subjectUserId = subRow.student_id;
            // subscribe_data 是订阅时填写的问卷步骤数组，转为 key-value 摘要供 AI 使用
            if (Array.isArray((subRow as any).subscribe_data) && (subRow as any).subscribe_data.length > 0) {
                subscriptionQuestionnaires = parseSubscribeDataToQuestionnaire((subRow as any).subscribe_data);
            }
        }
    }

    const sections: string[] = [];
    sections.push(`- 目标角色: ${targetActionType}`);
    if (subjectUserId) sections.push(`- 目标学员 user_id: ${subjectUserId}`);

    let profileRow: any = null;
    if (options.includeStudentProfile && !subjectUserId) {
        sections.push("## 学员档案");
        sections.push("- 未定位到目标学员（请检查 subscriptionId 与归属权限）");
        unavailable.push("学员基本情况");
    } else if (options.includeStudentProfile && subjectUserId) {
        const { data } = await supabase
            .from("user_profiles")
            .select("*")
            .eq("user_id", subjectUserId)
            .maybeSingle();
        profileRow = data || null;
        if (profileRow) {
            enabled.push("学员基本情况");
            sections.push("## 学员档案");
            sections.push(`- fitness_goal: ${String(profileRow.fitness_goal || "未填写")}`);
            sections.push(`- fitness_level: ${String(profileRow.fitness_level || "未填写")}`);
            sections.push(`- weight: ${String(profileRow.weight || "未知")}`);
            sections.push(`- 其他档案快照: ${safeJsonPreview({
                gender: profileRow.gender,
                birthdate: profileRow.birthdate,
                injuries: profileRow.injuries,
                training_experience: profileRow.training_experience,
            }, 360)}`);
        }
        if (!profileRow) unavailable.push("学员基本情况");
    }

    let onboardingAnswers: Record<string, any> | null = null;
    if (options.includeStudentQuestionnaire && !subjectUserId) {
        sections.push("## 学员问卷");
        sections.push("- 未定位到目标学员（请检查 subscriptionId 与归属权限）");
        unavailable.push("学员问卷");
    } else if (options.includeStudentQuestionnaire && subjectUserId) {
        const { data } = await supabase
            .from("onboarding_questionnaires")
            .select("answers,created_at")
            .eq("user_id", subjectUserId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
        onboardingAnswers = data?.answers && typeof data.answers === "object" ? (data.answers as Record<string, any>) : null;
        const finalAnswers = onboardingAnswers || subscriptionQuestionnaires;
        sections.push("## 学员问卷");
        if (finalAnswers) {
            enabled.push("学员问卷");
            const goals = normalizeStringArray((finalAnswers as any).fitness_goals);
            if (goals.length > 0) sections.push(`- fitness_goals: ${goals.join("、")}`);
            if (typeof (finalAnswers as any).weekly_frequency === "number") {
                const freq = Number((finalAnswers as any).weekly_frequency);
                sections.push(`- weekly_frequency: ${freq >= 6 ? "6 天及以上" : `${freq} 天`}`);
            }
            sections.push(`- 回答摘要: ${safeJsonPreview(finalAnswers, 700)}`);
        } else {
            sections.push("- 未找到可用问卷回答");
            unavailable.push("学员问卷");
        }
    }

    let executionRows: any[] = [];
    let instanceIds: string[] = [];
    if ((options.includeExecutionHistory || options.includeFeedbacks) && !subjectUserId) {
        if (options.includeExecutionHistory) unavailable.push("执行记录");
        if (options.includeFeedbacks) unavailable.push("学员反馈");
    } else if ((options.includeExecutionHistory || options.includeFeedbacks) && subjectUserId) {
        const { data: instances } = await supabase
            .from("coach_plan_instances")
            .select("id,name,status,updated_at")
            .eq("student_id", subjectUserId)
            .order("updated_at", { ascending: false })
            .limit(6);
        instanceIds = (instances || []).map((x: any) => x.id);

        if (options.includeExecutionHistory && instanceIds.length > 0) {
            const { data: execs } = await supabase
                .from("plan_instance_executions")
                .select("id,instance_id,day_index,status,started_at,completed_at")
                .in("instance_id", instanceIds)
                .order("started_at", { ascending: false })
                .limit(60);
            executionRows = execs || [];
            enabled.push("执行记录");
            sections.push("## 历史执行摘要");
            sections.push(`- ${summarizeExecutionStatus(executionRows)}`);
            sections.push(`- 最近执行: ${safeJsonPreview(executionRows.slice(0, 5), 520)}`);
        }
        if (options.includeExecutionHistory && instanceIds.length === 0) unavailable.push("执行记录");
    }

    if (options.includeFeedbacks && instanceIds.length > 0) {
        const { data: feedbacks } = await supabase
            .from("execution_feedbacks")
            .select("day_index,content,difficulty_rating,created_at")
            .in("instance_id", instanceIds)
            .order("created_at", { ascending: false })
            .limit(10);
        sections.push("## 学员反馈摘要");
        enabled.push("学员反馈");
        sections.push(
            feedbacks && feedbacks.length > 0
                ? feedbacks
                    .map((f: any) => `- 第${f.day_index}天 难度${f.difficulty_rating || "-"}: ${String(f.content || "").slice(0, 60)}`)
                    .join("\n")
                : "- 暂无近期反馈",
        );
    }

    if (options.includeCoachActionLib && targetActionType === "coach") {
        sections.push("## 教练动作库摘要");
        const { data: coachActions } = await supabase
            .from("coach_actions")
            .select("id,name,type")
            .eq("coach_id", userId)
            .order("updated_at", { ascending: false })
            .limit(30);
        if (coachActions && coachActions.length > 0) {
            enabled.push("教练动作库");
            const sampled = coachActions.slice(0, 20);
            for (const a of sampled as any[]) {
                actionNameSeen.add(normalizeActionNameKey(a.name));
            }
            sections.push(sampled.map((a: any) => `- ${a.name} (${a.type || "STRENGTH"})`).join("\n"));
        } else {
            sections.push("- 教练动作库为空");
            unavailable.push("教练动作库");
        }
    }

    if (options.includeStudentActionLib && !subjectUserId) {
        sections.push("## 学员动作库摘要");
        sections.push("- 未定位到目标学员（请检查 subscriptionId 与归属权限）");
        unavailable.push("学员动作库");
    } else if (options.includeStudentActionLib && subjectUserId) {
        sections.push("## 学员动作库摘要");
        const { data: studentActions } = await supabase
            .from("student_actions")
            .select("id,name,type,reference_1rm")
            .eq("user_id", subjectUserId)
            .order("updated_at", { ascending: false })
            .limit(30);
        if (studentActions && studentActions.length > 0) {
            enabled.push("学员动作库");
            const sampled = studentActions.slice(0, 20);
            for (const a of sampled as any[]) {
                actionNameSeen.add(normalizeActionNameKey(a.name));
            }
            sections.push(sampled.map((a: any) => {
                const oneRM = Number(a.reference_1rm);
                const suffix = Number.isFinite(oneRM) && oneRM > 0 ? `, 1RM=${oneRM}kg` : "";
                return `- ${a.name} (${a.type || "STRENGTH"}${suffix})`;
            }).join("\n"));
        } else {
            sections.push("- 学员动作库为空");
            unavailable.push("学员动作库");
        }
    }

    if (options.includePublicActionLib) {
        sections.push("## 公共动作库摘要");
        const { data: publicActions } = await supabase
            .from("community_actions")
            .select("id,name,type,like_count")
            .order("like_count", { ascending: false })
            .limit(120);
        if (publicActions && publicActions.length > 0) {
            enabled.push("公共动作库");
            const deduped: any[] = [];
            for (const a of publicActions as any[]) {
                const key = normalizeActionNameKey(a.name);
                if (!key || actionNameSeen.has(key)) continue;
                actionNameSeen.add(key);
                deduped.push(a);
                if (deduped.length >= 20) break;
            }
            const sampled = deduped.length > 0 ? deduped : (publicActions as any[]).slice(0, 20);
            sections.push(
                sampled.map((a: any) => `- ${a.name} (${a.type || "STRENGTH"}, likes=${a.like_count || 0})`).join("\n"),
            );
            sections.push(`- 公共动作库展示策略：按热度优先，最多展示 20 条（已做跨动作库去重）`);
        } else {
            sections.push("- 暂无可用公共动作");
            unavailable.push("公共动作库");
        }
    }

    let coachTemplates: any[] = [];
    if (options.includeCoachTemplates && coachId) {
        const { data } = await supabase
            .from("coach_plan_templates")
            .select("id,name,description,tags,suitable_for,training_days_count,week_days,global_answers,updated_at")
            // coach_plan_templates 在当前链路以 users.id 作为 owner（与 update-template/get-overview-data 一致）
            .eq("coach_id", userId)
            .order("updated_at", { ascending: false })
            .limit(12);
        coachTemplates = (data || []).filter((tpl: any) => !templateId || tpl.id !== templateId);
        sections.push("## 教练模板库摘要");
        if (coachTemplates.length > 0) {
            enabled.push("教练模板");
            sections.push(
                coachTemplates
                    .slice(0, 6)
                    .map(
                        (tpl: any) =>
                            `- ${tpl.name}（suitable_for=${tpl.suitable_for || "-"}，days=${tpl.training_days_count || "-"}，tags=${Array.isArray(tpl.tags) ? tpl.tags.join("/") : "-"}`,
                    )
                    .join("\n"),
            );
        } else {
            sections.push("- 暂无可用模板");
            unavailable.push("教练模板");
        }
    }

    if (options.includeTemplateMatch && coachTemplates.length > 0) {
        enabled.push("模板匹配");
        sections.push("## 模板匹配建议（可先复用再微调）");
        sections.push(
            buildTemplateMatchSummary({
                templates: coachTemplates,
                fitnessLevel: profileRow?.fitness_level || null,
                questionnaireAnswers: onboardingAnswers || subscriptionQuestionnaires || null,
            }),
        );
    }

    sections.push("## 执行权限说明");
    sections.push(
        "- 当前接口仅能修改当前计划 trainingDays；不能直接新建模板。\n" +
            "- 若你判断应沉淀为模板，请在 actionPlan 中明确提出“建议创建模板”与模板命名建议。",
    );

    return {
        prompt: sections.join("\n"),
        enabled: Array.from(new Set(enabled)),
        unavailable: Array.from(new Set(unavailable)),
    };
}
