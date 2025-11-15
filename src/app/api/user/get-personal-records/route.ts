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

        const { user_id: userId } = await request.json();

        // 验证用户ID
        if (!userId) {
            return NextResponse.json({
                success: false,
                message: '缺少用户ID',
                data: null
            }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('personal_records')
            .select('*')
            .eq('user_id', userId)
            .order('date_achieved', { ascending: false })
            .limit(10);

        if (error) {
            throw new Error(error.message);
        }

        return NextResponse.json({
            success: true,
            message: '获取个人记录成功',
            data: {
                personalRecords: data || []
            }
        });
    } catch (error: any) {
        console.error('获取个人记录失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '获取个人记录失败',
            data: null
        }, { status: 500 });
    }
}