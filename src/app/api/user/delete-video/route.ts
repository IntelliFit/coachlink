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

        const { videoId, userId } = await request.json();

        // 验证必要参数
        if (!videoId || !userId) {
            return NextResponse.json({
                success: false,
                message: '缺少必要参数',
                data: null
            }, { status: 400 });
        }

        const { error } = await supabase
            .from('training_videos')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', videoId)
            .eq('user_id', userId);

        if (error) {
            throw new Error(`删除视频失败: ${error.message}`);
        }

        return NextResponse.json({
            success: true,
            message: '删除视频成功',
            data: null
        });
    } catch (error: any) {
        console.error('删除视频失败:', error);
        return NextResponse.json({
            success: false,
            message: error.message || '删除视频失败',
            data: null
        }, { status: 500 });
    }
}