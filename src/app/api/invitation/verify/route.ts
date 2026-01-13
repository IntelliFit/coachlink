import { NextRequest, NextResponse } from "next/server";
import supabase from "@/lib/supabaseClient";
import { ApiData } from "@/types/api";

interface CoachPreview {
    id: string;
    name: string;
    avatar_url: string | null;
    title: string | null;
    bio: string | null;
    specialties: string[] | null;
    rating: number | null;
    total_students: number | null;
}

interface VerifyInvitationResponse {
    valid: boolean;
    coach: CoachPreview | null;
}

// GET - 验证邀请码并返回教练信息
export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code")?.trim().toUpperCase();

    if (!code) {
        return NextResponse.json<ApiData<VerifyInvitationResponse>>({
            success: true,
            data: {
                valid: false,
                coach: null,
            },
        });
    }

    // 根据邀请码查找教练
    const { data: coach, error } = await supabase
        .from("coaches")
        .select(`
            id,
            name,
            avatar_url,
            title,
            bio,
            specialties,
            rating,
            total_students
        `)
        .eq("invitation_code", code)
        // coaches.status 的真实值域是 pending/approved/rejected/suspended（无 active）
        .eq("status", "approved") // 只返回已审核通过的教练
        .single();

    if (error || !coach) {
        return NextResponse.json<ApiData<VerifyInvitationResponse>>({
            success: true,
            message: "邀请码无效或教练不存在",
            data: {
                valid: false,
                coach: null,
            },
        });
    }

    return NextResponse.json<ApiData<VerifyInvitationResponse>>({
        success: true,
        data: {
            valid: true,
            coach: {
                id: coach.id,
                name: coach.name,
                avatar_url: coach.avatar_url,
                title: coach.title,
                bio: coach.bio,
                specialties: coach.specialties,
                rating: coach.rating,
                total_students: coach.total_students,
            },
        },
    });
}
