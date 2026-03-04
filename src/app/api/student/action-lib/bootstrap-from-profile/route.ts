import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import type { ApiData } from "@/types/api";
import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import type {
    BootstrapStudentActionsFromProfileDto,
    BootstrapWorkoutDraftItemDto,
    BootstrapStudentActionsFromProfileResponseDto,
} from "./entity";

type CommunityAction = {
    id: string;
    name: string;
    detail: string | null;
    positions: string[] | null;
    attrs: string[] | null;
    url: string | null;
    type: string | null;
    item_schema: Record<string, unknown> | null;
    suggested_time: string | null;
    enableAutoWeightCompute?: boolean | null;
    includesBodyWeight?: boolean | null;
    canonical_action_id?: string | null;
    like_count?: number | null;
    rank_score?: number | null;
};

type LlmSelectionItem = {
    actionId: string;
    params?: Record<string, unknown>;
    itemType?: "STRENGTH" | "CARDIO" | "DIET" | "HABIT";
    // backward compatible fields
    sets?: number;
    reps?: number;
    restSeconds?: number;
    weightKg?: number | null;
    note?: string | null;
};

type LlmSelectionResult = {
    selectedActions: LlmSelectionItem[];
};

function buildSelectionPrompt(params: {
    profileGoal: string | null;
    fitnessLevel?: string | null;
    interests: string[];
    equipments: string[];
    sessionDuration?: number | null;
    candidateActions: CommunityAction[];
}): string {
    const {
        profileGoal,
        fitnessLevel,
        interests,
        equipments,
        sessionDuration,
        candidateActions,
    } = params;

    const actionsList = candidateActions.map((a) => {
        return `- id=${a.id}; name=${a.name}; type=${a.type || "STRENGTH"}; detail=${a.detail || ""}; positions=${JSON.stringify(a.positions || [])}; attrs=${JSON.stringify(a.attrs || [])}`;
    }).join("\n");

    return `你是健身计划助手。请基于用户档案，从候选动作中挑选 3-5 个“即兴训练动作”，并给出每个动作的执行参数。

用户信息：
- 目标: ${profileGoal || "综合体能"}
- 训练水平: ${fitnessLevel || "beginner"}
- 兴趣: ${interests.join("、") || "未指定"}
- 器械: ${equipments.join("、") || "未指定"}
- 单次训练时长(分钟): ${sessionDuration || 30}

候选动作（只能从这些动作里选，必须返回 actionId）：
${actionsList}

输出要求（严格 JSON）：
{
  "selectedActions": [
    {
      "actionId": "候选动作id",
      "itemType": "STRENGTH",
      "params": {
        "组数": 3,
        "次数": 10,
        "休息时间": 90,
        "load": null
      },
      "note": "可选，简短建议"
    }
  ]
}

约束：
1) selectedActions 长度 3~5。
2) 不允许返回候选列表之外的 actionId。
3) 参数必须按动作类型与动作属性灵活给出，不要强行所有动作都给“组数/次数/休息时间/重量”：
   - STRENGTH 常见: 组数, 次数 或 持续时间, 休息时间, load(可选), 强度(可选)
   - CARDIO 常见: 距离, 持续时间, 配速
   - DIET 常见: 食物清单, 热量
   - HABIT 常见: 目标数值, 完成状态, 目标时长
4) 新手参数保守；若无法可靠给重量，load 置 null 或不返回。
5) 至少包含 1 个主力力量动作（type=STRENGTH）或 1 个有氧动作（type=CARDIO），按目标合理搭配。`;
}

