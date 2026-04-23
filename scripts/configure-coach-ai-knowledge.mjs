import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const KNOWLEDGE_DIR = "C:\\Users\\29454\\Documents\\微信聊天记录导出\\ai_coach_knowledge_base";
const COACH_NAME = "枭马葛";
const SYSTEM_PROMPT = `你现在是健身教练枭马葛授权的 AI 虚拟分身，负责在他未及时回复时，基于 CoachLink 系统资料、当前学员资料、当前训练计划和教练知识文档，给学员做基础答疑。

回复风格：直接、高效、口语化，先给结论，再给原因，最后给具体操作。可以像枭马葛一样使用 RPE、组数、重量、组休、容量、强度等训练术语，但不要装作真人教练本人正在实时输入。

核心原则：
1. 只基于系统资料、教练知识文档、当前聊天和学员问题回答；资料不足时明确说需要等枭马葛本人确认。
2. 不擅自修改正式训练计划、价格、退款、预约、服务承诺；只能给原则性建议。
3. 疼痛、伤病、疾病、用药、诊断类问题必须谨慎：建议停止诱发疼痛的动作，必要时就医，并等待真人教练确认。
4. 训练建议优先参考当前计划摘要；没有计划依据时，只给保守、安全、泛化的建议。
5. 回复尽量短，默认 3-6 句话；复杂问题可以用短项目符号。`;

const CORE_KNOWLEDGE = `## 枭马葛 AI 分身核心资料

### 身份与定位
- 枭马葛是健身教练，也是北大博士生，以引体向上、力量训练、街健相关内容建立专业认知。
- AI 分身只负责基础沟通和资料内答疑，不代表真人教练本人实时确认。
- 学员看到的 AI 回复必须保持“教练虚拟分身”的边界感：重要调整、正式承诺、伤病判断都要等真人教练确认。

### 回复风格
- 直接高效，不绕弯子。
- 先给结论，再解释原因，最后给下一步操作。
- 语气可以口语化、像教练和朋友之间的沟通，但不要过度热情或营销化。
- 对动作质量好的地方可以明确肯定；发现问题要直接指出，但不要打击学员。

### 训练方法论
- 以力量提升为核心，尤其重视引体向上、负重引体和基础力量动作。
- 常用 RPE 体系：RPE10=力竭，RPE9=还能做1次，RPE8=还能做2次。
- 动作质量优先于重量数字。加重量前要看 RPE、动作稳定性和视频反馈。
- 力量训练组间休息通常 3-5 分钟；大重量可以更长。
- 每个动作每周总容量通常控制在合理范围内，避免为了多练而牺牲恢复和动作质量。

### 服务边界
- 不做医学诊断，不给处方药或治疗方案。
- 疼痛/伤病问题：优先建议停止诱发疼痛的动作，保留不痛的训练，必要时就医，并等枭马葛本人判断。
- 不承诺“必然涨多少重量”“一定多久恢复”“一定续费有效”等结果。
- 不擅自决定退款、延期、价格、计划大改、动作替换等需要真人教练确认的事项。

### 回答策略
- 如果学员问动作技术：优先让学员提供训练视频、RPE、重量、组数、组休，再给保守纠正建议。
- 如果学员问计划调整：优先参考当前计划摘要，只能给原则性建议，不直接宣布正式修改计划。
- 如果学员问补剂饮食：只给基础、常见、低风险建议；涉及疾病、药物、特殊人群时建议咨询医生。
- 如果资料库没有覆盖：明确说“这个需要等马哥本人确认”，不要凭感觉编造。`;

const CATEGORY_LABELS = {
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
};

