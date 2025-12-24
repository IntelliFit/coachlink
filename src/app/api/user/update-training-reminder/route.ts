import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
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

    const userId = session.user.id;
    const { id, updates } = await request.json();

    // 验证必填字段
    if (!id) {
        return NextResponse.json({
            success: false,
            message: '缺少提醒ID',
            data: null
        }, { status: 400 });
    }

    // 检查提醒是否存在且属于当前用户
    const { data: existingReminder, error: fetchError } = await supabase
        .from('training_reminders')
        .select('id')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

    if (fetchError || !existingReminder) {
        return NextResponse.json({
            success: false,
            message: '找不到该提醒或无权限操作',
            data: null
        }, { status: 404 });
    }

    const { data, error } = await supabase
        .from('training_reminders')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return NextResponse.json({
        success: true,
        message: '更新训练提醒成功',
        data: {
            reminder: data
        }
    });

}