import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { AddTemplateDto, AddTemplateResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        name,
        description,
        tags = [],
        suitableFor = '',
        days
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

    if (tags.length === 0 || !suitableFor) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数"
        }, { status: 400 });
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
    // 创建模板
    const { data: template, error: templateError } = await supabase
        .from("coach_plan_templates")
        .insert({
            coach_id: userId,
            name,
            description: description || null,
            tags: tags || [],
            suitable_for: suitableFor,
            training_days: days.filter(day => day.type === 'training').length,
            rest_days: days.filter(day => day.type === 'rest').length
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

    // 创建计划日和动作组
    for (const day of days) {
        const { data: createdDay, error: dayError } = await supabase
            .from("coach_plan_days")
            .insert({
                plan_template_id: template.id,
                day_index: day.day_index,
                type: day.type,
                note: day.note || null
            })
            .select()
            .single();

        if (dayError) {
            console.error("Error creating day:", dayError);
            return NextResponse.json({
                success: false,
                message: "Failed to create plan day"
            }, { status: 500 });
        }

        // 创建动作组
        if (day.action_sets && day.action_sets.length > 0) {
            const actionSetsToInsert = day.action_sets.map((actionSet, index) => ({
                day_id: createdDay.id,
                action_id: actionSet.action_id,
                set_order: index + 1,
                sets: actionSet.sets,
                reps: actionSet.reps,
                intensity: actionSet.intensity || null,
                rest_seconds: actionSet.rest_seconds || null
            }));

            const { error: actionSetsError } = await supabase
                .from("coach_plan_action_sets")
                .insert(actionSetsToInsert);

            if (actionSetsError) {
                console.error("Error creating action sets:", actionSetsError);
                return NextResponse.json({
                    success: false,
                    message: "Failed to create action sets"
                }, { status: 500 });
            }
        }
    }

    return NextResponse.json<ApiData<AddTemplateResponseDto>>({
        success: true,
        message: "创建训练计划模板成功",
        data: {
            template
        }
    });
}