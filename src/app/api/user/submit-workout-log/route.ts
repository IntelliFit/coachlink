import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import { WorkoutLogPayload } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const payload = await req.json() as WorkoutLogPayload;
    const userId = session.user.id;

    // 调用Supabase函数
    const { data, error } = await supabase.functions.invoke('submit-workout-log', {
        body: { userId, ...payload },
    });

    if (error || !data?.success) {
        throw new Error(data?.message || error?.message || '提交训练日志失败');
    }

    return NextResponse.json({
        success: true,
        message: '提交训练日志成功',
        data: data.data
    });
}