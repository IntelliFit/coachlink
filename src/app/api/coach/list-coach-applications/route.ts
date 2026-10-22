import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
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

    // 列表包含所有申请人的手机号、邮箱和资质材料，只给管理员看。
    if (!(session.user as { is_admin?: boolean }).is_admin) {
        return NextResponse.json({
            success: false,
            message: '无权限查看教练申请列表',
            data: null
        }, { status: 403 });
    }

    const body = await req.json() as ListCoachApplicationsDto;

    const page = body.page ?? 1;
    const limit = body.limit ?? 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
        .from('coach_applications')
        .select('*', { count: 'exact' });

    // 后台状态筛选是多选，可能传单个状态或状态数组
    const statuses = (Array.isArray(body.status) ? body.status : [body.status])
        .filter((status): status is string => typeof status === 'string' && status.length > 0);
    if (statuses.length === 1) {
        query = query.eq('status', statuses[0]);
    } else if (statuses.length > 1) {
        query = query.in('status', statuses);
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