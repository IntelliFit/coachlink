import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { GetTemplateDto, GetTemplateResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as GetTemplateDto;

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

    // 获取模板基本信息和计划日数据
    const { data: template, error: templateError } = await supabase
        .from("coach_plan_templates")
        .select("*")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (templateError || !template) {
        return NextResponse.json({
            success: false,
            message: "Template not found"
        }, { status: 404 });
    }

    // 从training_days字段中提取计划日数据
    let days = [];
    try {
        days = typeof template.training_days === 'string' 
            ? JSON.parse(template.training_days) 
            : template.training_days || [];
    } catch (e) {
        console.error("Error parsing training_days:", e);
        days = [];
    }

    return NextResponse.json<ApiData<GetTemplateResponseDto>>({
        success: true,
        message: "获取训练计划模板详情成功",
        data: {
            template: {
                ...template,
                training_days: undefined // 不在template对象中重复包含training_days字段
            },
            days
        }
    });
}