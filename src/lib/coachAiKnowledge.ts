export const COACH_AI_KNOWLEDGE_CATEGORY_LABELS = {
    persona: "身份风格",
    philosophy: "训练理念",
    communication: "沟通策略",
    technique: "动作技术",
    program: "计划设计",
    nutrition: "营养补剂",
    injury: "伤病边界",
    faq: "常见问题",
    content: "内容运营",
    other: "其他资料",
} as const;

export type CoachAiKnowledgeCategory = keyof typeof COACH_AI_KNOWLEDGE_CATEGORY_LABELS;

export interface CoachAiKnowledgeDocument {
    id: string;
    title: string;
    category: CoachAiKnowledgeCategory;
    content: string;
    keywords?: string[];
    enabled?: boolean;
    priority?: number;
    updatedAt?: string;
}

export interface SelectedCoachAiKnowledge {
    contextText: string;
    selectedTitles: string[];
    totalChars: number;
}

const CATEGORY_ALIASES: Array<{
    category: CoachAiKnowledgeCategory;
    patterns: string[];
}> = [
    { category: "persona", patterns: ["persona", "角色", "身份", "人设", "分身"] },
    { category: "philosophy", patterns: ["philosophy", "理念", "原则", "训练哲学"] },
    { category: "communication", patterns: ["communication", "沟通", "转化", "续费", "学员分类"] },
    { category: "technique", patterns: ["technique", "动作", "技术", "纠错", "引体", "卧推", "深蹲", "硬拉", "划船"] },
    { category: "program", patterns: ["program", "计划", "周期", "分化", "编排"] },
    { category: "nutrition", patterns: ["nutrition", "supplement", "营养", "饮食", "补剂", "肌酸", "蛋白"] },
    { category: "injury", patterns: ["injury", "伤", "疼痛", "不适", "康复", "恢复", "滑囊炎"] },
    { category: "faq", patterns: ["faq", "常见问题", "问答", "答疑"] },
    { category: "content", patterns: ["content", "选题", "内容", "抖音", "视频号"] },
];

const CATEGORY_TRIGGER_WORDS: Record<CoachAiKnowledgeCategory, string[]> = {
    persona: ["你是谁", "马哥", "小马哥", "枭马葛", "服务", "价格", "报名"],
    philosophy: ["rpe", "容量", "强度", "力竭", "渐进", "超负荷", "为什么", "原理"],
    communication: ["续费", "退款", "延期", "怎么聊", "不回复", "流失", "报名", "咨询"],
    technique: ["动作", "技术", "姿势", "纠正", "视频", "引体", "卧推", "深蹲", "硬拉", "划船", "臂屈伸", "握距", "离心", "顶峰", "底部"],
    program: ["计划", "安排", "分化", "一周", "几练", "训练日", "组数", "次数", "重量", "rm", "周期", "减载", "调整"],
    nutrition: ["吃", "饮食", "营养", "补剂", "肌酸", "咖啡因", "氮泵", "蛋白", "碳水", "葡萄糖"],
    injury: ["疼", "痛", "伤", "不适", "肩", "腰", "膝", "肘", "腕", "恢复", "康复", "医生", "医院"],
    faq: ["rpe", "组休", "多久", "怎么做", "可以吗", "怎么办", "重量", "执行"],
    content: ["选题", "拍什么", "内容", "抖音", "短视频", "账号", "粉丝"],
    other: [],
};

const ALWAYS_LOAD_CATEGORIES = new Set<CoachAiKnowledgeCategory>([
    "persona",
    "philosophy",
    "communication",
    "injury",
]);

const KNOWN_CATEGORIES = new Set<CoachAiKnowledgeCategory>(
    Object.keys(COACH_AI_KNOWLEDGE_CATEGORY_LABELS) as CoachAiKnowledgeCategory[],
);

const DEFAULT_DISABLED_TITLE_PATTERNS = [
    "content_ideas",
    "system_prompt_template",
    "prompt_template",
    "提示词模板",
    "系统提示词模板",
];

const TITLE_CATEGORY_RULES: Array<{
    category: CoachAiKnowledgeCategory;
    patterns: string[];
}> = [
    { category: "persona", patterns: ["persona"] },
    { category: "philosophy", patterns: ["training_philosophy", "philosophy"] },
    { category: "communication", patterns: ["communication_guide", "communication"] },
    { category: "technique", patterns: ["exercise_technique_db", "technique"] },
    { category: "program", patterns: ["program_design", "program"] },
    { category: "nutrition", patterns: ["nutrition_supplements", "nutrition", "supplement"] },
    { category: "injury", patterns: ["injury_management", "injury"] },
    { category: "faq", patterns: ["faq_knowledge_base", "faq"] },
    { category: "content", patterns: ["content_ideas", "content"] },
    { category: "other", patterns: ["system_prompt_template", "prompt_template"] },
];

function normalizeText(value: string | null | undefined) {
    return (value || "").trim();
}

function includesAny(haystack: string, needles: string[]) {
    const text = haystack.toLowerCase();
    return needles.some((needle) => text.includes(needle.toLowerCase()));
}

function trimToBudget(value: string, maxChars: number) {
    if (value.length <= maxChars) return value;
    return `${value.slice(0, Math.max(0, maxChars))}\n...（该资料后续内容已截断）`;
}

