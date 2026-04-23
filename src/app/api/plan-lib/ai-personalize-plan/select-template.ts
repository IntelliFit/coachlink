import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import {
    GeneratePersonalizedPlanInput,
    TemplateSelectionResult,
    TemplateSummary,
} from "./entity";
import {
    buildQuestionnaireIntentSection,
    extractQuestionnaireIntent,
} from "./questionnaire-intent";

export async function selectTemplateWithLLM(
    input: GeneratePersonalizedPlanInput,
): Promise<TemplateSelectionResult> {
    const { studentProfile, questionnaireAnswers, availableTemplates, studentName } = input;

    if (!availableTemplates || availableTemplates.length === 0) {
        return {
            templateId: null,
            source: "none",
            reasoning: "教练当前没有可用模板，将直接从零生成计划。",
            confidence: 1,
        };
    }

    const prompt = buildSelectTemplatePrompt({
        studentName,
        studentProfile,
        questionnaireAnswers,
        templates: availableTemplates,
        questionnaireIntentSection: buildQuestionnaireIntentSection(
            extractQuestionnaireIntent(questionnaireAnswers),
        ),
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
        source: result.template_id ? (availableTemplates.find((tpl) => tpl.id === result.template_id)?.source || "template") : "none",
        reasoning: result.reasoning || "未提供推理",
        confidence: result.confidence ?? 0.5,
    };
}

function buildSelectTemplatePrompt(params: {
    studentName: string;
    studentProfile: any;
    questionnaireAnswers: any[];
    templates: TemplateSummary[];
    questionnaireIntentSection: string;
}): string {
    const { studentName, studentProfile, questionnaireAnswers, templates, questionnaireIntentSection } = params;

    const templateList = templates
        .map((t, idx) => {
            const focusSummary = Array.isArray((t.metadata as any)?.aiFocusDomains) && (t.metadata as any).aiFocusDomains.length > 0
                ? ` | 专项=${((t.metadata as any).aiFocusDomains as string[]).join("/")}`
                : "";
            return `${idx + 1}. ID="${t.id}" | 来源=${t.source === "instance" ? "历史计划骨架" : "模板库"} | 名称="${t.name}" | 类型=${t.type || "未分类"}${focusSummary} | 描述="${t.description || "无"}" | ${t.weekCount}周/${t.dayCount}天`;
        })
        .join("\n");

    return `你是一位专业的力量训练教练AI。请根据学员档案和问卷答案，从下面的模板列表中为学员选择最适合的计划骨架。

【学员】${studentName}

【学员档案】
${JSON.stringify(studentProfile ?? {}, null, 2)}

【问卷答案】
${JSON.stringify(questionnaireAnswers ?? [], null, 2)}

【问卷意图提炼（高优先级约束）】
${questionnaireIntentSection}

【可用模板列表】
${templateList}

任务：
1. 分析学员的目标、身体状况、时间限制和训练偏好。
2. 如果问卷明确只保留单一专项（例如只练臂屈伸），优先选择对应的单专项模板；除非候选里完全没有更合适的单专项骨架，否则不要优先选组合模板。
3. 从列表中选择一个最适合的模板/历史计划骨架 ID 作为骨架。即使没有“完全匹配”的候选，也应优先选择“最接近、最容易改造”的骨架，而不是轻易返回 null。
4. 只有在候选列表里确实没有任何可以借用的骨架时，才返回 null。
5. 用一句话说明选择理由（中文）。

必须返回 JSON（不要 markdown 代码块）：
{
  "template_id": "uuid或null",
  "reasoning": "选择理由",
  "confidence": 0.0~1.0
}`;
}
