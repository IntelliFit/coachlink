import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    GetCoachApplicationDto,
    GetCoachApplicationResponseDto
} from './entity';

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
    const userId = session.user.id;

    const body = await req.json() as GetCoachApplicationDto;

    let query = supabase
        .from('coach_applications')
        .select('*');

    // 如果提供了ID，则按ID查询
    if (body.id) {
        query = query.eq('id', body.id);
    }
    // 如果没有提供ID但提供了userId，则按user_id查询
    else if (body.userId) {
        query = query.eq('user_id', body.userId);
    }
    // 默认查询当前用户的申请
    else {
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