function normalizeDraftItem(
    selected: LlmSelectionItem,
    actionById: Map<string, CommunityAction>,
): BootstrapWorkoutDraftItemDto | null {
    const a = actionById.get(selected.actionId);
    if (!a) return null;
    const itemType = (String(a.type || "STRENGTH").toUpperCase() as BootstrapWorkoutDraftItemDto["itemType"]);
    const safeType: BootstrapWorkoutDraftItemDto["itemType"] =
        itemType === "CARDIO" || itemType === "DIET" || itemType === "HABIT" ? itemType : "STRENGTH";

    const rawParams = selected.params && typeof selected.params === "object"
        ? { ...selected.params }
        : {};

    // backward compatibility: 旧格式字段转 params
    if (Object.keys(rawParams).length === 0) {
        if (safeType === "STRENGTH") {
            rawParams["组数"] = Math.max(1, Math.min(8, Number(selected.sets || 3)));
            rawParams["次数"] = Math.max(1, Math.min(30, Number(selected.reps || 10)));
            rawParams["休息时间"] = Math.max(20, Math.min(300, Number(selected.restSeconds || 90)));
            rawParams["load"] = typeof selected.weightKg === "number" ? selected.weightKg : null;
        } else if (safeType === "CARDIO") {
            rawParams["持续时间"] = 900;
        } else if (safeType === "DIET") {
            rawParams["食物清单"] = "按计划执行";
        } else {
            rawParams["目标数值"] = 1;
        }
    }

    return {
        actionId: a.id,
        actionName: a.name,
        itemType: safeType,
        params: rawParams,
        note: selected.note || null,
    };
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "用户未登录", data: null },
                { status: 401 },
            );
        }

        const userId = session.user.id;
        const {
            minActions = 8,
            importLimit = 10,
        } = (await req.json().catch(() => ({}))) as BootstrapStudentActionsFromProfileDto;

        const { count: existingCountRaw, error: countError } = await supabase
            .from("student_actions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);

        if (countError) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "读取动作库失败", data: null },
                { status: 500 },
            );
        }

        const existingCount = Number(existingCountRaw || 0);

        // 已有足够动作，直接返回，不重复导入
        if (existingCount >= minActions) {
            const { data: existingActions } = await supabase
                .from("student_actions")
                .select("id,name,type")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(5);

            const workoutDraft: BootstrapWorkoutDraftItemDto[] = (existingActions || []).slice(0, 4).map((a: any) => ({
                actionId: a.id,
                actionName: a.name,
                itemType: (String(a.type || "STRENGTH").toUpperCase() as BootstrapWorkoutDraftItemDto["itemType"]) || "STRENGTH",
                params: {
                    "组数": 3,
                    "次数": 10,
                    "休息时间": 90,
                    load: null,
                },
                note: "已根据你的基础档案自动预填，可继续调整",
            }));

            return NextResponse.json<ApiData<BootstrapStudentActionsFromProfileResponseDto>>({
                success: true,
                message: "动作库已就绪",
                data: {
                    existingCount,
                    importedCount: 0,
                    totalCount: existingCount,
                    recommendedActionIds: (existingActions || []).map((a) => a.id),
                    workoutDraft,
                    skipped: true,
                },
            });
        }

        const [profileRes, onboardingRes, existingNamesRes] = await Promise.all([
            supabase
                .from("user_profiles")
                .select("fitness_goal,fitness_level")
                .eq("user_id", userId)
                .maybeSingle(),
            supabase
                .from("onboarding_questionnaires")
                .select("answers")
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle(),
            supabase
                .from("student_actions")
                .select("name")
                .eq("user_id", userId),
        ]);

        const profileGoal = profileRes.data?.fitness_goal ?? null;
        const fitnessLevel = profileRes.data?.fitness_level ?? null;
        const answers = (onboardingRes.data?.answers || {}) as Record<string, unknown>;
        const interests = Array.isArray(answers.interest_tags)
            ? (answers.interest_tags as string[])
            : [];
        const equipments = Array.isArray(answers.equipment)
            ? (answers.equipment as string[])
            : [];
        const sessionDuration = typeof answers.session_duration === "number"
            ? Number(answers.session_duration)
            : 30;

        const existingNameSet = new Set((existingNamesRes.data || []).map((x) => x.name));

        let candidateRows: CommunityAction[] = [];
        const { data: rankedRows, error: rankedError } = await supabase
            .from("community_actions_ranked")
            .select("id,name,detail,positions,attrs,url,type,item_schema,suggested_time,enableAutoWeightCompute,includesBodyWeight,canonical_action_id,like_count,rank_score")
            .limit(200);

        if (!rankedError && rankedRows) {
            candidateRows = rankedRows as CommunityAction[];
        } else {
            const { data: fallbackRows, error: fallbackError } = await supabase
                .from("community_actions")
                .select("id,name,detail,positions,attrs,url,type,item_schema,suggested_time,enableAutoWeightCompute,includesBodyWeight,canonical_action_id,like_count")
                .order("like_count", { ascending: false })
                .limit(200);
            if (fallbackError || !fallbackRows) {
                return NextResponse.json<ApiData<null>>(
                    { success: false, message: "读取公共动作库失败", data: null },
                    { status: 500 },
                );
            }
            candidateRows = fallbackRows as CommunityAction[];
        }

        const actionById = new Map(candidateRows.map((a) => [a.id, a]));
        const availableForImport = candidateRows.filter((a) => !!a.id && !!a.name && !existingNameSet.has(a.name));
        const llmCandidates = availableForImport.slice(0, 120);

        let llmSelections: LlmSelectionItem[] = [];
        if (llmCandidates.length > 0) {
            try {
                const prompt = buildSelectionPrompt({
                    profileGoal,
                    fitnessLevel,
                    interests,
                    equipments,
                    sessionDuration,
                    candidateActions: llmCandidates,
                });
                const raw = await callDeepSeek(prompt, { maxTokens: 1400 });
                const parsed = parseJsonResponse<LlmSelectionResult>(
                    raw,
                    "student-bootstrap-from-profile",
                );
                llmSelections = Array.isArray(parsed.selectedActions)
                    ? parsed.selectedActions
                    : [];
            } catch (llmError) {
                console.warn("[student/action-lib/bootstrap-from-profile] llm selection failed:", llmError);
            }
        }

        // LLM 失败兜底：取候选前 4 个
        if (llmSelections.length === 0) {
            llmSelections = llmCandidates.slice(0, 4).map((a) => ({
                actionId: a.id,
                itemType: "STRENGTH",
                params: {
                    "组数": 3,
                    "次数": 10,
                    "休息时间": 90,
                    load: null,
                },
            }));
        }

        const selectedActionIds = Array.from(
            new Set(
                llmSelections
                    .map((x) => x.actionId)
                    .filter((id) => actionById.has(id)),
            ),
        ).slice(0, Math.max(1, Math.min(importLimit, 12)));

        let importedCount = 0;
        const importedIds: string[] = [];

        for (const actionId of selectedActionIds) {
            const action = actionById.get(actionId);
            if (!action) continue;
            const insertData = {
                user_id: userId,
                name: action.name,
                detail: action.detail,
                positions: action.positions,
                attrs: action.attrs,
                url: action.url,
                type: action.type,
                item_schema: action.item_schema,
                suggested_time: action.suggested_time,
                enableAutoWeightCompute: action.enableAutoWeightCompute ?? false,
                includesBodyWeight: action.includesBodyWeight ?? false,
                canonical_action_id: action.canonical_action_id ?? null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };

            const { data: inserted, error: insertError } = await supabase
                .from("student_actions")
                .insert(insertData)
                .select("id")
                .maybeSingle();

            if (!insertError && inserted?.id) {
                importedCount += 1;
                importedIds.push(inserted.id);
            }
        }

        const { count: totalCountRaw } = await supabase
            .from("student_actions")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId);

        const totalCount = Number(totalCountRaw || existingCount + importedCount);
        const recommendedActionIds = importedIds.slice(0, 5);
        const workoutDraft = llmSelections
            .map((s) => normalizeDraftItem(s, actionById))
            .filter((x): x is BootstrapWorkoutDraftItemDto => !!x)
            .slice(0, 5);

        return NextResponse.json<ApiData<BootstrapStudentActionsFromProfileResponseDto>>({
            success: true,
            message: importedCount > 0 ? "已为你准备基础动作库" : "暂未导入新动作",
            data: {
                existingCount,
                importedCount,
                totalCount,
                recommendedActionIds,
                workoutDraft,
                skipped: false,
            },
        });
    } catch (error) {
        console.error("[student/action-lib/bootstrap-from-profile] unexpected:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}


