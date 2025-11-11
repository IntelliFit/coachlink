import supabase from "@/lib/supabaseClient";
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    // 查询 Supabase
    const { data: specialties, error, count } = await supabase
        .from('specialties')
        .select("*")

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message
        });
    }

    return NextResponse.json({
        success: true,
        message: '获取成功',
        data: {
            specialties
        }
    });
}
