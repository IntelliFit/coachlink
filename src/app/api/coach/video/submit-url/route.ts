import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getSession } from '@/app/api/auth/[...nextauth]/auth';

// 校验视频URL格式的辅助函数
function isValidVideoUrl(url: string) {
    try {
        const parsed = new URL(url);
        return ['https:', 'http:'].includes(parsed.protocol);
    } catch {
        return false;
    }
}

// 自动生成视频标签（示例）
function generateAutoTags(context: any) {
    const tags: string[] = [];
    if (context.exercise_name) tags.push(context.exercise_name);
    if (context.week_number) tags.push(`week-${context.week_number}`);
    if (context.day_of_week) tags.push(`day-${context.day_of_week}`);
    return tags;
}

export async function POST(req: Request) {
    const session = await getSession();
    if (!session?.user) {
        return NextResponse.json({ success: false, message: '未登录用户' }, { status: 401 });
    }


    const userId = session.user.id;
    const body = await req.json();
    const { videoUrl, context } = body;

    if (!videoUrl || !context) {
        return NextResponse.json({ message: '缺少参数' }, { status: 400 });
    }

    if (!isValidVideoUrl(videoUrl)) {
        return NextResponse.json({ message: '无效的视频URL' }, { status: 400 });
    }

    let studentName: string | null = null;
    let coachId: string | null = null;

    // 获取用户资料和教练绑定关系
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, nickname')
        .eq('user_id', userId)
        .single();

    studentName = profile?.full_name || profile?.nickname || null;

    const { data: subscription } = await supabase
        .from('coach_subscriptions')
        .select('coach_id')
        .eq('student_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    coachId = subscription?.coach_id || context.coach_id || null;

    // 准备要插入的记录
    const videoData = {
        user_id: userId,
        coach_id: coachId,
        type: context.type,
        training_plan_id: context.training_plan_id,
        training_session_id: context.training_session_id,
        exercise_name: context.exercise_name,
        week_number: context.week_number,
        day_of_week: context.day_of_week,
        video_url: videoUrl,
        requires_review: context.requires_review ?? true,
        review_status: 'pending' as const,
        user_notes: context.user_notes,
        processing_status: 'ready' as const,
        tags: generateAutoTags(context),
        metadata: {
            storage_folder: userId,
            student_name: studentName || context.student_name || null,
            submission_source: 'url_submission'
        }
    };

    const { data, error } = await supabase
        .from('training_videos')
        .insert(videoData)
        .select()
        .single();

    if (error) {
        console.error('数据库记录创建失败:', error);
        return NextResponse.json({ message: '数据库记录创建失败' }, { status: 500 });
    }

    return NextResponse.json({
        message: '视频提交成功',
        data
    });
}
