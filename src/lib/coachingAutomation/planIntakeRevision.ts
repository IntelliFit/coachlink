/**
 * 学员回复计划助理时补充的文字信息（器械、时间、伤病、开放问题的回答），
 * 交给 AI 在当前计划上做保守修改，生成「调整草稿」由教练确认后应用。
 *
 * 只改学员还没练过的天：已有执行记录的天和起始日之前的天保持原样。
 * 草稿不挂在任务上（job_id 为空）：应用草稿会改写任务的 output_snapshot，会冲掉计划助理的状态。
 */
import { getCurrent1RMRecords } from "@/app/api/student/get-current-1rm/route";
import { fillTemplate } from "@/app/api/plan-lib/create-ai-instance/match";
import { personalizePlanWithLLM } from "@/app/api/plan-lib/ai-personalize-plan/personalize-plan";
import { buildActionLibrary, buildPRRecordSummaries } from "@/app/api/plan-lib/ai-personalize-plan/service";
import { validateAndSanitizeTrainingDays } from "@/app/api/plan-lib/ai-personalize-plan/validate-output";
import { serviceRoleSupabase } from "@/lib/supabaseClient";
import { dayPrescriptionKey, hasTrainingDayChanges, loadLockedDayIndexes, mergeKeepingLockedDays } from "./planDayLock";
import { buildProfileOneRmInputs, resolveProfileBodyWeight } from "./profileOneRm";

const db = () => serviceRoleSupabase as any;

const REVISABLE_PLAN_STATUSES = new Set(["active", "draft", "scheduled", "paused"]);
const MAX_SUMMARY_CHARS = 200;

function cleanSummary(value: unknown): string {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, MAX_SUMMARY_CHARS);
}

export type IntakeRevisionResult =
    | { status: "drafted"; draftId: string; summary: string }
    | { status: "skipped"; reason: string };

/**
 * 根据学员补充信息生成调整草稿。不会直接改计划；失败时抛错，由调用方降级为只通知教练。
 */
export async function draftPlanRevisionFromIntake(params: {
    planInstanceId: string;
    subscriptionId: string;
    coachId: string;
    coachUserId: string;
    studentId: string;
    intakeJobId: string;
    notes: string[];
    riskNotes: string[];
}): Promise<IntakeRevisionResult> {
    const notes = params.notes.map((n) => n.trim()).filter(Boolean);
    const riskNotes = params.riskNotes.map((n) => n.trim()).filter(Boolean);
    if (notes.length === 0 && riskNotes.length === 0) return { status: "skipped", reason: "no_notes" };

    const [{ data: plan, error: planError }, { data: subscription }, { data: profile }, { data: coachActions }] =
        await Promise.all([
            db().from("coach_plan_instances")
                .select("id, name, description, status, training_days, start_execution_day, coach_subscription_id")
                .eq("id", params.planInstanceId)
                .maybeSingle(),
            db().from("coach_subscriptions")
                .select("subscribe_data, subscribed_weeks")
                .eq("id", params.subscriptionId)
                .maybeSingle(),
            db().from("user_profiles")
                .select("nickname, full_name, weight, height, age, gender, fitness_goal, fitness_level, sport_cards")
                .eq("user_id", params.studentId)
                .maybeSingle(),
            db().from("coach_actions")
                .select('id, name, type, detail, canonical_action_id, "enableAutoWeightCompute", "includesBodyWeight"')
                .eq("coach_id", params.coachUserId),
        ]);
    if (planError || !plan) return { status: "skipped", reason: "plan_not_found" };
    if (!REVISABLE_PLAN_STATUSES.has(String(plan.status || ""))) return { status: "skipped", reason: "plan_not_revisable" };
    if (plan.coach_subscription_id !== params.subscriptionId) return { status: "skipped", reason: "plan_subscription_mismatch" };

    const originalDays: any[] = Array.isArray(plan.training_days) ? plan.training_days : [];
    if (originalDays.length === 0) return { status: "skipped", reason: "plan_empty" };
    const lockedDayIndexes = await loadLockedDayIndexes(plan.id);

    const supplement = [
        ...notes.map((n) => `- ${n}`),
        ...riskNotes.map((n) => `- 身体情况：${n}（涉及的动作要降强度或替换，不能加量）`),
    ].join("\n");
    const questionnaireAnswers = [
        ...(Array.isArray(subscription?.subscribe_data) ? subscription.subscribe_data : []),
        {
            type: "text",
            question: "学员私信补充（计划助理收集，优先级高于上面的问卷）",
            userSelection: supplement,
        },
    ];

    const library = buildActionLibrary(coachActions || []);
    const records = await getCurrent1RMRecords(params.coachUserId, { targetUserId: params.studentId });
    const bodyWeight = resolveProfileBodyWeight(profile);
    const stageB = await personalizePlanWithLLM({
        subscriptionId: params.subscriptionId,
        actorUserId: params.coachUserId,
        actorCoachId: params.coachId,
        studentId: params.studentId,
        studentName: String(profile?.nickname || profile?.full_name || "学员"),
        subscribedWeeks: Number(subscription?.subscribed_weeks || 0) || null,
        questionnaireAnswers: questionnaireAnswers as any,
        studentBodyWeight: bodyWeight,
        studentProfile: {
            goal: profile?.fitness_goal,
            trainingAge: profile?.fitness_level,
            height: profile?.height,
            weight: bodyWeight,
            age: profile?.age,
            gender: profile?.gender,
        },
        prRecords: buildPRRecordSummaries(records),
        actionLibrary: library,
        availableTemplates: [],
        selectedTemplate: {
            name: plan.name,
            description: plan.description,
            training_days: originalDays,
        } as any,
    });

    const { days: sanitizedDays } = validateAndSanitizeTrainingDays(stageB.trainingDays, library);
    const revised = { training_days: sanitizedDays };
    const autoComputeActions = (coachActions || []).filter((a: any) => a?.enableAutoWeightCompute === true);
    await fillTemplate(questionnaireAnswers as any, revised as any, {
        studentBodyWeight: bodyWeight,
        autoComputeActions,
        studentId: params.studentId,
        coachId: params.coachUserId,
        profileOneRmInputs: buildProfileOneRmInputs(profile?.sport_cards, autoComputeActions),
    });

    const merged = mergeKeepingLockedDays({
        originalDays,
        revisedDays: revised.training_days,
        lockedDayIndexes,
        startExecutionDay: plan.start_execution_day,
    });
    if (!merged) return { status: "skipped", reason: "day_count_changed" };
    if (!hasTrainingDayChanges(originalDays, merged)) return { status: "skipped", reason: "no_change" };

    const summary = `按学员私信补充调整：${cleanSummary(stageB.changesSummary) || "见调整后的训练日"}`;
    const { data: draft, error: draftError } = await db()
        .from("coach_plan_adjustment_drafts")
        .insert({
            job_id: null,
            feedback_id: null,
            plan_instance_id: plan.id,
            subscription_id: params.subscriptionId,
            coach_id: params.coachId,
            student_id: params.studentId,
            risk_level: riskNotes.length > 0 ? "high" : "medium",
            summary,
            proposed_patch: {
                source: "plan_intake",
                intakeJobId: params.intakeJobId,
                notes,
                riskNotes,
                lockedDayIndexes,
                baseDayKeys: originalDays.map(dayPrescriptionKey),
                updatedTrainingDays: merged,
            },
            status: "draft",
            requires_coach_review: true,
        })
        .select("id")
        .single();
    if (draftError || !draft?.id) throw new Error(draftError?.message || "insert_draft_failed");
    return { status: "drafted", draftId: String(draft.id), summary };
}
