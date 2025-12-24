import supabase from "@/lib/supabaseClient";
import { NextResponse } from "next/server";
import { getServerSession } from "@/app/api/auth/[...nextauth]/auth";
import { GetLeaderboardDto } from "./entity";

export async function POST(req: Request) {
    // const session = await getServerSession();
    // if (!session) {
    //     return NextResponse.json({
    //         success: false,
    //         message: "Unauthorized"
    //     });
    // }

    const {
        leaderboardType = 'pullup'
    } = await req.json() as GetLeaderboardDto;

    const { data: leaderboard, error } = await supabase.functions.invoke('get-leaderboard', {
        body: { type: leaderboardType }
    });

    if (error) {
        return NextResponse.json({
            success: false,
            message: error.message
        });
    }

    const records = leaderboard.data || [];
    const success = leaderboard.success ?? true;

    return NextResponse.json({
        success,
        message: '获取成功',
        data: {
            records
        }
    });
}