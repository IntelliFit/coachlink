import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import { formatTemplateToPlanScript, parsePlanScript } from "@/lib/planScript";
import {
    ActionLibraryEntry,
    GeneratePersonalizedPlanInput,
    PersonalizePlanResult,
} from "./entity";
import type { CoachActionRow, ItemType } from "@/types";
import {
    buildQuestionnaireIntentSection,
    extractQuestionnaireIntent,
    validateTrainingDaysAgainstIntent,
} from "./questionnaire-intent";

const STAGE_B_PRIMARY_OPTIONS = {
    useReasoner: false,
    maxTokens: 12000,
} as const;

const STAGE_B_RETRY_OPTIONS = {
    useReasoner: false,
    maxTokens: 16000,
} as const;

const DEFAULT_PHASE_WEEKS_WITHOUT_TEMPLATE = 8;
const MAX_PHASE_WEEKS_WITHOUT_TEMPLATE = 16;

export async function personalizePlanWithLLM(
    input: GeneratePersonalizedPlanInput,
): Promise<PersonalizePlanResult> {
    const {
        studentName,
        subscribedWeeks,
        studentProfile,
        questionnaireAnswers,
        prRecords,
        actionLibrary,
        selectedTemplate,
    } = input;

    const targetWeeks = inferPlanPhaseWeeks({
        subscribedWeeks,
        selectedTemplate,
        availableTemplates: input.availableTemplates,
    });
    const questionnaireIntent = extractQuestionnaireIntent(questionnaireAnswers);
    const actionRefs = buildScriptActionRefs(actionLibrary, selectedTemplate);
    const actionNameMap = buildActionNameMap(actionLibrary, selectedTemplate);

    return generatePlanScriptAttempt({
        input,
        targetWeeks,
        questionnaireIntent,
        actionRefs,
        actionNameMap,
    });
}

