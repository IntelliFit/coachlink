import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { callDeepSeek, parseJsonResponse } from "@/lib/deepseek";
import type { ApiData } from "@/types/api";
import type { FormPlanTrainingDay } from "@/app/api/plan-lib/create-template/entity";
import type {
    GenerateAiDraftFromProfileDto,
    GenerateAiDraftFromProfileResponseDto,
} from "./entity";

type StudentActionLite = {
    id: string;
    name: string;
    type: string | null;
};

type LlmActionSet = {
    actionId: string;
    itemType?: "STRENGTH" | "CARDIO" | "DIET" | "HABIT";
    params?: Record<string, unknown>;
    // backward compatibility
    sets?: number;
    reps?: number;
    restSeconds?: number;
    weightKg?: number | null;
    note?: string | null;
};

type LlmTrainingDay = {
    dayIndex: number;
    type: "training" | "rest";
    note?: string;
    actionSets?: LlmActionSet[];
};

type LlmPlanResult = {
    planName: string;
    planDescription: string;
    trainingDays: LlmTrainingDay[];
};

function buildPrompt(params: {
    profileGoal: string | null;
    fitnessGoals: string[];
    fitnessLevel: string | null;
    interests: string[];
    equipments: string[];
    weeklyFrequency: number | null;
    sessionDuration: number;
    days: number;
    actions: StudentActionLite[];
}) {
    const {
        profileGoal,
        fitnessGoals,
        fitnessLevel,
        interests,
        equipments,
        weeklyFrequency,
        sessionDuration,
        days,
        actions,
    } = params;
    const actionList = actions
        .map((a) => `- id=${a.id}; name=${a.name}; type=${a.type || "STRENGTH"}`)
        .join("\n");

    return `你是训练计划编排助手。请根据用户资料与可用动作库，生成一个可直接编辑保存的 ${days} 天入门计划。

用户信息：
- 主目标: ${profileGoal || "综合体能"}
- 全部目标: ${fitnessGoals.join("、") || profileGoal || "综合体能"}
- 水平: ${fitnessLevel || "beginner"}
- 兴趣: ${interests.join("、") || "未指定"}
- 每周可训练频率: ${weeklyFrequency ? `${weeklyFrequency >= 6 ? "6 天及以上" : `${weeklyFrequency} 天`}` : "未指定"}
- 器械: ${equipments.join("、") || "未指定"}
- 单次时长(分钟): ${sessionDuration}

可用动作（只能使用这些 actionId）：
${actionList}

输出 JSON（不要解释）：
{
  "planName": "字符串",
  "planDescription": "字符串",
  "trainingDays": [
    {
      "dayIndex": 1,
      "type": "training",
      "note": "当天目标",
      "actionSets": [
        {
          "actionId": "动作id",
          "itemType": "STRENGTH",
          "params": { "组数": 3, "次数": 10, "休息时间": 90, "load": null },
          "note": "可选"
        }
      ]
    }
  ]
硬性约束：
1) dayIndex 从 1 开始连续到 ${days}。
2) 每天必须有记录；休息日 type=rest 且 actionSets 为空。
3) training 日 actionSets 2~6 个，动作顺序要合理（主项在前）。
4) 仅返回可用动作列表里的 actionId。
5) 参数必须按动作类型与动作属性灵活给出，不要强制所有动作都给组次/休息/重量：
   - STRENGTH: 组数, 次数/持续时间, 休息时间, load(可选), 强度(可选)
   - CARDIO: 距离, 持续时间, 配速
   - DIET: 食物清单, 热量
   - HABIT: 目标数值, 完成状态, 目标时长
6) 新手参数要保守，无法可靠给重量时 load 用 null。`;
}

function normalizeStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.map((item) => String(item || "").trim()).filter(Boolean) : [];
}

