import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { userId } = await request.json();

    // 验证用户ID
    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '缺少用户ID',
            data: null
        }, { status: 400 });
    }

    // 调用Supabase函数
    const { data, error } = await supabase.functions.invoke('get-student-profile', {
        body: { userId },
    });

    if (error || !data?.success) {
        throw new Error(data?.message || error?.message || '获取学员档案失败');
    }

    return NextResponse.json({
        success: true,
        message: '获取学员档案成功',
        data: data.data
    });

}