export function inferCoachAiKnowledgeCategory(
    title: string,
    content = "",
): CoachAiKnowledgeCategory {
    const normalizedTitle = title.toLowerCase();
    for (const item of TITLE_CATEGORY_RULES) {
        if (includesAny(normalizedTitle, item.patterns)) return item.category;
    }

    const source = `${title}\n${content.slice(0, 500)}`.toLowerCase();
    for (const item of CATEGORY_ALIASES) {
        if (includesAny(source, item.patterns)) return item.category;
    }
    return "other";
}

export function shouldEnableCoachAiKnowledgeDocumentByDefault(
    title: string,
    category: CoachAiKnowledgeCategory,
) {
    const normalizedTitle = title.toLowerCase();
    if (DEFAULT_DISABLED_TITLE_PATTERNS.some((pattern) => normalizedTitle.includes(pattern))) {
        return false;
    }

    return category !== "content";
}

export function normalizeCoachAiKnowledgeDocuments(input: unknown): CoachAiKnowledgeDocument[] {
    if (!Array.isArray(input)) return [];

    const documents: Array<CoachAiKnowledgeDocument | null> = input
        .map((item, index) => {
            const raw = item as Partial<CoachAiKnowledgeDocument>;
            const title = normalizeText(raw.title) || `资料 ${index + 1}`;
            const content = normalizeText(raw.content);
            if (!content) return null;

            const rawCategory = normalizeText(raw.category);
            const category = KNOWN_CATEGORIES.has(rawCategory as CoachAiKnowledgeCategory)
                ? rawCategory as CoachAiKnowledgeCategory
                : inferCoachAiKnowledgeCategory(title, content);

            const keywords = Array.isArray(raw.keywords)
                ? raw.keywords.map((keyword) => normalizeText(String(keyword))).filter(Boolean).slice(0, 20)
                : [];

            return {
                id: normalizeText(raw.id) || `doc-${index + 1}`,
                title,
                category,
                content,
                keywords,
                enabled: typeof raw.enabled === "boolean"
                    ? raw.enabled
                    : shouldEnableCoachAiKnowledgeDocumentByDefault(title, category),
                priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 0,
                updatedAt: normalizeText(raw.updatedAt) || undefined,
            };
        });

    return documents.filter((item): item is CoachAiKnowledgeDocument => Boolean(item));
}

function scoreDocument(doc: CoachAiKnowledgeDocument, queryText: string) {
    const query = queryText.toLowerCase();
    let score = Number(doc.priority || 0);

    if (ALWAYS_LOAD_CATEGORIES.has(doc.category)) score += 100;
    if (includesAny(query, CATEGORY_TRIGGER_WORDS[doc.category])) score += 30;

    for (const keyword of doc.keywords || []) {
        if (keyword && query.includes(keyword.toLowerCase())) score += 12;
    }

    const title = doc.title.toLowerCase();
    if (title && query.includes(title)) score += 20;

    const docProbe = `${doc.title}\n${doc.content.slice(0, 1000)}`.toLowerCase();
    for (const words of Object.values(CATEGORY_TRIGGER_WORDS)) {
        for (const word of words) {
            const lowered = word.toLowerCase();
            if (query.includes(lowered) && docProbe.includes(lowered)) score += 3;
        }
    }

    return score;
}

function formatDocument(doc: CoachAiKnowledgeDocument, maxChars: number) {
    const label = COACH_AI_KNOWLEDGE_CATEGORY_LABELS[doc.category] || "资料";
    const content = trimToBudget(doc.content, maxChars);
    return `【${label}｜${doc.title}】\n${content}`;
}

export function selectCoachAiKnowledgeForPrompt(params: {
    documents: unknown;
    queryText: string;
    maxChars?: number;
    maxDocuments?: number;
}): SelectedCoachAiKnowledge {
    const docs = normalizeCoachAiKnowledgeDocuments(params.documents)
        .filter((doc) => doc.enabled !== false);
    const maxChars = params.maxChars ?? 9000;
    const maxDocuments = params.maxDocuments ?? 7;

    if (docs.length === 0 || maxChars <= 0 || maxDocuments <= 0) {
        return { contextText: "", selectedTitles: [], totalChars: 0 };
    }

    const scored = docs
        .map((doc) => ({ doc, score: scoreDocument(doc, params.queryText) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || (b.doc.priority || 0) - (a.doc.priority || 0));

    const selected: CoachAiKnowledgeDocument[] = [];
    const selectedIds = new Set<string>();

    for (const item of scored) {
        if (selected.length >= maxDocuments) break;
        if (selectedIds.has(item.doc.id)) continue;
        selected.push(item.doc);
        selectedIds.add(item.doc.id);
    }

    const chunks: string[] = [];
    let usedChars = 0;

    for (const doc of selected) {
        const remaining = maxChars - usedChars;
        if (remaining <= 120) break;
        const chunk = formatDocument(doc, Math.max(300, remaining - 80));
        chunks.push(chunk);
        usedChars += chunk.length + 2;
    }

    return {
        contextText: chunks.join("\n\n"),
        selectedTitles: selected.slice(0, chunks.length).map((doc) => doc.title),
        totalChars: chunks.join("\n\n").length,
    };
}
