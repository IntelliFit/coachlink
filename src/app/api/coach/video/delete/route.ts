import supabase from '@/lib/supabaseClient';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }


    const userId = session.user.id;
    const { videoId } = await req.json();

    if (!videoId) {
        return NextResponse.json(
            { message: '缺少视频ID' },
            { status: 400 }
        );
    }

    const { error } = await supabase
        .from('training_videos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', videoId)
        .eq('user_id', userId);

    if (error) {
        console.error('删除视频失败:', error);
        return NextResponse.json(
            { message: '删除视频失败' },
            { status: 500 }
        );
    }

    return NextResponse.json({
        message: '视频已删除'
    });
}
