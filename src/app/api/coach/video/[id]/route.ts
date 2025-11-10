import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';

// 获取单个视频详情
export async function GET(
    req: Request,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }

    const videoId = params.id;

    if (!videoId) {
        return NextResponse.json({ message: '缺少视频ID参数' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('training_videos')
        .select('*')
        .eq('id', videoId)
        .is('deleted_at', null)
        .single();

    if (error) {
        console.error('获取视频详情失败:', error);
        return NextResponse.json(
            { message: '获取视频详情失败' },
            { status: 500 }
        );
    }

    if (!data) {
        return NextResponse.json({ message: '视频不存在' }, { status: 404 });
    }

    return NextResponse.json(data);
}
