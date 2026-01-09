import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";
import type { GetPersonalRecordsResponseDto } from "./entity";
import type { ApiData } from "@/types/api";

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: "用户未登录",
            data: null,
        }, { status: 401 });
    }

    const userId = session.user.id;

    // Use personal_records_history with new column names
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
        .from("personal_records_history")
        .select("id, exercise_name, weight, reps, e1rm, date_achieved, notes")
        .eq("user_id", userId)
        .order("date_achieved", { ascending: false })
        .limit(10);

    if (error) {
        console.error("获取个人记录失败:", error);
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: "获取个人记录失败",
            data: null,
        }, { status: 500 });
    }

    // Map to response format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const personalRecords = ((data || []) as any[]).map((r) => ({
        id: r.id,
        exercise_name: r.exercise_name,
        weight: r.weight,
        reps: r.reps,
        e1rm: r.e1rm,
        date_achieved: r.date_achieved,
        notes: r.notes,
    }));

    return NextResponse.json<ApiData<GetPersonalRecordsResponseDto>>({
        success: true,
        message: "获取个人记录成功",
        data: {
            personalRecords,
        },
    });
}
