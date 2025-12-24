import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { UpdateStudentCommentApiResponse } from './entity';

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
    const { id, comment, media } = await req.json();

    // 检查评论是否存在且属于当前用户
    const { data: existingComment, error: fetchError } = await supabase
        .from('student_comments')
        .select('id, student_id')
        .eq('id', id)
        .maybeSingle();

    if (fetchError || !existingComment) {
        return NextResponse.json<UpdateStudentCommentApiResponse>({
            success: false,
            message: '评论不存在或获取评论失败: ' + (fetchError?.message || '未知错误'),
            data: null
        }, { status: 404 });
    }

    // 确保用户只能更新自己的评论
    if (existingComment.student_id !== userId) {
        return NextResponse.json<UpdateStudentCommentApiResponse>({
            success: false,
            message: '您只能更新自己的评论',
            data: null
        }, { status: 403 });
    }

    // 更新评论
    const { data, error } = await supabase
        .from('student_comments')
        .update({
            comment,
            media: media || null,
            updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json<UpdateStudentCommentApiResponse>({
            success: false,
            message: '更新评论失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<UpdateStudentCommentApiResponse>({
        success: true,
        message: '评论更新成功',
        data: {
            comment: data
        }
    });
}