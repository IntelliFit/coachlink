import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    ListCoachApplicationsDto,
    ListCoachApplicationsResponseDto
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

    const body = await req.json() as ListCoachApplicationsDto;

    const page = body.page ?? 1;
    const limit = body.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from('coach_applications')
        .select('*', { count: 'exact' });

    // 如果提供了状态筛选条件
    if (body.status) {
        query = query.eq('status', body.status);
    }

    // 分页查询
    const { data, error, count } = await query
        .range(from, to)
        .order('applied_at', { ascending: false });

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '查询教练申请列表失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    // 重要！必须声明接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<ListCoachApplicationsResponseDto>>({
        success: true,
        message: '查询成功',
        // ListCoachApplicationsResponseDto 反映的是这里的 data 数据结构
        data: {
            applications: data,
            pagination: {
                page,
                limit,
                total: count ?? 0
            }
        }
    });
}