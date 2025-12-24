import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;

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
}