import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { AddTemplateDto, AddTemplateResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { Json } from "@/types/database.types";
import {
    checkTrainingDays,
    makeContainedOptions,
    makeWeekDays,
    validateTrainingDaysPresence,
} from "@/utils/template";

export async function POST(req: Request) {
    const {
        name,
        description,
        tags = [],
        suitableFor = '',
        trainingDays = []
    } = await req.json() as AddTemplateDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
        .from('users')
        .select('is_coach')
        .eq('id', userId)
        .single();

    if (userError || !user.is_coach) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    const presenceInfo = validateTrainingDaysPresence(trainingDays);
    if (!presenceInfo.valid) {
        return NextResponse.json({
            success: false,
            message: presenceInfo.message
        }, { status: 400 });
    }

    const validInfo = checkTrainingDays(trainingDays);
    if (!validInfo.valid) {
        return NextResponse.json({
            success: false,
            message: validInfo.message
        }, { status: 400 });
    }


    // 创建模板，将所有计划日数据存储在training_days字段中（作为JSON数据）
    const { data: template, error: templateError } = await supabase
        .from("coach_plan_templates")
        .insert({
            coach_id: userId,
            name,
            description: description || null,
            tags: tags || [],
            week_days: makeWeekDays(trainingDays),
            contained_options: makeContainedOptions(trainingDays),
            suitable_for: suitableFor || null,
            training_days: trainingDays,
            type: 'custom'
        })
        .select()
        .single();

    if (templateError) {
        console.error("Error creating template:", templateError);
        return NextResponse.json({
            success: false,
            message: "Failed to create template"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<AddTemplateResponseDto>>({
        success: true,
        message: "创建训练计划模板成功",
        data: {
            template
        }
    });
}
