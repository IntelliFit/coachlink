import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type {
    SubmitQuestionnaireDto,
    SubmitQuestionnaireResponseDto,
} from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

/**
 * 提交问卷回答
 *
 * 功能：
 * 1. 获取问卷当前版本号
 * 2. 将回答保存到 questionnaire_responses 表
 * 3. 可选：更新 user_profiles 中的关键字段
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
        questionnaireId,
        answers,
        context,
        planInstanceId,
    } = await req.json() as SubmitQuestionnaireDto;

    if (!questionnaireId || !answers) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数",
        }, { status: 400 });
    }

    // 1. 获取问卷信息和当前版本号
    // 新问卷体系下 status 是唯一的线上版本标记。
    const { data: questionnaire, error: questionnaireError } = await supabase
        .from("coach_questionnaires")
        .select("id, coach_id, version, status")
        .eq("id", questionnaireId)
        .single();

    if (questionnaireError || !questionnaire) {
        return NextResponse.json({
            success: false,
            message: "问卷不存在或已失效",
        }, { status: 404 });
    }

    // 验证是否为线上版本
    const isActive = questionnaire.status === 'active';
    
    if (!isActive) {
        return NextResponse.json({
            success: false,
            message: "问卷不存在或已失效（非线上版本）",
        }, { status: 404 });
    }

    // 2. 保存回答到 questionnaire_responses
    const { data: response, error: insertError } = await supabase
        .from("questionnaire_responses")
        .insert({
            student_id: userId,
            coach_id: questionnaire.coach_id,
            questionnaire_id: questionnaireId,
            questionnaire_version: questionnaire.version,
            answers,
            context,
            plan_instance_id: planInstanceId || null,
        })
        .select("id")
        .single();

    if (insertError) {
        console.error("Error inserting questionnaire response:", insertError);
        return NextResponse.json({
            success: false,
            message: `提交问卷失败: ${insertError.message}`,
        }, { status: 500 });
    }

    // 3. 可选：更新 user_profiles（根据 answers 中的关键字段）
    // 例如：体重、身高、目标等
    const profileUpdates: Record<string, any> = {};

    if (answers.weight) profileUpdates.weight = answers.weight;
    if (answers.height) profileUpdates.height = answers.height;
    if (answers.goal) profileUpdates.goal = answers.goal;
    if (answers.body_fat) profileUpdates.body_fat = answers.body_fat;

    if (Object.keys(profileUpdates).length > 0) {
        await supabase
            .from("user_profiles")
            .update(profileUpdates)
            .eq("user_id", userId);
    }

    return NextResponse.json<ApiData<SubmitQuestionnaireResponseDto>>({
        success: true,
        message: "问卷提交成功",
        data: {
            responseId: response.id,
            version: questionnaire.version,
        },
    });
}
