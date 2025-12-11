import { NextResponse } from 'next/server';
import { getServerSession } from '../../auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetUniqueTemplateTagsDto, GetUniqueTemplateTagsResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    // 通过 session 获取用户 ID
    const userId = session.user.id;

    // 获取请求体（虽然这里没有实际参数）
    await req.json() as GetUniqueTemplateTagsDto;

    // 从数据库获取该教练的所有模板，并聚合去重 tags
    const { data, error } = await supabase
        .from('coach_plan_templates')
        .select('tags')
        .eq('coach_id', userId);

    if (error) {
        return NextResponse.json<ApiData<null>>({
            success: false,
            message: '获取模板标签失败: ' + error.message,
            data: null
        }, { status: 500 });
    }

    // 提取并去重所有标签
    const allTags = data.flatMap(template => template.tags || []);
    const uniqueTags = Array.from(new Set(allTags));

    // 返回结果
    return NextResponse.json<ApiData<GetUniqueTemplateTagsResponseDto>>({
        success: true,
        message: '获取模板标签成功',
        data: {
            tags: uniqueTags
        }
    });
}