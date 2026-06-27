import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type {
    AdminNavDataDto,
    AdminNavDataResponseDto
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

    const {

    } = await req.json() as AdminNavDataDto;

    if (!session.user.is_admin) {
        return NextResponse.json({
            success: false,
            message: '用户无权限',
            data: null
        }, { status: 403 });
    }

    const { count: paymentUnreviewed } = await supabase
        .from('coach_subscriptions')
        .select('*', { count: 'exact', head: true })
        .eq('status', "waiting");

    const { count: coachApplicationUnreviewed } = await supabase
        .from('coach_applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', "pending");

    const { count: feedbackOpen } = await supabase
        .from('feedbacks')
        .select('*', { count: 'exact', head: true })
        .in('status', ["open", "pending"]);
    

    // 重要！必须声明接口范型位 ApiData<返回参数的接口类型>
    return NextResponse.json<ApiData<AdminNavDataResponseDto>>({
        success: true,
        message: '教练申请创建成功',
        // CreateCoachApplicationResponseDto 反映的是这里的 data 数据结构
        data: {
            paymentUnreviewed: paymentUnreviewed ?? 0,
            coachApplicationUnreviewed: coachApplicationUnreviewed ?? 0,
            // TODO: 等待完成提交审核来修改这部分
            rankingRecordsUnreviewed: 0,
            feedbackOpen: feedbackOpen ?? 0
        }
    });
}
