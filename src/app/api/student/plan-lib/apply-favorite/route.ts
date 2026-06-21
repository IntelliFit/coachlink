import { NextResponse } from "next/server";
import { serviceRoleSupabase as supabase } from "@/lib/supabaseClient";
import type { ApplyFavoriteDto, ApplyFavoriteResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
    const { favoriteId, startDate } = await req.json() as ApplyFavoriteDto;

    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    const userId = authResult.userId || null;

    if (!authResult.isAuthenticated || !userId) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
        }, { status: 401 });
    }

    if (!favoriteId) {
        return NextResponse.json({
            success: false,
            message: "缺少计划ID",
        }, { status: 400 });
    }

    // 获取常用计划
    const { data: favorite, error: fetchError } = await supabase
        .from("student_plan_favorites")
        .select("*")
        .eq("id", favoriteId)
        .eq("user_id", userId)
        .single();

    if (fetchError || !favorite) {
        console.error("Error fetching favorite:", fetchError);
        return NextResponse.json({
            success: false,
            message: "找不到指定的常用计划",
        }, { status: 404 });
    }

    // 确定开始日期
    const planStartDate = startDate || new Date().toISOString().split("T")[0];

    // 将常用计划转换为可执行的计划实例
    // 使用 coach_plan_instances 表，source = 'self'
    const trainingDays = Array.isArray(favorite.training_days)
        ? favorite.training_days
        : [];

    // 为每个训练日分配实际日期
    const generatedTrainingDays = trainingDays.map(
        (day: any, index: number) => {
            const dayDate = new Date(planStartDate);
            dayDate.setDate(dayDate.getDate() + index);

            return {
                dayIndex: day.dayIndex || index + 1,
                date: dayDate.toISOString().split("T")[0],
                type: day.type,
                note: day.note || "",
                actionSets: day.actionSets || [],
                completed: false,
                completedAt: null,
            };
        },
    );

    // 创建计划实例
    // 使用类型断言，因为 database.types.ts 可能未更新 source 字段等
    const { data: planInstance, error: createError } = await supabase
        .from("coach_plan_instances")
        .insert({
            student_id: userId,
            name: favorite.name,
            description: favorite.description,
            training_days: generatedTrainingDays,
            status: "active",
            start_date: planStartDate,
            source: "self", // 标记为学员自建计划
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        } as any)
        .select()
        .single();

    if (createError) {
        console.error("Error creating plan instance:", createError);
        return NextResponse.json({
            success: false,
            message: `应用计划失败: ${createError.message}`,
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ApplyFavoriteResponseDto>>({
        success: true,
        message: "计划已应用成功",
        data: {
            planInstanceId: planInstance.id,
            message:
                `计划"${favorite.name}"已应用，将从${planStartDate}开始执行`,
        },
    });
}