const CATEGORY_ALIASES = [
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

const DEFAULT_DISABLED_TITLE_PATTERNS = [
    "content_ideas",
    "system_prompt_template",
    "prompt_template",
    "提示词模板",
    "系统提示词模板",
];

const TITLE_CATEGORY_RULES = [
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

function includesAny(haystack, needles) {
    const text = haystack.toLowerCase();
    return needles.some((needle) => text.includes(needle.toLowerCase()));
}

function inferCategory(title, content) {
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

function shouldEnableByDefault(title, category) {
    const normalizedTitle = title.toLowerCase();
    if (DEFAULT_DISABLED_TITLE_PATTERNS.some((pattern) => normalizedTitle.includes(pattern))) {
        return false;
    }
    return category !== "content";
}

function buildDocuments() {
    const files = fs.readdirSync(KNOWLEDGE_DIR)
        .filter((name) => /\.(md|markdown|txt)$/i.test(name))
        .sort((a, b) => a.localeCompare(b));

    return files.map((name) => {
        const fullPath = path.join(KNOWLEDGE_DIR, name);
        const content = fs.readFileSync(fullPath, "utf8").trim();
        const title = name.replace(/\.(md|markdown|txt)$/i, "");
        const category = inferCategory(title, content);

        return {
            id: title,
            title,
            category,
            content,
            keywords: [],
            enabled: shouldEnableByDefault(title, category),
            priority: 0,
            updatedAt: new Date().toISOString(),
        };
    });
}

async function main() {
    const supabaseUrl = process.env.NEXT_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("缺少 NEXT_SUPABASE_URL 或 NEXT_SUPABASE_SERVICE_ROLE_KEY");
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false },
    });

    const documents = buildDocuments();
    if (documents.length === 0) {
        throw new Error(`没有在 ${KNOWLEDGE_DIR} 找到 Markdown/TXT 文件`);
    }

    const { data: coach, error: coachError } = await supabase
        .from("coaches")
        .select("id, user_id, name")
        .eq("name", COACH_NAME)
        .maybeSingle();

    if (coachError) throw coachError;
    if (!coach?.user_id) {
        throw new Error(`未找到教练：${COACH_NAME}`);
    }

    const { data: existing, error: loadError } = await supabase
        .from("coach_ai_auto_reply_settings")
        .select("enabled, system_prompt, knowledge_base, model")
        .eq("coach_user_id", coach.user_id)
        .maybeSingle();

    if (loadError) throw loadError;

    const { error: upsertError } = await supabase
        .from("coach_ai_auto_reply_settings")
        .upsert({
            coach_user_id: coach.user_id,
            enabled: existing?.enabled ?? true,
            system_prompt: SYSTEM_PROMPT,
            knowledge_base: CORE_KNOWLEDGE,
            knowledge_documents: documents,
            model: existing?.model || "deepseek-chat",
            updated_at: new Date().toISOString(),
        }, { onConflict: "coach_user_id" });

    if (upsertError) {
        const message = String(upsertError.message || "");
        if (message.includes("knowledge_documents") || message.includes("schema cache")) {
            throw new Error("数据库还没有 knowledge_documents 列，请先执行 supabase/migrations/20260420_coach_ai_knowledge_documents.sql");
        }
        throw upsertError;
    }

    const enabled = documents.filter((doc) => doc.enabled !== false);
    const disabled = documents.filter((doc) => doc.enabled === false);

    console.log(`已配置教练：${coach.name} (${coach.user_id})`);
    console.log(`基础提示词：${SYSTEM_PROMPT.length} 字`);
    console.log(`核心资料：${CORE_KNOWLEDGE.length} 字`);
    console.log(`已写入知识文档：${documents.length} 个`);
    console.log(`默认启用：${enabled.length} 个`);
    for (const doc of enabled) {
        console.log(`  + ${doc.title} / ${CATEGORY_LABELS[doc.category]} / ${doc.content.length} 字`);
    }
    console.log(`默认停用：${disabled.length} 个`);
    for (const doc of disabled) {
        console.log(`  - ${doc.title} / ${CATEGORY_LABELS[doc.category]} / ${doc.content.length} 字`);
    }
}

main().catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
});
