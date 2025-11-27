import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { DeleteContentDto, DeleteContentResponseDto } from './entity';

export async function POST(req: Request) {
    const { id } = await req.json() as DeleteContentDto;

    // 获取当前登录用户
    const session = await getServerSession();
    const userId = session?.user?.id || null;

    if (!userId) {
        return NextResponse.json({
            success: false,
            message: '缺少用户ID'
        }, { status: 401 });
    }

    if (!id) {
        return NextResponse.json({
            success: false,
            message: '缺少内容ID'
        }, { status: 400 });
    }

    // 验证教练是否有权限删除此内容
    const { data: existingContent, error: contentError } = await supabase
        .from('coach_contents')
        .select('coach_id')
        .eq('id', id)
        .single();

    if (contentError || !existingContent) {
        return NextResponse.json({
            success: false,
            message: '内容不存在'
        }, { status: 404 });
    }

    if (!session.user.is_coach) {
        return NextResponse.json({
            success: false,
            message: '无权限删除此内容'
        }, { status: 403 });
    }

    // 删除内容记录
    const { error: deleteError } = await supabase
        .from('coach_contents')
        .delete()
        .eq('id', id);

    if (deleteError) {
        console.error('删除内容失败:', deleteError);
        return NextResponse.json({
            success: false,
            message: '删除失败，请重试'
        }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: '内容删除成功'
    } as DeleteContentResponseDto);
}