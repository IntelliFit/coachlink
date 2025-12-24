import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import {
    CoachPlanTemplatesUpdate,
    UpdateTemplateDto,
    UpdateTemplateResponseDto,
} from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import {
    checkTrainingDays,
    makeContainedOptions,
    makeWeekDays,
} from "@/utils/template";

export async function POST(req: Request) {
    const {
        id,
        name,
        description,
        tags,
        suitableFor,
        weekDays, // 新增
        trainingDays,
    } = await req.json() as UpdateTemplateDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized",
        }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from("users")
        .select("is_coach")
        .eq("id", userId)
        .single();

    if (userError || !user.is_coach) {
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

    if (tags && tags.length > 0) {
        updateData.tags = tags;
    }

    if (suitableFor !== undefined) {
        updateData.suitable_for = suitableFor;
    }

    // 将计划日数据存储在training_days字段中
    if (trainingDays) {
        const validInfo = checkTrainingDays(trainingDays);
        if (!validInfo.valid) {
            return NextResponse.json({
                success: false,
                message: validInfo.message,
            }, { status: 400 });
        }

        updateData.training_days = trainingDays;
        updateData.training_days_count = trainingDays.filter((day) =>
            day.type === "training"
        ).length;
        updateData.rest_days_count = trainingDays.filter((day) =>
            day.type === "rest"
        ).length;

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

    return NextResponse.json<ApiData<UpdateTemplateResponseDto>>({
        success: true,
        message: "更新训练计划模板成功",
        data: {
            template,
        },
    });
}
