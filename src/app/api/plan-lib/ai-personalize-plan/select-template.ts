import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import {
    GeneratePersonalizedPlanInput,
    TemplateSelectionResult,
    TemplateSummary,
} from "./entity";

/**
 * Stage A: 让 LLM 从可用模板中选择最适合的一个作为骨架
 *
 * 为了节省 token，只给 LLM 看模板摘要（name/description/type/weekCount/dayCount），
 * 不传完整的 training_days。
 */
export async function selectTemplateWithLLM(
    input: GeneratePersonalizedPlanInput,
): Promise<TemplateSelectionResult> {
    const { studentProfile, questionnaireAnswers, availableTemplates, studentName } = input;

    // 如果没有可用模板，直接返回 null
    if (!availableTemplates || availableTemplates.length === 0) {
        return {
            templateId: null,
            reasoning: "教练没有可用的计划模板，将直接从零生成计划。",
            confidence: 1,
        };
    }

    const prompt = buildSelectTemplatePrompt({
        studentName,
        studentProfile,
        questionnaireAnswers,
        templates: availableTemplates,
    });

    const rawJson = await callDeepSeek(prompt, {
        useReasoner: false,
        maxTokens: 2000,
    });

    const result = parseJsonResponse<{
        template_id: string | null;
        reasoning: string;
        confidence: number;
    }>(rawJson, "select-template");

    return {
        templateId: result.template_id ?? null,
        reasoning: result.reasoning || "未提供推理",
        confidence: result.confidence ?? 0.5,
    };
}

function buildSelectTemplatePrompt(params: {
    studentName: string;
    studentProfile: any;
    questionnaireAnswers: any[];
    templates: TemplateSummary[];
}): string {
    const { studentName, studentProfile, questionnaireAnswers, templates } = params;

    const templateList = templates
        .map((t, idx) => {
            return `${idx + 1}. ID="${t.id}" | 名称="${t.name}" | 类型=${t.type || "未分类"} | 描述="${t.description || "无"}" | ${t.weekCount}周/${t.dayCount}天`;
        })
        .join("\n");

    return `你是一位专业的力量训练教练AI。请根据学员档案和问卷答案，从下面的模板列表中为学员选择最适合的「计划骨架」。

【学员】${studentName}

【学员档案】
${JSON.stringify(studentProfile ?? {}, null, 2)}

【问卷答案】
${JSON.stringify(questionnaireAnswers ?? [], null, 2)}

【可用模板列表】
${templateList}

任务：
1. 分析学员的目标、身体状况、时间限制和训练偏好。
2. 从列表中选择 **一个** 最适合的模板 ID 作为骨架。如果没有合适的，返回 null。
3. 用一句话说明选择理由（中文）。

必须返回 JSON（不要 markdown 代码块）：
{
  "template_id": "uuid或null",
  "reasoning": "选择理由",
  "confidence": 0.0~1.0
}`;
}
