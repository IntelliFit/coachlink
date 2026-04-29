import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
    GeminiParsedAction,
    ParseActionsDto,
    ParseActionsResponseDto,
    ParsedActionInfo,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import { CoachActionRow, ItemType } from "@/types";
import {
    findBestExistingActionMatch,
    inferStrengthAttrs,
    isLikelyNonActionName,
    normalizeTextForActionExtraction,
    normalizeActionNameForMatch,
    sanitizeActionName,
    splitPlanGlobalPreface,
} from "@/lib/planImportText";
import {
    getSmartImportTraceIdFromHeaders,
    isSmartImportTraceEnabled,
    tryTrace,
    writeTraceJson,
    writeTraceMetaOnce,
    writeTraceText,
} from "@/lib/smartImportTrace";

/**
 * 阶段1：解析动作
 * 从用户粘贴的训练计划文本中提取动作列表，并与现有动作库进行匹配
 */
export async function POST(req: Request) {
    const { text } = await req.json() as ParseActionsDto;
    const traceEnabled = isSmartImportTraceEnabled();
    const traceId = getSmartImportTraceIdFromHeaders(req.headers);

    // 检查用户登录和教练权限
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    if (!text || text.trim().length === 0) {
        return NextResponse.json({
            success: false,
            message: "请提供训练计划文本",
        }, { status: 400 });
    }

    try {
        await tryTrace(traceEnabled, traceId, async (id) => {
            await writeTraceMetaOnce(id, {
                createdAt: new Date().toISOString(),
                stage: "parse-actions",
                model: "deepseek-v4-flash",
            });
            await writeTraceText(id, "stage1.input.txt", String(text ?? ""));
        });

        // 获取当前教练的所有动作
        const { data: existingActions, error: actionsError } = await supabase
            .from("coach_actions")
            .select("*")
            .eq("coach_id", userId);

        if (actionsError) {
            console.error("Error fetching actions:", actionsError);
            return NextResponse.json({
                success: false,
                message: "获取动作库失败",
            }, { status: 500 });
        }

        // 仅用于动作提取阶段：将“全局说明”与正文拆分，避免热身/说明污染动作库
        const split = splitPlanGlobalPreface(text);
        const { bodyText } = split;
        const textForActions = bodyText.trim() ? bodyText : text;

        // 对文本做轻量规则化，减少 “动作名+强度” 被黏在一起的情况
        const normalizedText = normalizeTextForActionExtraction(textForActions);
        await tryTrace(traceEnabled, traceId, async (id) => {
            await writeTraceJson(id, "stage1.splitPreface.json", split);
            await writeTraceText(id, "stage1.normalized.txt", normalizedText);
        });

        // 构建 Prompt
        const prompt = buildParseActionsPrompt(
            normalizedText,
            existingActions || [],
        );
        await tryTrace(traceEnabled, traceId, async (id) => {
            await writeTraceText(id, "stage1.prompt.txt", prompt);
        });

        // 上限过大时 Gemini 可能把 completion 预算几乎全用在 reasoning_tokens；16k 足够完整 JSON 且控成本
        const response = await callDeepSeek(prompt, { maxTokens: 16384 });
        await tryTrace(traceEnabled, traceId, async (id) => {
            await writeTraceText(id, "stage1.raw.txt", response);
        });
        const parsedResult = parseJsonResponse<
            { actions: GeminiParsedAction[] }
        >(response);
        await tryTrace(traceEnabled, traceId, async (id) => {
            await writeTraceJson(id, "stage1.parsed.json", parsedResult);
        });

        // 后处理：去掉动作名中误包含的强度/组次/休息等描述，并过滤明显非动作的条目
        const cleanedActions = (parsedResult.actions || [])
            .map((a) => ({
                ...a,
                name: sanitizeActionName(a.name),
            }))
            .filter((a) => !isLikelyNonActionName(a.name));

        // 如果过滤过头导致为空，则退回只做 sanitize，不做过滤（避免接口返回空）
        const finalParsedActions = cleanedActions.length > 0
            ? cleanedActions
            : (parsedResult.actions || []).map((a) => ({
                ...a,
                name: sanitizeActionName(a.name),
            }));

        // 处理解析结果：尽可能匹配并复用已有动作，避免“随便新建重复动作”
        const existingById = new Map<string, CoachActionRow>();
        const existingLite = (existingActions || []).map((a) => ({
            id: a.id,
            name: a.name,
        }));
        for (const a of existingActions || []) existingById.set(a.id, a);

        // 1) 用确定性匹配补全/纠正 matchedExistingId
        // 2) 如果匹配到已有动作，则使用已有动作的属性（自动计算/自重等）
        // 3) 将同义/简称（映射到同一个 existingId）合并，避免重复新建
        const merged = new Map<string, ParsedActionInfo & { _idx: number }>();
        const defaultAttrsByType: Record<ItemType, string[]> = {
            STRENGTH: ["组数", "次数", "强度", "休息时间"],
            CARDIO: ["距离", "配速", "持续时间"],
            DIET: ["食物清单", "热量", "宏量营养"],
            HABIT: ["目标数值", "完成状态"],
        };
        const allowedAttrsByType: Record<ItemType, Set<string>> = {
            STRENGTH: new Set([
                "组数",
                "次数",
                "持续时间",
                "强度",
                "休息时间",
            ]),
            CARDIO: new Set([
                "距离",
                "配速",
                "持续时间",
                "冲刺时长",
                "间歇时长",
                "循环次数",
                "强度",
            ]),
            DIET: new Set([
                "食物清单",
                "热量",
                "宏量营养",
                "摄入量",
                "时间点",
            ]),
            HABIT: new Set([
                "目标数值",
                "完成状态",
            ]),
        };

        finalParsedActions.forEach((raw, idx) => {
            const cleanedName = sanitizeActionName(raw.name);
            if (!cleanedName || isLikelyNonActionName(cleanedName)) return;

            let matchedExistingId: string | null =
                raw.matchedExistingId && existingById.has(raw.matchedExistingId)
                    ? raw.matchedExistingId
                    : null;

            if (!matchedExistingId) {
                const m = findBestExistingActionMatch(cleanedName, existingLite);
                matchedExistingId = m?.id ?? null;
            }

            const existing = matchedExistingId
                ? existingById.get(matchedExistingId) ?? null
                : null;

            const finalName = existing?.name ?? cleanedName;
            const finalType: ItemType = normalizeItemType(existing?.type ?? raw.type);
            const key = matchedExistingId
                ? `id:${matchedExistingId}`
                : `new:${normalizeActionNameForMatch(finalName)}`;

            // Keep first occurrence to preserve order; merge later duplicates into it.
            if (!merged.has(key)) {
                const llmAttrs = normalizeAttrsByType(
                    finalType,
                    raw.attrs,
                    allowedAttrsByType,
                );
                const inferredAttrs = finalType === "STRENGTH"
                    ? inferStrengthAttrs({
                        name: finalName,
                        needsAutoCompute: raw.needsAutoCompute,
                        llmAttrs: raw.attrs,
                    })
                    : [];

                merged.set(key, {
                    name: finalName,
                    matchedExistingId,
                    needsAutoCompute: finalType === "STRENGTH"
                        ? (existing?.enableAutoWeightCompute ??
                            raw.needsAutoCompute ??
                            false)
                        : false,
                    includesBodyWeight: finalType === "STRENGTH"
                        ? (existing?.includesBodyWeight ??
                            raw.includesBodyWeight ??
                            false)
                        : false,
                    // Prefer existing action config; otherwise use inferred attrs (LLM attrs are treated as hints).
                    attrs: (existing?.attrs && existing.attrs.length > 0)
                        ? existing.attrs
                        : (inferredAttrs.length > 0
                            ? inferredAttrs
                            : (llmAttrs.length > 0
                                ? llmAttrs
                                : defaultAttrsByType[finalType])),
                    type: finalType,
                    isNew: !matchedExistingId,
                    _idx: idx,
                });
            }
        });

        const actions: ParsedActionInfo[] = Array.from(merged.values())
            .sort((a, b) => a._idx - b._idx)
            .map(({ _idx, ...rest }) => rest);

        await tryTrace(traceEnabled, traceId, async (id) => {
            await writeTraceJson(id, "stage1.postprocessed.json", {
                actions,
            });
        });

        return NextResponse.json<ApiData<ParseActionsResponseDto>>({
            success: true,
            message: "解析动作成功",
            data: {
                actions,
            },
        });
    } catch (error) {
        console.error("Error parsing actions:", error);
        return NextResponse.json({
            success: false,
            message: "解析动作失败，请检查文本格式",
        }, { status: 500 });
    }
}

