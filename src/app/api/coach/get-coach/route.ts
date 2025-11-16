import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { GetCoachDto } from "./entity";
import { getServerSession } from "next-auth";

export async function POST(req: Request) {

    const { id } = await req.json() as GetCoachDto;

    if (!id) {
        return NextResponse.json({
            success: false,
            message: "教练ID是必需的"
        });
    }

    // 构建查询
    let query = supabase
        .from("coaches")
        .select("*")
        .eq("id", id)
        .single();

    const { data: coach, error } = await query;

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message
        });
    }

    if (!coach) {
        return NextResponse.json({
            success: false,
            message: "未找到指定的教练"
        });
    }

    return NextResponse.json({
        success: true,
        message: "获取成功",
        data: {
            coach
        }
    });
}