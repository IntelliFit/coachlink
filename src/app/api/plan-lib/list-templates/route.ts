import { NextResponse } from "next/server";
import supabase from '@/lib/supabaseClient';
import { ListTemplatesDto, ListTemplatesResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";

export async function POST(req: Request) {
    const {
        page = 1,
        limit = 12,
        search,
        type
    } = await req.json() as ListTemplatesDto;

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
        .from("coach_plan_templates")
        .select("*", { count: "exact" })
        .eq("coach_id", userId)
        .order("created_at", { ascending: false }); // 默认按创建时间倒序排序

    // Apply search filter if provided
    if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply type filter if provided
    if (type && type !== 'all') {
        query = query.eq("type", type);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data: templates, count, error } = await query;

    if (error) {
        console.error("Error fetching templates:", error);
        return NextResponse.json({
            success: false,
            message: "Failed to fetch templates"
        }, { status: 500 });
    }

    return NextResponse.json<ApiData<ListTemplatesResponseDto>>({
        success: true,
        message: "获取训练计划模板列表成功",
        data: {
            templates: templates || [],
            totalCount: count || 0,
            page,
            limit
        }
    });
}