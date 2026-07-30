import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetUserProfileDto, GetUserProfileResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const currentUserId = session.user.id;
    
    const {
        userId
    } = await req.json() as GetUserProfileDto;

    const targetUserId = userId ? userId : currentUserId;

    // 查询用户档案
    console.log(targetUserId);
    
    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

    if (error) {
        console.error(error);
        
        return NextResponse.json<ApiData<GetUserProfileResponseDto>>({
            success: false,
            message: error.message,
            data: null
        }, { status: 500 });
    }

    // 重要！必须声明接口范型为 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetUserProfileResponseDto>>({
        success: true,
        message: profile ? '获取用户档案成功' : '用户档案尚未创建',
        // GetUserProfileResponseDto 反映的就是这个地方 data 的数据结构
        data: {
            profile: profile ?? null
        }
    });
}
