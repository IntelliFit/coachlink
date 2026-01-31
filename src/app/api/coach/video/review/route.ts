import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }

    const body = await req.json();
    const { videoId, feedback } = body;

    if (!videoId) {
        return NextResponse.json({ success: false, message: '缺少必要参数' }, { status: 400 });
    }

    // 从数据库获取用户档案
    const { data: profile } = await supabase
        .from("user_profiles")
        .select("nickname")
        .eq("user_id", session.user.id)
        .single();

    const coachFeedback = {
        ...feedback,
        coach_name: profile?.nickname || "教练",
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
