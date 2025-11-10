import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';

export async function GET(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get('page') || 1);
    const limit = Number(searchParams.get('limit') || 10);

    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data, count, error } = await supabase
        .from('training_videos')
        .select('*', { count: 'exact' })
        .eq('user_id', session.user.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (error) {
        console.error('获取视频列表失败:', error);
        return NextResponse.json({ success: false, message: '获取视频列表失败' });
    }

    return NextResponse.json({
        success: true,
        message: '获取成功',
        data: { videos: data || [], total: count || 0 },
    });
}
