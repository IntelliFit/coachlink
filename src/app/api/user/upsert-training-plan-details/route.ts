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

        const { training_plan_id, details } = await request.json();

        // 验证必要参数
        if (!training_plan_id || !details) {
            return NextResponse.json({
                success: false,
                message: '缺少必要参数',
                data: null
            }, { status: 400 });
        }

        // 调用Supabase函数
        const { data, error } = await supabase.functions.invoke('upsert-training-plan-details', {
            body: { training_plan_id, details },
        });

        if (error || !data?.success) {
            throw new Error(data?.message || error?.message || '保存训练计划明细失败');
        }

        return NextResponse.json({
            success: true,
            message: '保存训练计划明细成功',
            data: data.data
        });
    } catch (error: any) {
        console.error('保存训练计划明细失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '保存训练计划明细失败',
            data: null
        }, { status: 500 });
    }
}