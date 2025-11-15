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

    const { videoId } = await request.json();

    // 验证视频ID
    if (!videoId) {
        return NextResponse.json({
            success: false,
            message: '缺少视频ID',
            data: null
        }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('training_videos')
        .select('*')
        .eq('id', videoId)
        .is('deleted_at', null)
        .single();

    if (error) {
        throw new Error(`获取视频详情失败: ${error.message}`);
    }

    return NextResponse.json({
        success: true,
        message: '获取视频详情成功',
        data
    });

}