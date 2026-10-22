import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import { getAuthUser } from '@/lib/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    GetCoachApplicationDto,
    GetCoachApplicationResponseDto
} from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    const authResult = session?.user?.id
        ? { isAuthenticated: true, userId: session.user.id, user: session.user }
        : await getAuthUser(req);
    if (!authResult.isAuthenticated || !authResult.userId) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = authResult.userId;
    const isAdmin = !!(authResult.user as { is_admin?: boolean } | undefined)?.is_admin;

    const body = await req.json() as GetCoachApplicationDto;

    let query = supabase
        .from('coach_applications')
        .select('*');

    // 申请里有手机号、邮箱、地址和资质材料：只有管理员能按 id / userId 查别人的申请，
    // 普通用户无论传什么参数都只能查到自己的。
    if (isAdmin && body.id) {
        query = query.eq('id', body.id);
    } else if (isAdmin && body.userId) {
        query = query.eq('user_id', body.userId);
    } else {
        if (body.id) {
            query = query.eq('id', body.id);
        }
        query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '查询教练申请失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    // 重要！必须声明接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<GetCoachApplicationResponseDto>>({
        success: true,
        message: '查询成功',
        // GetCoachApplicationResponseDto 反映的是这里的 data 数据结构
        data: {
            application: data
        }
    });
}
