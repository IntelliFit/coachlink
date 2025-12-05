import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { GetStudentCommentApiResponse } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const { id, coach_id, student_id } = await req.json();

    // 构建查询
    let query = supabase
        .from('student_comments')
        .select('*');

    // 根据提供的参数进行过滤
    if (id) {
        query = query.eq('id', id);
    }
    
    if (coach_id) {
        query = query.eq('coach_id', coach_id);
    }
    
    if (student_id) {
        query = query.eq('student_id', student_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json<GetStudentCommentApiResponse>({
            success: false,
            message: '获取评论失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    return NextResponse.json<GetStudentCommentApiResponse>({
        success: true,
        message: '获取评论成功',
        data: {
            comments: data
        }
    });
}