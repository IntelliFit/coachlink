import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

export async function POST(request: Request) {
    try {
        const session = await getServerSession();
        if (!session?.user?.id) {
            return NextResponse.json({
                success: false,
                message: '用户未登录',
                data: null
            }, { status: 401 });
        }

        const userId = session.user.id;
        const { id } = await request.json();

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

        const { error } = await supabase
            .from('training_reminders')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            message: '删除训练提醒成功',
            data: null
        });
    } catch (error: any) {
        console.error('删除训练提醒失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '删除训练提醒失败',
            data: null
        }, { status: 500 });
    }
}