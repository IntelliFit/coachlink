import type {
    QuestionnaireDocument,
    QuestionnaireEditorType,
    TrainingItem,
} from "@/types/questionnaires";

/**
 * 把任意历史 shape 的 questions 字段归一为 QuestionnaireDocument。
 *
 * 历史 shape：
 *   1. 纯数组：[...]
 *   2. { questions: [...] }
 *   3. { editorType, questions: [...] }                ← 目标 shape
 *   4. { questions: { questions: [...] } }
 */
export function parseQuestionnaireDocument(raw: any): QuestionnaireDocument {
    if (Array.isArray(raw)) {
        return {
            editorType: hasFlowMarker(raw) ? "flow" : "simple",
            questions: raw as TrainingItem[],
        };
    }

    if (raw && typeof raw === "object") {
        const inner: any[] = Array.isArray(raw.questions)
            ? raw.questions
            : Array.isArray(raw?.questions?.questions)
                ? raw.questions.questions
                : [];
        const explicit: QuestionnaireEditorType | undefined =
            raw.editorType === "flow" || raw.editorType === "simple"
                ? raw.editorType
                : undefined;
        return {
            editorType: explicit ?? (hasFlowMarker(inner) ? "flow" : "simple"),
            questions: inner as TrainingItem[],
        };
    }

    return { editorType: "simple", questions: [] };
}

function hasFlowMarker(items: any[]): boolean {
    // 字段**存在**即视为 flow 标记。
    // - `next: null` 是合法的"结束问卷"语义（参见 BaseQuestion.next 注释），
    //   但值是 null，所以不能用 `item.next` 真值判断。
    // - 与 SQL 迁移 (`q ? 'branching' OR q ? 'next'`) 行为保持一致。
    return Array.isArray(items)
        && items.some((item: any) =>
            item
            && typeof item === "object"
            && ("branching" in item || "next" in item)
        );
}

/**
 * 给每条 question 补稳定 id。返回 normalized + 是否有变化。
 *
 * 用途：
 * - 历史数据可能是字符串数组（极老）或对象但缺 id；分支跳转/历史答案匹配都依赖稳定 id。
 * - 调用方拿到 changed=true 时应把 normalized 写回库。
 */
export function ensureQuestionIds(questions: any[]): {
    normalized: TrainingItem[];
    changed: boolean;
} {
    let changed = false;
    const normalized = (Array.isArray(questions) ? questions : []).map((q: any) => {
        if (typeof q === "string") {
            changed = true;
            return {
                id: crypto.randomUUID(),
                type: "text",
                question: q,
            } as any;
        }

        if (!q || typeof q !== "object") return q as any;

        if (!q.id) {
            changed = true;
            return { ...q, id: crypto.randomUUID() };
        }
        return q as any;
    });

    return { normalized: normalized as unknown as TrainingItem[], changed };
}
