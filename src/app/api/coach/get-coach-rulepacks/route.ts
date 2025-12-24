import { NextResponse } from 'next/server';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import supabase from '@/lib/supabaseClient';
import type { ApiData } from '@/types/api';
import type { GetCoachRulepacksDto, GetCoachRulepacksResponseDto, RulepackFormSchema } from './entity';

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
        coach_id,
        domain
    } = await req.json() as GetCoachRulepacksDto;

    // 查询对应动作域的规则包
    const { data, error } = await supabase
        .from('coach_rulepacks')
        .select('form_schema')
        .eq('coach_id', coach_id)
        .eq('domain', domain)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single();

    if (error) {
        console.error('加载表单配置失败:', error);
        return NextResponse.json<ApiData<GetCoachRulepacksResponseDto>>({
            success: true,
            message: '使用默认配置',
            data: {
                form_schema: null
            }
        });
    }

    return NextResponse.json<ApiData<GetCoachRulepacksResponseDto>>({
        success: true,
        message: '获取规则包成功',
        data: {
            form_schema: data?.form_schema ? (data.form_schema as unknown as RulepackFormSchema) : null
        }
    });
}