import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import supabase from '@/lib/supabaseClient';

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, coachName, feedback } = body;

    if (!videoId || !coachName) {
        return NextResponse.json({ success: false, message: '缺少必要参数' }, { status: 400 });
    }

    const coachFeedback = {
        ...feedback,
        coach_name: coachName,
        coach_id: session.user.id,
        reviewed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
        .from('training_videos')
        .update({
            coach_feedback: coachFeedback,
            review_status: 'reviewed',
            reviewed_at: new Date().toISOString(),
        })
        .eq('id', videoId)
        .select()
        .single();

    if (error) {
        console.error('点评视频失败:', error);
        return NextResponse.json({ success: false, message: '点评视频失败' });
    }

    return NextResponse.json({ success: true, message: '点评成功', data });

}
