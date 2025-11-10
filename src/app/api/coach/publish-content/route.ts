import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import type { PublishContentDto, PublishContentResponseDto } from './entity';

export async function POST(req: Request) {
    const {
        userId,
        coachId,
        title,
        content,
        content_type,
        required_tier,
        is_featured,
        tags,
        media_urls = [],
        thumbnail_url,
        isDraft = false
    } = await req.json() as PublishContentDto;

    // 获取当前登录用户
    const session = await getServerSession();
    const callerUserId = session?.user?.id || userId || null;

    if (!callerUserId) {
        return NextResponse.json({
            success: false,
            message: '缺少用户ID'
        }, { status: 401 });
    }

    if (!coachId || !title || !content) {
        return NextResponse.json({
            success: false,
            message: '缺少必要参数'
        }, { status: 400 });
    }

    if (![0, 1, 2, 3].includes(required_tier)) {
        return NextResponse.json({
            success: false,
            message: '无效的权限等级'
        }, { status: 400 });
    }

    if (!['text', 'video', 'image', 'live', 'plan'].includes(content_type)) {
        return NextResponse.json({
            success: false,
            message: '无效的内容类型'
        }, { status: 400 });
    }

    // 验证教练是否存在、状态为 approved 且属于当前用户
    const { data: coach, error: coachError } = await supabase
        .from('coaches')
        .select('id, user_id, status')
        .eq('id', coachId)
        .eq('user_id', callerUserId)
        .eq('status', 'approved')
        .single();

    if (coachError || !coach) {
        return NextResponse.json({
            success: false,
            message: '教练不存在、未通过审核或无权限'
        }, { status: 404 });
    }

    // 插入内容记录
    const contentData = {
        coach_id: coachId,
        title: title.trim(),
        content: content.trim(),
        content_type,
        required_tier,
        is_featured: is_featured ?? false,
        tags: tags ?? [],
        media_urls: media_urls ?? [],
        thumbnail_url: thumbnail_url ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    const { data: publishedContent, error: publishError } = await supabase
        .from('coach_contents')
        .insert([contentData])
        .select('*')
        .single();

    if (publishError) {
        console.error('发布内容失败:', publishError);
        return NextResponse.json({
            success: false,
            message: '发布失败，请重试'
        }, { status: 500 });
    }

    // TODO: 若非草稿，可在此处更新教练统计信息
    // 例如更新教练的总内容数或最后发布时间

    return NextResponse.json({
        success: true,
        message: isDraft ? '草稿保存成功' : '内容发布成功',
        data: publishedContent as PublishContentResponseDto
    });
}
