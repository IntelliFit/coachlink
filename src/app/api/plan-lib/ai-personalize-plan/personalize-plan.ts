import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import {
    GeneratePersonalizedPlanInput,
    PersonalizePlanResult,
} from "./entity";
import { CoachPlanTrainingImplementationDay } from "../create-template/entity";

/**
 * Stage B: 让 LLM 基于选中模板的骨架，结合学员上下文进行个性化调整
 *
 * 如果 input.selectedTemplate 为 null，则要求 LLM 从零生成一个完整的计划。
 */
export async function personalizePlanWithLLM(
    input: GeneratePersonalizedPlanInput,
): Promise<PersonalizePlanResult> {
    const {
        studentName,
        studentProfile,
        questionnaireAnswers,
        prRecords,
        actionLibrary,
        selectedTemplate,
    } = input;

    const prompt = buildPersonalizePlanPrompt({
        studentName,
        studentProfile,
        questionnaireAnswers,
        prRecords,
        actionLibrary,
        selectedTemplate,
    });

    const rawJson = await callDeepSeek(prompt, {
        useReasoner: true, // 调整计划需要一定推理能力
        maxTokens: 6000,   // 计划 JSON 可能较长
    });

    const result = parseJsonResponse<{
        training_days: CoachPlanTrainingImplementationDay[];
        reasoning: string;
        changes_summary: string;
    }>(rawJson, "personalize-plan");

    return {
        trainingDays: result.training_days || [],
        reasoning: result.reasoning || "未提供推理",
        changesSummary: result.changes_summary || "未提供改动摘要",
    };
}

function buildPersonalizePlanPrompt(params: {
    studentName: string;
    studentProfile: any;
    questionnaireAnswers: any[];
    prRecords: any[];
    actionLibrary: any[];
    selectedTemplate: any;
}): string {
    const { studentName, studentProfile, questionnaireAnswers, prRecords, actionLibrary, selectedTemplate } = params;

    const hasTemplate = selectedTemplate && selectedTemplate.training_days;

    const templateSection = hasTemplate
        ? `【已选模板骨架】\n名称：${selectedTemplate.name}\n描述：${selectedTemplate.description || "无"}\n\ntraining_days:\n${JSON.stringify(selectedTemplate.training_days, null, 2)}`
        : `【已选模板骨架】\n无。请从零为学员设计一个完整的训练计划。`;

    return `你是一位专业的力量训练教练AI。

【学员】${studentName}

【学员档案】
${JSON.stringify(studentProfile ?? {}, null, 2)}

【问卷答案】
${JSON.stringify(questionnaireAnswers ?? [], null, 2)}

【最新PR记录（1RM）】
${JSON.stringify(prRecords ?? [], null, 2)}

【可用动作库（只能使用这些 actionId）】
${JSON.stringify(actionLibrary ?? [], null, 2)}

${templateSection}

任务：
${hasTemplate
            ? "根据学员上下文，对已选模板的 training_days 进行个性化调整。可以增删训练日、替换动作、调整组数/次数/休息时间。"
            : "从零设计一个完整的 training_days 训练计划。"}

严格规则：
1. 只能使用「可用动作库」里存在的 actionId。严禁编造不存在的 actionId。
2. 必须尊重学员在问卷 text 题中提到的伤病、禁忌动作、器械限制。
3. 每个动作的 weight/load 可以写 null，系统会自动根据 PR 计算。
4. 必须保持 training_days 的 JSON schema 不变：
   - 每个元素是 { type: "training" | "rest", dayIndex: number, note?: string, actionSets: [...] }
   - actionSets 中每个动作是 { type: "no-filter", actionId: string, setName: string, params: {...} }
5. 如果学员时间有限，可以压缩天数；如果学员追求高容量，可以增加组数。

必须返回 JSON（不要 markdown 代码块）：
{
  "training_days": [...],
  "reasoning": "调整理由（中文）",
  "changes_summary": "改动摘要（中文）"
}`;
}
