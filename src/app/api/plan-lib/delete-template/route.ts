import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { DeleteTemplateDto, DeleteTemplateResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteTemplateDto;

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

    // 检查模板是否存在且属于当前教练
    const { data: template, error: templateError } = await supabase
        .from("coach_plan_templates")
        .select("id")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (templateError || !template) {
        return NextResponse.json({
            success: false,
            message: "Template not found or access denied"
        }, { status: 404 });
    }

    // 删除模板（会级联删除相关的计划日和动作组）
    const { error: deleteError } = await supabase
        .from("coach_plan_templates")
        .delete()
        .eq("id", id)
        .eq("coach_id", userId);

    if (deleteError) {
        console.error("Error deleting template:", deleteError);
        return NextResponse.json({
            success: false,
            message: "Failed to delete template"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<DeleteTemplateResponseDto>>({
        success: true,
        message: "删除训练计划模板成功",
        data: id
    });
}