import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { CreateInstanceDto, CreateInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        name,
        description,
        coachId,
        studentId,
        templateId,
        startDate,
        endDate,
        status,
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

    // 创建计划实例
    const { data: instance, error } = await supabase
        .from("coach_plan_instances")
        .insert({
            name,
            description: description || null,
            coach_id: coachId || null,
            student_id: studentId || null,
            coach_plan_template_id: templateId || null,
            start_date: startDate || null,
            end_date: endDate || null,
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