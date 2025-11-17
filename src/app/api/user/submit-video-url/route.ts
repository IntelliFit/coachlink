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

    const { videoUrl, context } = await request.json();

    const userId = session.user.id;

    // 验证URL
    if (!videoUrl) {
        return NextResponse.json({
            success: false,
            message: '缺少视频URL',
            data: null
        }, { status: 400 });
    }

    // 使用 session.user.id 作为权威用户ID
    const authUserId: string = userId;

    // 获取用户资料中的姓名（可选）
    let studentName: string | null = null;
    const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, nickname')
        .eq('user_id', authUserId)
        .maybeSingle();
    studentName = profile?.full_name || profile?.nickname || null;

    // 方案A：统一 coaches.id
    let coachIdForInsert: string | null = null;

    // 1) 订阅关系获取（优先）
    const { data: subRow } = await supabase
        .from('coach_subscriptions')
        .select('coach_id')
        .eq('student_id', authUserId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (subRow?.coach_id) {
        coachIdForInsert = subRow.coach_id;
    }

    // 2) 若 context 传入 coach_id，尝试识别并转换为 coaches.id
    const ctxCoachId = (context as any)?.coach_id as string | undefined;
    if (!coachIdForInsert && ctxCoachId) {
        const { data: coachById } = await supabase
            .from('coaches')
            .select('id')
            .eq('id', ctxCoachId)
            .maybeSingle();
        if (coachById?.id) {
            coachIdForInsert = coachById.id;
        } else {
            const { data: coachByUser } = await supabase
                .from('coaches')
                .select('id')
                .eq('user_id', ctxCoachId)
                .maybeSingle();
            if (coachByUser?.id) {
                coachIdForInsert = coachByUser.id;
            }
        }
    }

    // 3) 可选：仅允许已审核教练
    if (coachIdForInsert) {
        const { data: approvedCoach } = await supabase
            .from('coaches')
            .select('id')
            .eq('id', coachIdForInsert)
            .eq('status', 'approved')
            .maybeSingle();
        if (!approvedCoach) {
            coachIdForInsert = null;
        }
    }

    // 验证URL格式
    let isValidUrl = false;
    try {
        const urlObj = new URL(videoUrl);
        isValidUrl = urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
        isValidUrl = false;
    }

    if (!isValidUrl) {
        return NextResponse.json({
            success: false,
            message: '无效的视频URL',
            data: null
        }, { status: 400 });
    }

    const urlFolder = authUserId || 'anonymous';
    const videoData = {
        user_id: authUserId,
        coach_id: coachIdForInsert,
        type: context.type,
        training_plan_id: context.training_plan_id ?? null,
        training_session_id: context.training_session_id ?? null,
        exercise_name: context.exercise_name ?? null,
        week_number: context.week_number ?? null,
        day_of_week: context.day_of_week ?? null,
        video_url: videoUrl,
        requires_review: context.requires_review ?? true,
        review_status: 'pending' as const,
        user_notes: context.user_notes ?? null,
        processing_status: 'ready' as const,
        tags: [],
        metadata: {
            storage_folder: urlFolder,
            student_name: studentName || (context as any).student_name || null,
            submission_source: 'url_submission'
        }
    };

    const { data, error } = await supabase
        .from('training_videos')
        .insert(videoData)
        .select()
        .single();

    if (error) {
        throw new Error(`数据库记录创建失败: ${error.message}`);
    }

    return NextResponse.json({
        success: true,
        message: '提交视频URL成功',
        data
    });
}