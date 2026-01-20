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
import { CoachActionRow } from "@/types";
import {
    findBestExistingActionMatch,
    inferStrengthAttrs,
    isLikelyNonActionName,
    normalizeTextForActionExtraction,
    normalizeActionNameForMatch,
    normalizeStrengthAttrs,
    sanitizeActionName,
} from "@/lib/planImportText";

/**
 * 阶段1：解析动作
 * 从用户粘贴的训练计划文本中提取动作列表，并与现有动作库进行匹配
 */
export async function POST(req: Request) {
    const { text } = await req.json() as ParseActionsDto;

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

        // 仅用于动作提取阶段：对文本做轻量规则化，减少 “动作名+强度” 被黏在一起的情况
        const normalizedText = normalizeTextForActionExtraction(text);

        // 构建 Prompt
        const prompt = buildParseActionsPrompt(
            normalizedText,
            existingActions || [],
        );

        // 调用 DeepSeek API
        const response = await callDeepSeek(prompt);
        const parsedResult = parseJsonResponse<
            { actions: GeminiParsedAction[] }
        >(response);

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
        const defaultAttrs = ["组数", "次数", "强度", "休息时间"];

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
            const key = matchedExistingId
                ? `id:${matchedExistingId}`
                : `new:${normalizeActionNameForMatch(finalName)}`;

            // Keep first occurrence to preserve order; merge later duplicates into it.
            if (!merged.has(key)) {
                // Strength-only smart import: infer attrs instead of always using sets×reps.
                const inferredAttrs = inferStrengthAttrs({
                    name: finalName,
                    needsAutoCompute: raw.needsAutoCompute,
                    llmAttrs: raw.attrs,
                });
                const llmAttrs = normalizeStrengthAttrs(raw.attrs);

                merged.set(key, {
                    name: finalName,
                    matchedExistingId,
                    needsAutoCompute: existing?.enableAutoWeightCompute ??
                        raw.needsAutoCompute ??
                        false,
                    includesBodyWeight: existing?.includesBodyWeight ??
                        raw.includesBodyWeight ??
                        false,
                    // Prefer existing action config; otherwise use inferred attrs (LLM attrs are treated as hints).
                    attrs: (existing?.attrs && existing.attrs.length > 0)
                        ? existing.attrs
                        : (inferredAttrs.length > 0
                            ? inferredAttrs
                            : (llmAttrs.length > 0 ? llmAttrs : defaultAttrs)),
                    isNew: !matchedExistingId,
                    _idx: idx,
                });
            }
        });

        const actions: ParsedActionInfo[] = Array.from(merged.values())
            .sort((a, b) => a._idx - b._idx)
            .map(({ _idx, ...rest }) => rest);

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

已有动作库：
${actionsListStr}

解析规则：
1. 提取每个不同的动作名称（去重）
2. 识别动作是否需要"自动计算重量"功能（基于是否有 RM、百分比、重量等强度描述）
3. 判断动作是否"包含自重"（如引体向上、臂屈伸、俯卧撑、悬挂等自重动作应为 true）
4. **尽可能复用已有动作库**：如果动作在已有动作库中存在（名称相同/别名/简称/非常相似均可），请优先记录匹配ID，避免新建重复动作
5. 确定动作的属性：通常包含 "组数", "次数", "强度", "休息时间"
6. 动作名清洗（非常重要）：动作名必须是“基础动作名称”，严禁包含以下内容：RM/百分比/公斤/磅/RPE/组数×次数/组休/组间歇/力竭/累积/临界点/测试等计划描述；例如：
   - ✅ "负重引体5RM 3×3" → 动作名应是 "负重引体"，强度是 "5RM"
   - ✅ "锤式弯举10RM 三组 RPE9" → 动作名应是 "锤式弯举"
   - ✅ "自重引体力竭然后双手悬垂力竭 两组" → 动作名应分别是 "自重引体" 与 "双手悬垂"
   - ❌ "负重引体5RM" 不能当成动作名
7. 对可能的同义/缩写进行合并：请对动作名进行清洗（去除括号内补充信息、前后空格、全角半角差异、大小写差异、常见缩写），如果判定为同一个动作请只输出一次，并匹配同一个 existingId；例如“锤式弯举”和“锤式”应视为同一动作
8. 严格避免过度合并：凡是动作执行方式/握法/姿势/器械不同（如“引体向上” vs “反手引体” vs “窄握引体”）都视为不同动作；只有当核心动作本质一致且差异仅限于别称/简称时才合并。如果不确定，宁可输出为两个新动作。
9. 非动作内容不要输出为动作：如 “休一天/休两天”“每组拉到降速临界点”“第一组/第二组/循环三组”“测试新极限”“组休 3分”“组间歇 30秒” 等都是计划描述，不是动作。
10. 匹配阈值：如果你**高度确定**是同一动作（同名/别名/简称/几乎等价表达），请填 matchedExistingId；如果不确定再留 null
11. 输出顺序不限（保持自然顺序即可）

训练计划文本：
"""
${userInput}
"""

请严格返回以下 JSON 格式（不要添加其他内容）：
{
  "actions": [
    {
      "name": "动作名称",
      "matchedExistingId": "uuid 或 null",
      "needsAutoCompute": true,
      "includesBodyWeight": false,
      "attrs": ["组数", "次数", "强度", "休息时间"]
    }
  ]
}`;
}
