import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { PUBLIC_PROFILE_COLUMNS, resolveProfileAccess } from '@/lib/profileAccess';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { UserProfilesRow } from '@/types';
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
    } = await req.json().catch(() => ({})) as GetUserProfileDto;

    if (userId !== undefined && userId !== null && typeof userId !== 'string') {
        return NextResponse.json<ApiData<GetUserProfileResponseDto>>({
            success: false,
            message: 'userId 参数无效',
            data: null
        }, { status: 400 });
    }

    const targetUserId = userId ? userId : currentUserId;

    // body 里的 userId 只决定"看谁"，能看到多少由服务端按身份关系判定
    const access = await resolveProfileAccess({
        viewerId: currentUserId,
        targetUserId,
        viewerIsAdmin: (session.user as { is_admin?: boolean }).is_admin === true,
    });

    const { data: profile, error } = await supabase
        .from('user_profiles')
        .select(access === 'full' ? '*' : PUBLIC_PROFILE_COLUMNS)
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
        // public 访问时只含 PUBLIC_PROFILE_COLUMNS，其余字段缺省
        data: {
            profile: (profile as unknown as UserProfilesRow | null) ?? null
        }
    });
}