function normalizeTrainingDays(
    llmDays: LlmTrainingDay[] | undefined,
    dayCount: number,
    actionById: Map<string, StudentActionLite>,
): FormPlanTrainingDay[] {
    const dayMap = new Map<number, LlmTrainingDay>();
    for (const d of llmDays || []) {
        if (typeof d.dayIndex === "number" && d.dayIndex >= 1 && d.dayIndex <= dayCount) {
            dayMap.set(d.dayIndex, d);
        }
    }

    const out: FormPlanTrainingDay[] = [];
    for (let i = 1; i <= dayCount; i++) {
        const src = dayMap.get(i);
        if (!src || src.type === "rest") {
            out.push({
                dayIndex: i,
                type: "rest",
                note: src?.note || "休息与恢复",
                actionSets: [],
                actionSetsCount: 0,
            });
            continue;
        }

        const actionSets = (src.actionSets || [])
            .filter((s) => !!s.actionId && actionById.has(s.actionId))
            .slice(0, 8)
            .map((s, idx) => {
                const action = actionById.get(s.actionId)!;
                const inferredType = String(s.itemType || action.type || "STRENGTH").toUpperCase();
                const safeType = (inferredType === "CARDIO" || inferredType === "DIET" || inferredType === "HABIT")
                    ? inferredType
                    : "STRENGTH";
                const params = (s.params && typeof s.params === "object")
                    ? { ...s.params }
                    : {};

                if (Object.keys(params).length === 0) {
                    if (safeType === "STRENGTH") {
                        params["组数"] = Math.max(1, Math.min(8, Number(s.sets || 3)));
                        params["次数"] = Math.max(1, Math.min(30, Number(s.reps || 10)));
                        params["休息时间"] = Math.max(20, Math.min(300, Number(s.restSeconds || 90)));
                        params["load"] = typeof s.weightKg === "number" && Number.isFinite(s.weightKg) ? s.weightKg : null;
                    } else if (safeType === "CARDIO") {
                        params["持续时间"] = 900;
                    } else if (safeType === "DIET") {
                        params["食物清单"] = "按计划执行";
                    } else {
                        params["目标数值"] = 1;
                    }
                }

                return {
                    type: "no-filter" as const,
                    actionId: action.id,
                    setName: action.name || `动作${idx + 1}`,
                    params: { ...params, note: s.note || undefined },
                    itemType: safeType,
                };
            });

        out.push({
            dayIndex: i,
            type: actionSets.length > 0 ? "training" : "rest",
            note: src.note || "",
            actionSets,
            actionSetsCount: actionSets.length,
        });
    }
    return out;
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
        const { days = 7 } = (await req.json().catch(() => ({}))) as GenerateAiDraftFromProfileDto;
        const dayCount = Math.max(3, Math.min(14, Number(days || 7)));

        const [profileRes, onboardingRes, actionsRes] = await Promise.all([
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
                .select("id,name,type")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false })
                .limit(120),
        ]);

        const actionPool = (actionsRes.data || []) as StudentActionLite[];
        if (actionPool.length === 0) {
            return NextResponse.json<ApiData<null>>(
                { success: false, message: "动作库为空，请先初始化动作库", data: null },
                { status: 400 },
            );
        }

        const answers = (onboardingRes.data?.answers || {}) as Record<string, unknown>;
        const fitnessGoals = normalizeStringArray(answers.fitness_goals);
        const interests = normalizeStringArray(answers.interest_tags);
        const equipments = normalizeStringArray(answers.equipment);
        const weeklyFrequency = typeof answers.weekly_frequency === "number" ? Number(answers.weekly_frequency) : null;
        const sessionDuration = typeof answers.session_duration === "number" ? Number(answers.session_duration) : 30;
        const profileGoal = profileRes.data?.fitness_goal ?? null;

        const prompt = buildPrompt({
            profileGoal,
            fitnessGoals: fitnessGoals.length > 0 ? fitnessGoals : (profileGoal ? [profileGoal] : []),
            fitnessLevel: profileRes.data?.fitness_level ?? null,
            interests,
            equipments,
            weeklyFrequency,
            sessionDuration,
            days: dayCount,
            actions: actionPool,
        });

        let parsed: LlmPlanResult | null = null;
        try {
            const raw = await callDeepSeek(prompt, { maxTokens: 3200 });
            parsed = parseJsonResponse<LlmPlanResult>(raw, "student-plan-generate-ai-draft");
        } catch (llmError) {
            console.warn("[student/plan-lib/generate-ai-draft-from-profile] llm failed:", llmError);
        }

        const actionById = new Map(actionPool.map((a) => [a.id, a]));
        const trainingDays = normalizeTrainingDays(parsed?.trainingDays, dayCount, actionById);

        const fallbackName = "AI 生成入门计划";
        const fallbackDesc = "已根据你的基础档案自动生成，可在编辑器微调后保存应用。";

        return NextResponse.json<ApiData<GenerateAiDraftFromProfileResponseDto>>({
            success: true,
            message: "AI 计划草稿生成成功",
            data: {
                name: parsed?.planName?.trim() || fallbackName,
                description: parsed?.planDescription?.trim() || fallbackDesc,
                trainingDays,
            },
        });
    } catch (error) {
        console.error("[student/plan-lib/generate-ai-draft-from-profile] unexpected:", error);
        return NextResponse.json<ApiData<null>>(
            { success: false, message: "服务器错误", data: null },
            { status: 500 },
        );
    }
}