function buildPersonalizePlanPrompt(params: {
    studentName: string;
    purchasedWeeks?: number | null;
    subscribedWeeks: number;
    studentProfile: any;
    questionnaireAnswers: any[];
    prRecords: any[];
    actionLibrary: any[];
    selectedTemplate: any;
    questionnaireIntentSection: string;
    correctionHint?: string;
}): string {
    const {
        studentName,
        purchasedWeeks,
        subscribedWeeks,
        studentProfile,
        questionnaireAnswers,
        prRecords,
        actionLibrary,
        selectedTemplate,
        questionnaireIntentSection,
        correctionHint,
    } = params;

    const hasTemplate = selectedTemplate && selectedTemplate.training_days;
    const selectedTemplateScript = hasTemplate
        ? formatTemplateToPlanScript({
            description: selectedTemplate.description,
            trainingDays: selectedTemplate.training_days,
            actionNameById: buildActionNameMap(actionLibrary, selectedTemplate),
        })
        : null;
    const templateSection = hasTemplate
        ? `【已选模板骨架】\n名称：${selectedTemplate.name}\n描述：${selectedTemplate.description || "无"}\n\nplan_script:\n${selectedTemplateScript}`
        : "【已选模板骨架】\n无。当前需要你根据学员上下文与可用动作库，从零设计一个可执行计划。";
    const actionLibrarySummary = buildActionLibrarySummary(actionLibrary, selectedTemplate);

    return `你是一位专业的力量训练教练AI。

【学员】${studentName}

【学员档案】
${JSON.stringify(studentProfile ?? {}, null, 2)}

【问卷答案】
${JSON.stringify(questionnaireAnswers ?? [], null, 2)}

【问卷意图提炼（高优先级约束）】
${questionnaireIntentSection}

【最新PR记录（1RM）】
${JSON.stringify(prRecords ?? [], null, 2)}

【学员已购周期（长期权益参考）】
${purchasedWeeks && purchasedWeeks > 0 ? `已购 ${purchasedWeeks} 周。` : "未提供已购周数。"}注意：这不是要求你一次性生成满全部已购周数。

【本次计划输出周期】
本次只需要生成 ${subscribedWeeks} 周，也就是完整的 ${subscribedWeeks * 7} 天日历（训练日 + 休息日）。

【可用动作库（只能使用这些动作名 / actionId）】
${actionLibrarySummary}

${templateSection}

${correctionHint ? `【上一次结果的纠偏要求】\n${correctionHint}\n` : ""}

任务：
${hasTemplate
            ? `根据学员上下文，对已选模板的 plan_script 进行保守个性化调整。优先保留模板结构和模板动作，但如果模板包含与问卷硬约束冲突的专项主项，必须删掉或替换。本次输出应以当前骨架周期为准，收敛为 ${subscribedWeeks} 周完整计划。不要为了匹配学员的总已购周数，把 4~16 周模板机械重复扩展成 40 周之类的超长计划。`
            : `当前没有可用模板，请直接基于学员上下文和可用动作库，从零生成一个可执行计划。本次单阶段计划先生成 ${subscribedWeeks} 周，不要一次性输出超长年度计划。`}

严格规则：
1. 只能使用“可用动作库 / 已选模板骨架”里存在的动作名称。严禁编造不存在的动作名称或 actionId。
2. 必须尊重学员问卷文本中提到的伤病、禁忌动作、器械限制。
3. 必须严格遵守“问卷意图提炼”里的高优先级约束。尤其当问卷明确只想优先发展某一个专项（例如只练臂屈伸）时，不要保留对立专项（例如引体）的主项动作。
4. 如果模板是组合模板，但问卷明确只保留单一专项，你必须把组合模板改造成单专项计划，而不是机械保留另一专项主项。
5. 你输出的不是 training_days JSON，而是紧凑计划脚本（plan_script）。系统会自动把脚本编译成 JSON。
6. 动作行必须使用这个 DSL：
   - 周标题：W1 / W2 / W3 ...
   - 训练日标题：D1 / D2 / D3 ...（1-7 表示周内第几天）
   - 休息日：D3 off
   - 休息日备注：优先写成 D3 off #备注；如果另起一行，也只能写在该休息日下面
   - 训练日备注：!备注文本
   - 动作行：动作名 组数x次数 @强度 r休息秒 #备注
   - 强度示例：@5rm / @75% / @20kg
   - 例子：
     W1
     D1
     深蹲 5x5 @5rm r180
     卧推 4x6 @70% r150
     D2 off #有氧：慢走30分钟
7. 每个训练动作都必须写“动作名”，并且动作名必须能在可用动作库或模板骨架中精确找到。
8. 必须输出完整 ${subscribedWeeks} 周、共 ${subscribedWeeks * 7} 天的周历。即使学员是每周 2-3 练，也要把休息日一起补齐，不能只输出训练日。
9. 如果问卷明确写了“每周训练 X 次”，则每一个 W 周块都必须恰好安排 X 个训练日，不能多也不能少。
10. 如果学员时间有限，可以降低每次训练容量，但不能违反问卷里给出的每周训练次数，也不能缩短总周数。
11. 不要因为信息不足而把所有训练日都改成休息日；如果已有模板，信息不足时应尽量保留模板训练日；如果没有模板，也必须尽量给出完整可执行计划。
12. 返回结果必须至少包含 1 个带动作行的训练日。
13. 严禁写出 \`D2 off !备注\` 这种格式；\`!备注\` 默认用于训练日备注。休息日如果要写说明，请使用 \`D2 off #备注\`。
14. 学员“已购周数”只代表长期订阅权益，不代表本次单阶段计划必须铺满全部周数。严禁为了对齐已购 40 周，把短骨架重复扩写成 40 周计划。

必须返回 JSON（不要 markdown 代码块，不要额外解释）：
{
  "plan_script": "W1\\nD1\\n深蹲 5x5 @5rm r180\\n...",
  "reasoning": "调整理由（中文）",
  "changes_summary": "改动摘要（中文）"
}`;
}

