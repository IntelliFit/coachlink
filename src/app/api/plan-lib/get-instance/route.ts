import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { GetInstanceDto, GetInstanceResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    // Check if user is logged in
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    const {
        id,
        subscriptionId
    } = await req.json() as GetInstanceDto;

    if (!id && !subscriptionId) {
        return NextResponse.json({
            success: false,
            message: "Invalid parameters"
        });
    }

    let query = supabase
        .from("coach_plan_instances")
        .select("*");

    if (id) {
        query = query.eq("id", id);
    }

    if (subscriptionId) {
        query = query.eq('coach_plan_template_id', subscriptionId);
    }

    // 获取计划实例
    const { data: instance, error } = await query.maybeSingle();

    if (!instance) {
        return NextResponse.json({
            success: true,
            message: "No plan instance found",
            data: {
                instance: null
            }
        })
    }

    if (error) {
        console.error("Error fetching instance:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch instance"
        }, { status: 500 });
    }

    // 检查用户权限（教练或学员都可以查看）
    if (instance.coach_id !== userId && instance.student_id !== userId) {
        return NextResponse.json({
            success: false,
            message: "Forbidden",
        }, { status: 403 });
    }

    return NextResponse.json<ApiData<GetInstanceResponseDto>>({
        success: true,
        message: "获取训练计划实例成功",
        data: {
            instance
        }
    });
}