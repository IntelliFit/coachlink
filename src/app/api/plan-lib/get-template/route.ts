import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { GetTemplateDto, GetTemplateResponseDto, CoachPlanDayDetail } from "./entity";
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

    // 获取模板基本信息
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

    // 获取模板下的所有计划日
    const { data: days, error: daysError } = await supabase
        .from("coach_plan_days")
        .select("*")
        .eq("plan_template_id", id)
        .order("day_index", { ascending: true });

    if (daysError) {
        console.error("Error fetching template days:", daysError);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch template days"
        }, { status: 500 });
    }

    // 获取每个计划日下的动作组
    const daysWithActionSets: CoachPlanDayDetail[] = [];
    for (const day of days || []) {
        const { data: actionSets, error: actionSetsError } = await supabase
            .from("coach_plan_action_sets")
            .select("*")
            .eq("day_id", day.id)
            .order("set_order", { ascending: true });

        if (actionSetsError) {
            console.error(`Error fetching action sets for day ${day.id}:`, actionSetsError);
            return NextResponse.json({
                success: false,
                message: "Failed to fetch action sets"
            }, { status: 500 });
        }

        daysWithActionSets.push({
            ...day,
            action_sets: actionSets || []
        });
    }

    return NextResponse.json<ApiData<GetTemplateResponseDto>>({
        success: true,
        message: "获取训练计划模板详情成功",
        data: {
            template,
            days: daysWithActionSets
        }
    });
}