async function generatePlanScriptAttempt(params: {
    input: GeneratePersonalizedPlanInput;
    targetWeeks: number;
    questionnaireIntent: ReturnType<typeof extractQuestionnaireIntent>;
    actionRefs: Array<Pick<CoachActionRow, "id" | "name" | "type">>;
    actionNameMap: Record<string, string>;
    correctionHint?: string;
}): Promise<PersonalizePlanResult> {
    const {
        input,
        targetWeeks,
        questionnaireIntent,
        actionRefs,
        actionNameMap,
        correctionHint,
    } = params;

    const result = await requestPlanScriptResult({
        input,
        targetWeeks,
        questionnaireIntentSection: buildQuestionnaireIntentSection(questionnaireIntent),
        correctionHint,
    });

    const planScript = String(result.plan_script || "").trim();
    if (!planScript) {
        return {
            trainingDays: [],
            planScript: "",
            reasoning: result.reasoning || "未提供推理",
            changesSummary: result.changes_summary || "未提供改动摘要",
        };
    }

    let parseResult;
    try {
        parseResult = parsePlanScript({
            script: planScript,
            actions: actionRefs,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误";
        throw new Error(`AI 生成的计划脚本无法编译：${message}`);
    }

    const trainingDays = parseResult.days || [];
    const intentViolations = validateTrainingDaysAgainstIntent({
        trainingDays,
        actionNameById: actionNameMap,
        intent: questionnaireIntent,
    });

    if (intentViolations.length > 0) {
        if (!correctionHint) {
            return generatePlanScriptAttempt({
                input,
                targetWeeks,
                questionnaireIntent,
                actionRefs,
                actionNameMap,
                correctionHint: `你上一次的结果违反了问卷硬约束：${intentViolations.join("；")}。请完全重写 plan_script，删除冲突专项，严格按问卷偏好输出。`,
            });
        }
        throw new Error(`AI 生成结果违反问卷硬约束：${intentViolations.join("；")}`);
    }

    return {
        trainingDays,
        planScript,
        reasoning: result.reasoning || "未提供推理",
        changesSummary: result.changes_summary || "未提供改动摘要",
    };
}

async function requestPlanScriptResult(params: {
    input: GeneratePersonalizedPlanInput;
    targetWeeks: number;
    questionnaireIntentSection: string;
    correctionHint?: string;
}): Promise<{
    plan_script: string;
    reasoning: string;
    changes_summary: string;
}> {
    const { input, targetWeeks, questionnaireIntentSection, correctionHint } = params;

    const attempts = [
        {
            label: "primary",
            options: STAGE_B_PRIMARY_OPTIONS,
            extraCorrectionHint: "",
        },
        {
            label: "retry",
            options: STAGE_B_RETRY_OPTIONS,
            extraCorrectionHint:
                "你上一次的输出疑似被截断、JSON 不完整或内容不符合 JSON 结构。请重新输出一次，严格只返回完整 JSON，不要省略末尾，不要输出任何额外说明。",
        },
    ] as const;

    let lastError: unknown = null;

    for (const attempt of attempts) {
        const prompt = buildPersonalizePlanPrompt({
            studentName: input.studentName,
            purchasedWeeks: input.subscribedWeeks,
            subscribedWeeks: targetWeeks,
            studentProfile: input.studentProfile,
            questionnaireAnswers: input.questionnaireAnswers,
            prRecords: input.prRecords,
            actionLibrary: input.actionLibrary,
            selectedTemplate: input.selectedTemplate,
            questionnaireIntentSection,
            correctionHint: mergeCorrectionHints(correctionHint, attempt.extraCorrectionHint),
        });

        try {
            const rawJson = await callDeepSeek(prompt, attempt.options);
            return parseJsonResponse<{
                plan_script: string;
                reasoning: string;
                changes_summary: string;
            }>(rawJson, `personalize-plan-${attempt.label}`);
        } catch (error) {
            lastError = error;
            console.warn(
                `[personalize-plan] Stage B ${attempt.label} attempt failed:`,
                error instanceof Error ? error.message : error,
            );
        }
    }

    throw lastError instanceof Error ? lastError : new Error("AI 生成计划脚本失败");
}

function mergeCorrectionHints(baseHint?: string, extraHint?: string): string | undefined {
    const hints = [baseHint, extraHint]
        .map((item) => String(item || "").trim())
        .filter(Boolean);

    return hints.length > 0 ? hints.join("\n") : undefined;
}

function buildScriptActionRefs(
    actionLibrary: ActionLibraryEntry[],
    selectedTemplate: any,
): Array<Pick<CoachActionRow, "id" | "name" | "type">> {
    const refs = new Map<string, Pick<CoachActionRow, "id" | "name" | "type">>();

    for (const action of actionLibrary || []) {
        if (!action?.id || !action?.name) continue;
        refs.set(action.id, {
            id: action.id,
            name: action.name,
            type: normalizeItemType(action.type),
        });
    }

    for (const day of selectedTemplate?.training_days || []) {
        for (const actionSet of day?.actionSets || []) {
            const actionId = String(actionSet?.actionId || "").trim();
            const actionName = String(
                actionSet?.setName ||
                actionSet?.params?.action_name ||
                "",
            ).trim();
            if (!actionId || !actionName || refs.has(actionId)) continue;
            refs.set(actionId, {
                id: actionId,
                name: actionName,
                type: normalizeItemType(actionSet?.itemType),
            });
        }
    }

    return Array.from(refs.values());
}

function buildActionNameMap(
    actionLibrary: ActionLibraryEntry[],
    selectedTemplate: any,
): Record<string, string> {
    const map: Record<string, string> = {};
    for (const action of buildScriptActionRefs(actionLibrary, selectedTemplate)) {
        map[action.id] = action.name;
    }
    return map;
}

function buildActionLibrarySummary(
    actionLibrary: ActionLibraryEntry[],
    selectedTemplate: any,
): string {
    const refs = buildScriptActionRefs(actionLibrary, selectedTemplate);
    if (refs.length === 0) return "无";

    return refs
        .map((action) => {
            const source = (actionLibrary || []).some((entry) => entry.id === action.id)
                ? "动作库"
                : "模板骨架";
            return `- ${action.name} | actionId=${action.id} | type=${action.type || "STRENGTH"} | source=${source}`;
        })
        .join("\n");
}

function normalizeItemType(value: unknown): ItemType {
    const raw = String(value || "").toUpperCase();
    if (raw === "CARDIO" || raw === "DIET" || raw === "HABIT" || raw === "STRENGTH") {
        return raw;
    }
    return "STRENGTH";
}

function inferWeeksFromTemplate(selectedTemplate: any): number {
    const dayCount = Array.isArray(selectedTemplate?.training_days) ? selectedTemplate.training_days.length : 0;
    if (dayCount <= 0) {
        return 0;
    }
    return Math.max(1, Math.ceil(dayCount / 7));
}

function inferWeeksFromAvailableTemplates(availableTemplates: Array<{ weekCount?: number | null }> = []): number {
    const weekCounts = availableTemplates
        .map((template) => Number(template?.weekCount || 0))
        .filter((value) => Number.isFinite(value) && value > 0);

    if (weekCounts.length === 0) {
        return 0;
    }

    return Math.max(...weekCounts);
}

export function inferPlanPhaseWeeks(params: {
    subscribedWeeks?: number | null;
    selectedTemplate?: any;
    availableTemplates?: Array<{ weekCount?: number | null }>;
}): number {
    const templateWeeks = inferWeeksFromTemplate(params.selectedTemplate);
    if (templateWeeks > 0) {
        return templateWeeks;
    }

    const purchasedWeeks = Number(params.subscribedWeeks || 0);
    const longestAvailableWeeks = inferWeeksFromAvailableTemplates(params.availableTemplates);

    if (longestAvailableWeeks > 0) {
        if (Number.isFinite(purchasedWeeks) && purchasedWeeks > 0) {
            return Math.max(
                1,
                Math.min(purchasedWeeks, longestAvailableWeeks, MAX_PHASE_WEEKS_WITHOUT_TEMPLATE),
            );
        }
        return Math.max(1, Math.min(longestAvailableWeeks, MAX_PHASE_WEEKS_WITHOUT_TEMPLATE));
    }

    if (Number.isFinite(purchasedWeeks) && purchasedWeeks > 0) {
        return Math.max(1, Math.min(purchasedWeeks, DEFAULT_PHASE_WEEKS_WITHOUT_TEMPLATE));
    }

    return 1;
}
