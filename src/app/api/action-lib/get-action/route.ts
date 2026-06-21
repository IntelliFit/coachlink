import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { GetActionDto, GetActionResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { getAuthUser } from "@/lib/auth";

export async function POST(req: Request) {
    const {
        id
    } = await req.json() as GetActionDto;

    // Check if user is logged in and has coach role
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id }
        : await getAuthUser(req);
    const userId = authResult.userId || null;

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


    // Fetch action
    const { data: action, error } = await supabase
        .from("coach_actions")
        .select("*")
        .eq("id", id)
        .eq("coach_id", userId)
        .single();

    if (error) {
        console.error("Error fetching action:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch action"
        }, { status: 500 });
    }

    if (!action) {
        return NextResponse.json({
            success: false,
            message: "Action not found"
        }, { status: 404 });
    }

    return NextResponse.json<ApiData<GetActionResponseDto>>({
        success: true,
        message: "获取动作详情成功",
        data: {
            action
        }
    });
}
