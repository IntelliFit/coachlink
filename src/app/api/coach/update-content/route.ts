import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import type { UpdateContentDto, UpdateContentResponseDto } from './entity';

export async function POST(req: Request) {
    const {
        id,
        title,
        content,
        content_type,
        required_tier,
        is_featured,
        tags,
        media_urls = [],
        thumbnail_url,
        isDraft = false
    } = await req.json() as UpdateContentDto;

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

    // 构建更新数据对象
    const updateData: any = {
        updated_at: new Date().toISOString()
    };

    // 只有提供了值的字段才会被更新
    if (title !== undefined) updateData.title = title?.trim();
    if (content !== undefined) updateData.content = content?.trim();
    if (content_type !== undefined) updateData.content_type = content_type;
    if (required_tier !== undefined) updateData.required_tier = required_tier;
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (tags !== undefined) updateData.tags = tags;
    if (media_urls !== undefined) updateData.media_urls = media_urls;
    if (thumbnail_url !== undefined) updateData.thumbnail_url = thumbnail_url;

    // 验证教练是否有权限更新此内容
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

    // 验证教练身份
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id')
        .eq('user_id', userId)
        .eq('id', existingContent.coach_id)
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: '无权限更新此内容'
        }, { status: 403 });
    }

    // 更新内容记录
    const { data: updatedContent, error: updateError } = await supabase
        .from('coach_contents')
        .update(updateData)
        .eq('id', id)
        .select('*')
        .single();

    if (updateError) {
        console.error('更新内容失败:', updateError);
        return NextResponse.json({
            success: false,
            message: '更新失败，请重试'
        }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        message: isDraft ? '草稿更新成功' : '内容更新成功',
        data: updatedContent as UpdateContentResponseDto
    });
}