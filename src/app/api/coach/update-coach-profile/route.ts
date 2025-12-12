import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Database } from "@/types/database.types";
import type { UpdateCoachProfileDto, UpdateCoachProfileResponseDto } from "./entity";
import type { ApiData } from "@/types/api";
import { getServerSession } from "../../auth/[...nextauth]/auth";
import supabase from "@/lib/supabaseClient";

export async function POST(request: Request) {

    const session = await getServerSession();
    
    if (!session?.user?.id) {
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
            success: false, 
            message: "用户未登录",
            data: null
        }, { status: 401 });
    }

    try {
        const body = await request.json() as UpdateCoachProfileDto;
        const { id, bio, profile } = body;

        // 检查教练是否存在且属于当前用户
        const { data: coach, error: coachError } = await supabase
            .from('coaches')
            .select('id, user_id')
            .eq('id', id)
            .single();

        if (coachError || !coach) {
            return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
                success: false, 
                message: "教练不存在",
                data: null
            }, { status: 404 });
        }

        // 验证权限 - 只有教练本人才能更新自己的信息
        if (coach.user_id !== session.user.id) {
            return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
                success: false, 
                message: "无权限访问",
                data: null
            }, { status: 403 });
        }

        // 更新教练信息
        const { data, error } = await supabase
            .from('coaches')
            .update({ 
                bio: bio || null,
                profile: profile || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('更新教练信息失败:', error);
            return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
                success: false, 
                message: error.message,
                data: null
            }, { status: 500 });
        }

        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
            success: true, 
            message: "教练信息更新成功",
            data: data as any
        });
    
    } catch (error: any) {
        console.error('更新教练信息异常:', error);
        return NextResponse.json<ApiData<UpdateCoachProfileResponseDto>>({ 
            success: false, 
            message: error.message,
            data: null
        }, { status: 500 });
    }
}