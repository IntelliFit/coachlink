import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
    CoachPlanTemplatesUpdate,
    UpdateTemplateDto,
    UpdateTemplateResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";
import {
    checkTrainingDays,
    makeContainedOptions,
    makeWeekDays,
    validateTrainingDaysPresence,
} from "@/utils/template";

export async function POST(req: Request) {
    const {
        id,
        name,
        description,
        executionNotice,
        tags,
        suitableFor,
        weekDays,
        globalAnswers, // 新增
        trainingDays,
        syncInstances,
    } = await req.json() as UpdateTemplateDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    const userId = authResult.userId || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const isCoach = authResult.user?.is_coach === true || Boolean((await supabase.from("users").select("is_coach").eq("id", userId).single()).data?.is_coach);
    if (!isCoach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    // 更新模板基本信息
    const updateData: any = {};

    if (name !== undefined) {
        updateData.name = name;
    }
    if (description !== undefined) {
        updateData.description = description;
    }
    if (executionNotice !== undefined) {
        updateData.execution_notice = executionNotice?.trim() || null;
    }

    if (tags && tags.length > 0) {
        updateData.tags = tags;
    }

    if (suitableFor !== undefined) {
        updateData.suitable_for = suitableFor;
    }

    // 保存全局问题答案
    if (globalAnswers !== undefined) {
        updateData.global_answers = globalAnswers;
    }

    // 将计划日数据存储在training_days字段中
    if (trainingDays) {
        const presenceInfo = validateTrainingDaysPresence(trainingDays);
        if (!presenceInfo.valid) {
            return NextResponse.json({
                success: false,
                message: presenceInfo.message,
            }, { status: 400 });
        }

        const validInfo = checkTrainingDays(trainingDays);
        if (!validInfo.valid) {
            return NextResponse.json({
                success: false,
                message: validInfo.message,
            }, { status: 400 });
        }

        updateData.training_days = trainingDays;

        // 如果前端提供了 weekDays，使用前端的值；否则自动计算
        if (weekDays !== undefined) {
            updateData.week_days = weekDays;
        } else {
            updateData.week_days = makeWeekDays(trainingDays);
        }

        updateData.contained_options = makeContainedOptions(trainingDays);
    } else if (weekDays !== undefined) {
        // 如果只更新 weekDays 而没有更新 trainingDays
        updateData.week_days = weekDays;
    }

    let template;
    if (Object.keys(updateData).length > 0) {
        const { data, error: updateError } = await supabase
            .from("coach_plan_templates")
            .update(updateData)
            .eq("id", id)
            .eq("coach_id", userId)
            .select()
            .single();

        if (updateError) {
            console.error("Error updating template:", updateError);
            return NextResponse.json({
                success: false,
                message: "Failed to update template",
            }, { status: 500 });
        }

        template = data;
    } else {
        // 如果没有更新字段，直接获取现有模板
        const { data, error: fetchError } = await supabase
            .from("coach_plan_templates")
            .select("*")
            .eq("id", id)
            .eq("coach_id", userId)
            .single();

        if (fetchError) {
            console.error("Error fetching template:", fetchError);
            return NextResponse.json({
                success: false,
                message: "Template not found",
            }, { status: 404 });
        }

        template = data;
    }

    if (syncInstances) {
        const instanceTrainingDays = trainingDays || template?.training_days;
        const syncUpdateData: any = {};

        if (Array.isArray(instanceTrainingDays)) {
            syncUpdateData.training_days = instanceTrainingDays;
        }
        if (template && "execution_notice" in template) {
            syncUpdateData.execution_notice = (template as any).execution_notice || null;
        }

        if (Object.keys(syncUpdateData).length > 0) {
            const { error: syncError } = await supabase
                .from("coach_plan_instances")
                .update(syncUpdateData)
                .eq("coach_plan_template_id", id)
                .eq("coach_id", template?.coach_id);

            if (syncError) {
                console.error("Error syncing instances:", syncError);
                return NextResponse.json({
                    success: false,
                    message: "Failed to sync instances",
                }, { status: 500 });
            }
        }
    }

    return NextResponse.json<ApiData<UpdateTemplateResponseDto>>({
        success: true,
        message: "更新训练计划模板成功",
        data: {
            template,
        },
    });
}
