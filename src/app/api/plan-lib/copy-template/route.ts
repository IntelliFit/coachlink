import { NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { CopyTemplateDto, CopyTemplateResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as CopyTemplateDto;

    // Check if user is logged in and has coach role
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

    // 获取源模板
    const { data: sourceTemplate, error: templateError } = await supabase
        .from("coach_plan_templates")
        .select("*")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (templateError || !sourceTemplate) {
        return NextResponse.json({
            success: false,
            message: "Template not found or access denied",
        }, { status: 404 });
    }

    // 创建新模板（复制源模板的所有字段，除了id、created_at、updated_at）
    const { data: newTemplate, error: createError } = await supabase
        .from("coach_plan_templates")
        .insert({
            coach_id: userId,
            name: `${sourceTemplate.name}（副本）`,
            description: sourceTemplate.description,
            tags: sourceTemplate.tags,
            week_days: sourceTemplate.week_days,
            contained_options: sourceTemplate.contained_options,
            suitable_for: sourceTemplate.suitable_for,
            training_days: sourceTemplate.training_days,
            training_days_count: sourceTemplate.training_days_count,
            rest_days_count: sourceTemplate.rest_days_count,
            type: sourceTemplate.type,
        })
        .select()
        .single();

    if (createError) {
        console.error("Error copying template:", createError);
        return NextResponse.json({
            success: false,
            message: "Failed to copy template",
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<CopyTemplateResponseDto>>({
        success: true,
        message: "复制训练计划模板成功",
        data: {
            template: newTemplate,
        },
    });
}
