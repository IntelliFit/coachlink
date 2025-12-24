import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { DeleteStudentCommentApiResponse } from './entity';

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
    const { id } = await req.json();

    // 检查评论是否存在且属于当前用户
    const { data: existingComment, error: fetchError } = await supabase
        .from('student_comments')
        .select('id, student_id')
        .eq('id', id)
        .maybeSingle();

    if (fetchError || !existingComment) {
        return NextResponse.json<DeleteStudentCommentApiResponse>({
            success: false,
            message: '评论不存在或获取评论失败: ' + (fetchError?.message || '未知错误'),
            data: null
        }, { status: 404 });
    }

    // 确保用户只能删除自己的评论
    if (existingComment.student_id !== userId) {
        return NextResponse.json<DeleteStudentCommentApiResponse>({
            success: false,
            message: '您只能删除自己的评论',
            data: null
        }, { status: 403 });
    }

    // 删除评论
    const { error } = await supabase
        .from('student_comments')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json<DeleteStudentCommentApiResponse>({
            success: false,
            message: '删除评论失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<DeleteStudentCommentApiResponse>({
        success: true,
        message: '评论删除成功',
        data: {}
    });
}