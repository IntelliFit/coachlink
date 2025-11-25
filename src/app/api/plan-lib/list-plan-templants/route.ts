import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { ListPlansDto, ListPlansResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 12,
        search,
        type
    } = await req.json() as ListPlansDto;

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

    // Build query - 使用显式类型避免类型推断过深
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query: any = supabase
        .from("training_plans")
        .select("*", { count: "exact" })
        .eq("coach_id", userId)
        .order("created_at", { ascending: false }); // 默认按创建时间倒序排序

    // Apply search filter if provided
    if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply type filter if provided
    if (type) {
        query = query.eq("type", type);
    }

    // Apply pagination
    query = query.range(from, to);

    const { data: plans, count, error } = await query;

    if (error) {
        console.error("Error fetching plans:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch plans"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ListPlansResponseDto>>({
        success: true,
        message: "获取训练计划列表成功",
        data: {
            plans: plans || [],
            totalCount: count || 0,
            page,
            limit
        }
    });
}