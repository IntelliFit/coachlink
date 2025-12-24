import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { CreateInstanceDto, CreateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        name,
        description,
        templateId,
        subscriptionId,
        startDate,
        endDate,
        status,
        type,
        suitableFor,
        tags,
        trainingDays
    } = await req.json() as CreateInstanceDto;

    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    if (!name || !trainingDays) {
        return NextResponse.json({
            success: false,
            message: "缺少必要参数"
        }, { status: 400 });
    }

    const { data: subscription, error: subscriptionError } = await supabase
        .from('coach_subscriptions')
        .select('coach_id, student_id')
        .eq('id', subscriptionId)
        .single();
    
    if (subscriptionError) {
        return NextResponse.json({
            success: false,
            message: subscriptionError.message
        }, { status: 500 });
    }

    // 创建计划实例
    const { data: instance, error } = await supabase
        .from("coach_plan_instances")
        .insert({
            name,
            description: description || null,
            coach_subscription_id: subscriptionId,
            coach_id: subscription.coach_id || null,
            student_id: subscription.student_id || null,
            coach_plan_template_id: templateId || null,
            start_date: startDate || null,
            end_date: endDate || null,
            tags: tags || null,
            type: type || null,
            suitable_for: suitableFor || null,
            status: status || "active",
            training_days: trainingDays
        })
        .select()
        .single();

    if (error) {
        console.error("Error creating instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to create instance"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<CreateInstanceResponseDto>>({
        success: true,
        message: "创建训练计划实例成功",
        data: {
            instance
        }
    });
}