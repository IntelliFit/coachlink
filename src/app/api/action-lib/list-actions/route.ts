import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { ListActionsDto, ListActionsResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 12,
        search
    } = await req.json() as ListActionsDto;

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

    // Build query
    let query = supabase
        .from("coach_actions")
        .select("*", { count: "exact" })
        .eq("coach_id", userId);

    // Apply search filter if provided
    if (search) {
        query = query.or(`name.ilike.%${search}%,detail.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: actions, count, error } = await query;

    if (error) {
        console.error("Error fetching actions:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch actions"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ListActionsResponseDto>>({
        success: true,
        message: "获取动作列表成功",
        data: {
            actions: actions || [],
            totalCount: count || 0,
            page,
            limit
        }
    });
}
