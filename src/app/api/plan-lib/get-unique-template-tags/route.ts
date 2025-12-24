import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
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


    // 获取请求体（虽然这里没有实际参数）
    const {
        coachId
    } = await req.json() as GetUniqueTemplateTagsDto;

    let userId = session.user.id;

    if (coachId) {
        const { data: coach, error: coachError } = await supabase
            .from('coaches')
            .select('*')
            .eq('id', coachId)
            .single();

        if (coachError || !coach) {
            return NextResponse.json<ApiData<GetUniqueTemplateTagsResponseDto>>({
                success: false,
                message: '教练信息不存在',
                data: null
            });
        }

        userId = coach.user_id;
    }


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