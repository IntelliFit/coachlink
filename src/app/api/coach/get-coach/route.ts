import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { GetCoachDto, GetCoachResponseDto } from "./entity";
import { ApiData } from "@/types/api";
import { CoachesRow } from "@/types";

export async function POST(req: Request) {
    const {
        id,
        userId,
        needQrCode = false
    } = await req.json() as GetCoachDto;

    let coach: CoachesRow | null = null;

    if (id) {
        // 构建查询
        let query = supabase
            .from("coaches")
            .select("*")
            .eq("id", id)
            .single();

        const { data: coachData, error } = await query;

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message
            });
        }

        if (!coachData) {
            return NextResponse.json({
                success: false,
                message: "未找到指定的教练"
            });
        }

        coach = coachData;
    }

    if (userId) {
        let query = supabase
            .from("coaches")
            .select("*")
            .eq("user_id", userId)
            .single();

        const { data: coachData, error } = await query;

        if (error) {
            return NextResponse.json({
                success: false,
                message: error.message
            });
        }

        if (!coachData) {
            return NextResponse.json({
                success: false,
                message: "未找到指定的教练"
            });
        }

        coach = coachData;
    }

    if (!needQrCode && coach) {
        coach.payment_qr_code = undefined;
    }

    return NextResponse.json<ApiData<GetCoachResponseDto>>({
        success: true,
        message: '获取定价信息成功',
        data: {
            coach: coach,
        }
    });
}