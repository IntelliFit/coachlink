import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    GenerateNextPhaseDto,
    GenerateNextPhaseResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 基于完成的计划生成下一阶段训练计划
 *
 * 功能：
 * 1. 获取已完成计划的执行数据
 * 2. 获取用户最新档案/问卷数据
 * 3. 调用 AI 生成新计划
 * 4. 创建新的 plan_instance (status = draft)
 */
export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    const {
        completedPlanId,
        useUpdatedProfile = true,
        customInstructions,
    } = await req.json() as GenerateNextPhaseDto;

    if (!completedPlanId) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数",
        }, { status: 400 });
    }

    // 1. 获取已完成计划的信息
    const { data: completedPlan, error: planError } = await supabase
        .from("coach_plan_instances")
        .select("id, name, training_days, coach_id, student_id, source")
        .eq("id", completedPlanId)
        .single();

    if (planError || !completedPlan) {
        return NextResponse.json({
            success: false,
            message: "计划不存在",
        }, { status: 404 });
    }

    // 权限检查：只能生成自己的计划
    if (completedPlan.student_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "权限不足",
        }, { status: 403 });
    }

    // 2. 获取执行数据（用于分析进步）
    const { data: executions } = await supabase
        .from("plan_instance_executions")
        .select("day_index, completed_at, is_completed")
        .eq("plan_instance_id", completedPlanId)
        .order("day_index", { ascending: true });

    const completionRate = executions
        ? Math.round(
            (executions.filter((e) => e.is_completed).length /
                executions.length) * 100,
        )
        : 0;

    // 3. 获取用户档案数据
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

    // 4. 获取最新问卷回答（如果有）
    let latestQuestionnaireAnswers = null;
    if (completedPlan.coach_id) {
        const { data: latestResponse } = await supabase
            .from("questionnaire_responses")
            .select("answers, created_at")
            .eq("student_id", userId)
            .eq("coach_id", completedPlan.coach_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        latestQuestionnaireAnswers = latestResponse?.answers;
    }

    // 5. 构建 AI Prompt 上下文
    const aiContext = {
        previousPlan: {
            name: completedPlan.name,
            totalDays: completedPlan.training_days?.length || 0,
            completionRate,
        },
        userProfile: useUpdatedProfile ? profile : null,
        questionnaireAnswers: latestQuestionnaireAnswers,
        customInstructions,
    };

    // 6. 调用 AI 生成计划（这里简化为创建一个基本计划）
    // TODO: 集成真实的 AI 生成逻辑
    const generatedPlan = {
        name: `${completedPlan.name} - 第二阶段`,
        description: `基于您的进步和最新状态生成的下一阶段训练计划`,
        training_days: generateBasicTrainingDays(aiContext),
    };

    // 7. 创建新的 plan instance (status = draft)
    const { data: newPlan, error: createError } = await supabase
        .from("coach_plan_instances")
        .insert({
            name: generatedPlan.name,
            description: generatedPlan.description,
            training_days: generatedPlan.training_days,
            student_id: userId,
            coach_id: completedPlan.coach_id,
            source: completedPlan.source || "student",
            status: "draft", // 生成后为草稿状态
        })
        .select("id, name, training_days")
        .single();

    if (createError) {
        console.error("Error creating plan:", createError);
        return NextResponse.json({
            success: false,
            message: `生成计划失败: ${createError.message}`,
        }, { status: 500 });
    }

    // 8. 返回预览信息
    const trainingDays = (newPlan.training_days as any[]) || [];
    const totalDays = trainingDays.length;
    const actualTrainingDays =
        trainingDays.filter((d) => d.type === "training").length;
    const restDays = totalDays - actualTrainingDays;

    return NextResponse.json<ApiData<GenerateNextPhaseResponseDto>>({
        success: true,
        message: "下一阶段计划生成成功",
        data: {
            planInstanceId: newPlan.id,
            planName: newPlan.name,
            preview: {
                totalDays,
                trainingDays: actualTrainingDays,
                restDays,
                focusAreas: extractFocusAreas(trainingDays),
            },
        },
    });
}

/**
 * 生成基本的训练天数数据（简化版）
 * TODO: 替换为真实的 AI 生成逻辑
 */
function generateBasicTrainingDays(context: any): any[] {
    // 这里返回一个简化的7天计划
    return Array.from({ length: 7 }, (_, i) => ({
        type: i % 7 === 6 ? "rest" : "training",
        date: null,
        note: i % 7 === 6 ? "休息日" : `训练日 ${i + 1}`,
        actionSets: i % 7 === 6 ? [] : [
            {
                name: "示例动作组",
                actions: [],
            },
        ],
    }));
}

/**
 * 从训练天数中提取关注领域
 */
function extractFocusAreas(trainingDays: any[]): string[] {
    // 简化实现：返回固定的关注领域
    return ["力量提升", "肌肉增长", "动作技巧"];
}