/**
 * 构建解析动作的 Prompt
 */
function buildParseActionsPrompt(
    userInput: string,
    existingActions: CoachActionRow[],
): string {
    const actionsListStr = existingActions.length > 0
        ? existingActions.map((a) => `- ${a.name} (ID: ${a.id})`).join("\n")
        : "(暂无已有动作)";

    return `你是一个训练计划解析助手。

任务：从以下训练计划中提取所有独立的训练动作名称（只要“动作名”，不要把强度/组次/休息/备注拼进名字里）。

**输出语言（必须遵守）**：无论用户输入是中文还是英文（包括从 Word/Excel 粘贴的英文内容），你输出的所有动作名称（name）及一切文本必须使用中文。若原文为英文动作名（如 Bench Press、Squat、Deadlift），请翻译为常用中文名称（如 卧推、深蹲、硬拉）后输出，以便最终计划统一为中文。

已有动作库：
${actionsListStr}

解析规则：
1. 提取每个不同的动作名称（去重）
2. 识别动作是否需要"自动计算重量"功能（基于是否有 RM、百分比、重量等强度描述）
3. 判断动作是否"包含自重"（如引体向上、臂屈伸、俯卧撑、悬挂等自重动作应为 true）
4. **尽可能复用已有动作库**：如果动作在已有动作库中存在（名称相同/别名/简称/非常相似均可），请优先记录匹配ID，避免新建重复动作
5. 动作类型（type）必须从以下四类中选择：STRENGTH / CARDIO / DIET / HABIT
6. 动作属性（attrs）必须从预设组合中选择，禁止自由发挥：
   - 力量-次数型：["组数","次数","强度","休息时间"]（俯卧撑/负重引体/深蹲/卧推）
   - 力量-时长型：["组数","持续时间","强度","休息时间"]（平板支撑/L-sit/单手悬垂）
   - 力量-恢复型：["组数","次数","休息时间"] 或 ["组数","持续时间","休息时间"]（泡沫轴/拉伸）
   - 有氧-距离型：["距离","配速","持续时间"]（跑步/骑行/游泳）
   - 有氧-间歇型：["冲刺时长","间歇时长","循环次数","强度"]（间歇跑/跳绳）
   - 饮食-复合摄入：["食物清单","热量","宏量营养"]
   - 饮食-单一计量：["摄入量","时间点"]
   - 习惯-统计型：["目标数值","完成状态"]
   - 习惯-行为型：["完成状态"]
   若无法确定类型，优先用力量-次数型。
7. 饮食类动作命名规则：动作名应是“食物名称/做法”（如“全麦面包”“煎龙利鱼”“蔬菜沙拉(油醋汁)”）；“早餐/午餐/晚餐”等餐次信息应放在备注/说明里，不要当动作名。
8. 动作名清洗（非常重要）：动作名必须是“基础动作名称”，严禁包含以下内容：RM/百分比/公斤/磅/RPE/组数×次数/组休/组间歇/力竭/累积/临界点/测试等计划描述；例如：
   - ✅ "负重引体5RM 3×3" → 动作名应是 "负重引体"，强度是 "5RM"
   - ✅ "锤式弯举10RM 三组 RPE9" → 动作名应是 "锤式弯举"
   - ✅ "自重引体力竭然后双手悬垂力竭 两组" → 动作名应分别是 "自重引体" 与 "双手悬垂"
   - ❌ "负重引体5RM" 不能当成动作名
9. 对可能的同义/缩写进行合并：请对动作名进行清洗（去除括号内补充信息、前后空格、全角半角差异、大小写差异、常见缩写），如果判定为同一个动作请只输出一次，并匹配同一个 existingId；例如“锤式弯举”和“锤式”应视为同一动作
10. 严格避免过度合并：凡是动作执行方式/握法/姿势/器械不同（如“引体向上” vs “反手引体” vs “窄握引体”）都视为不同动作；只有当核心动作本质一致且差异仅限于别称/简称时才合并。如果不确定，宁可输出为两个新动作。
11. 非动作内容不要输出为动作：如 “休一天/休两天”“每组拉到降速临界点”“第一组/第二组/循环三组”“测试新极限”“组休 3分”“组间歇 30秒” 等都是计划描述，不是动作。
12. 匹配阈值：如果你**高度确定**是同一动作（同名/别名/简称/几乎等价表达），请填 matchedExistingId；如果不确定再留 null
13. 输出顺序不限（保持自然顺序即可）
14. 备注统一落到后续结构解析阶段：此阶段不要把注意事项/技术要点写进动作名或 attrs。

训练计划文本：
"""
${userInput}
"""

请严格返回以下 JSON 格式（不要添加其他内容）：
{
  "actions": [
    {
      "name": "动作名称",
      "type": "STRENGTH",
      "matchedExistingId": "uuid 或 null",
      "needsAutoCompute": true,
      "includesBodyWeight": false,
      "attrs": ["组数", "次数", "强度", "休息时间"]
    }
  ]
}`;
}

function normalizeItemType(input?: unknown): ItemType {
    const raw = String(input ?? "").toUpperCase();
    if (raw === "CARDIO" || raw === "DIET" || raw === "HABIT") return raw;
    return "STRENGTH";
}

function normalizeAttrsByType(
    type: ItemType,
    attrs: unknown,
    allowed: Record<ItemType, Set<string>>,
): string[] {
    if (!Array.isArray(attrs)) return [];
    const allowedSet = allowed[type] ?? new Set<string>();
    const cleaned = attrs
        .map((x) => String(x ?? "").trim())
        .filter((x) => x && allowedSet.has(x));
    return Array.from(new Set(cleaned));
}
