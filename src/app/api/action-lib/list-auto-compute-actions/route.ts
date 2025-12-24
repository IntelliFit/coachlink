import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { ListAutoComputeActionsDto, ListAutoComputeActionsResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: "Unauthorized"
        }, { status: 401 });
    }

    const {
        coachId
    } = await req.json() as ListAutoComputeActionsDto;

    const { data: actions, count, error } = await supabase
        .from("coach_actions")
        .select("*", { count: "exact" })
        .eq("coach_id", coachId)
        .eq('enableAutoWeightCompute', true)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching actions:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch actions"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ListAutoComputeActionsResponseDto>>({
        success: true,
        message: "获取动作列表成功",
        data: {
            actions: actions || [],
        }
    });
}