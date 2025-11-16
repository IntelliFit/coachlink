import { NextResponse } from 'next/server';
import supabase from '@/lib/supabaseClient';
import { getServerSession } from '../../auth/[...nextauth]/auth';

// 重要！必须以 import type 引入接口类型
import type { ApiData } from '@/types/api';
import type { GetFormSchemaDto, GetFormSchemaResponseDto } from './entity';

export async function POST(req: Request) {
    const session = await getServerSession();
    if (!session?.user?.id) {
        return NextResponse.json({
            success: false,
            message: '用户未登录',
            data: null
        }, { status: 401 });
    }

    const {
        coachId,
        domain
    } = await req.json() as GetFormSchemaDto;

    try {
        // 查询对应动作域的规则包
        const { data, error } = await supabase
            .from('coach_rulepacks')
            .select('form_schema')
            .eq('coach_id', coachId)
            .eq('domain', domain)
            .eq('is_active', true)
            .order('version', { ascending: false })
            .limit(1)
            .single();

        if (error) {
            return NextResponse.json<ApiData<GetFormSchemaResponseDto>>({
                success: false,
                message: `加载表单配置失败: ${error.message}`,
                data: null
            });
        }

        return NextResponse.json<ApiData<GetFormSchemaResponseDto>>({
            success: true,
            message: '成功获取表单配置',
            data: {
                formSchema: data?.form_schema || null
            }
        });
    } catch (error: any) {
        return NextResponse.json<ApiData<GetFormSchemaResponseDto>>({
            success: false,
            message: `加载表单配置错误: ${error.message}`,
            data: null
        });
    }
}