import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
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

        const { videoId, updates } = await request.json();

        // 验证必要参数
        if (!videoId) {
            return NextResponse.json({
                success: false,
                message: '缺少必要参数',
                data: null
            }, { status: 400 });
        }

        const userId = session.user.id;

        const { data, error } = await supabase
            .from('training_videos')
            .update(updates)
            .eq('id', videoId)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`更新视频失败: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            message: '更新视频成功',
            data
        });
    } catch (error: any) {
        console.error('更新视频失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '更新视频失败',
            data: null
        }, { status: 500 });
    }
}