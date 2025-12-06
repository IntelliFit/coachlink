import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { CreateStudentCommentApiResponse } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const userId = session.user.id;
    const { coach_id, comment, media, rating } = await req.json();

    // 检查用户是否订阅了该教练
    const { data: subscriptionData, error: subscriptionError } = await supabase
        .from('coach_subscriptions')
        .select('id')
        .eq('student_id', userId)
        .eq('coach_id', coach_id)
        .eq('status', 'active')
        .maybeSingle();

    if (subscriptionError || !subscriptionData) {
        return NextResponse.json<CreateStudentCommentApiResponse>({
            success: false,
            message: '只有订阅了该教练的学员才能发表评论',
            data: null
        }, { status: 403 });
    }

    // 创建评论
    const { data, error } = await supabase
        .from('student_comments')
        .insert({
            student_id: userId,
            coach_id,
            comment,
            rating,
            media: media || null
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json<CreateStudentCommentApiResponse>({
            success: false,
            message: '创建评论失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<CreateStudentCommentApiResponse>({
        success: true,
        message: '评论创建成功',
        data: {
            comment: data
        }
    });
}